
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { computeDoseMl } from '@/lib/dose';

type Parameter = { id: number; key: string; unit: string; display_name?: string | null };
type TankRaw = {
  id: string;
  name?: string | null;
  volume_liters?: number | null;
  volume?: number | null;
  liters?: number | null;
  tank_volume?: number | null;
  size_liters?: number | null;
};
type Tank = { id: string; name?: string | null; volume_liters?: number | null };
type Targets = { [key: string]: number | null };
type Reading = { parameter_id: number; value: number; measured_at: string };
type Preferred = { parameter_id: number; product_id: string, product: Product };
type Product = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number | null;
  helper_text?: string | null;
  dose_ref_ml?: number | null;
  delta_ref_value?: number | null;
  volume_ref_liters?: number | null;
};

const PARAM_KEYS = ['alk', 'ca', 'mg', 'po4', 'no3'] as const;

export default function CalculatorPage() {
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [tank, setTank] = useState<Tank | null>(null);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [latest, setLatest] = useState<Record<number, Reading | null>>({});
  const [preferred, setPreferred] = useState<Record<number, Preferred | null>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setErr(null);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData?.user) {
        setErr('Please sign in to use the calculator.');
        setLoading(false);
        return;
      }
      const uid = userData.user.id;

      // Parameters
      const { data: pData } = await supabase
        .from('parameters')
        .select('id, key, unit, display_name')
        .in('key', PARAM_KEYS as any);
      if (mounted) setParameters(pData ?? []);

      // Tank: tolerate multiple legacy volume column names
      let t: Tank | null = null;
      {
        const { data: t1 } = await supabase
          .from('tanks')
          .select('id, name, volume_liters, volume, liters, tank_volume, size_liters')
          .eq('user_id', uid)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (t1) {
          const raw = t1 as TankRaw;
          const vol = raw.volume_liters ?? raw.volume ?? raw.liters ?? raw.tank_volume ?? raw.size_liters ?? null;
          t = { id: raw.id, name: raw.name, volume_liters: vol };
        }
      }
      if (mounted) setTank(t);

      // Dashboard targets for this user
      {
        const { data: tg } = await supabase
          .from('targets')
          .select('alk, ca, mg, po4, no3')
          .eq('user_id', uid)
          .maybeSingle();
        if (mounted) {
          setTargets({
            alk: tg?.alk ?? null,
            ca:  tg?.ca  ?? null,
            mg:  tg?.mg  ?? null,
            po4: tg?.po4 ?? null,
            no3: tg?.no3 ?? null,
          });
        }
      }

      // Preferred products (Chemist) for the selected tank
      if (t?.id) {
        const { data: pref } = await supabase
          .from('preferred_products')
          .select('parameter_id, product_id, products:product_id(id, brand, name, parameter_id, helper_text, dose_ref_ml, delta_ref_value, volume_ref_liters)')
          .eq('user_id', uid)
          .eq('tank_id', t.id);

        const map: Record<number, Preferred> = {};
        for (const row of (pref ?? []) as any[]) {
          if (row.parameter_id && row.products) {
            map[row.parameter_id] = {
              parameter_id: row.parameter_id,
              product_id: row.product_id,
              product: row.products as Product,
            };
          }
        }
        if (mounted) setPreferred(map);
      }

      // Latest readings per parameter for this tank
      if (t?.id) {
        const { data: r } = await supabase
          .from('readings')
          .select('parameter_id, value, measured_at')
          .eq('tank_id', t.id)
          .order('measured_at', { ascending: false });
        const rmap: Record<number, Reading | null> = {};
        for (const row of (r ?? []) as any[]) {
          if (!(row.parameter_id in rmap)) rmap[row.parameter_id] = row as Reading;
        }
        if (mounted) setLatest(rmap);
      }

      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [supabase]);

  const renderRow = (param: Parameter) => {
    const latestReading = latest[param.id]?.value ?? null;
    const target = targets[param.key] ?? null;
    const pref = preferred[param.id] ?? null;
    const product = pref?.product ?? null;
    const Vtank = tank?.volume_liters ?? null;

    let mlNeeded: number | null = null;
    let deltaText = '';
    const info: string[] = [];

    if (latestReading != null && target != null && product && Vtank != null) {
      const delta = target - latestReading;
      deltaText = delta.toFixed(3);
      if ((product.dose_ref_ml ?? 0) > 0 && (product.delta_ref_value ?? 0) > 0 && (product.volume_ref_liters ?? 0) > 0) {
        mlNeeded = computeDoseMl(delta, Vtank, {
          dose_ref_ml: product.dose_ref_ml!,
          delta_ref_value: product.delta_ref_value!,
          volume_ref_liters: product.volume_ref_liters!,
        });
      } else {
        info.push('Missing potency on selected product.');
      }
    } else {
      if (latestReading == null) info.push('No recent reading.');
      if (target == null) info.push('No target set on Dashboard.');
      if (!product) info.push('No product selected in Chemist.');
      if (Vtank == null) info.push('Tank volume unknown.');
    }

    const currentToTarget = (latestReading != null && target != null)
      ? `${latestReading} → ${target}`
      : (latestReading != null ? String(latestReading) : '—');

    return (
      <tr key={param.id} className="border-t">
        <td className="py-3 pr-3 align-top">
          <div className="font-medium">{param.display_name ?? param.key}</div>
          <div className="text-xs text-gray-500">{param.unit}</div>
        </td>
        <td className="py-3 pr-3 align-top">{currentToTarget}</td>
        <td className="py-3 pr-3 align-top">
          {product ? (
            <div className="text-sm">
              <div className="font-medium">{product.brand} — {product.name}</div>
              <div className="text-xs text-gray-500">
                {product.dose_ref_ml ?? '—'} ml → {product.delta_ref_value ?? '—'} units in {product.volume_ref_liters ?? '—'} L
              </div>
              {product.helper_text && <div className="text-xs text-gray-500 mt-1">{product.helper_text}</div>}
            </div>
          ) : '—'}
        </td>
        <td className="py-3 align-top">
          {mlNeeded != null ? (
            <div>
              <div className="font-semibold">{mlNeeded.toFixed(2)} ml</div>
              <div className="text-xs text-gray-500">Δ = {deltaText} {param.unit}</div>
            </div>
          ) : (
            <div className="text-xs text-amber-700">{info.join(' ') || '—'}</div>
          )}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto p-4">
        <h1 className="text-2xl font-semibold">Calculator</h1>
        <p className="text-sm text-gray-500 mt-2">Loading…</p>
      </main>
    );
  }
  if (err) {
    return (
      <main className="max-w-5xl mx-auto p-4">
        <h1 className="text-2xl font-semibold">Calculator</h1>
        <p className="text-sm text-red-600 mt-2">{err}</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600 mt-1">
        Targets are pulled from your Dashboard.
      </p>

      <div className="mt-4 text-sm text-gray-700 space-y-1">
        <div><span className="font-medium">Tank:</span> {tank?.name ?? '—'} ({tank?.volume_liters ?? '—'} L)</div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Parameter</th>
              <th className="text-left font-medium px-3 py-2">Current → Target</th>
              <th className="text-left font-medium px-3 py-2">Product (Chemist)</th>
              <th className="text-left font-medium px-3 py-2">Recommended Dose</th>
            </tr>
          </thead>
          <tbody className="px-3">
            {parameters.map(renderRow)}
          </tbody>
        </table>
      </div>
    </main>
  );
}
