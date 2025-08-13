'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { computeDoseMl } from '@/lib/dose';

type Parameter = { id: number; key: string; unit: string; display_name?: string | null };
type Tank = { id: string; name?: string | null; volume_liters?: number | null };
type Targets = { [key: string]: number | null }; // targets by parameter key
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

const PARAM_KEYS = ['alk', 'ca', 'mg', 'po4', 'no3', 'trace_anions', 'trace_cations'] as const;
type ParamKey = typeof PARAM_KEYS[number];

export default function CalculatorPage() {
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [tank, setTank] = useState<Tank | null>(null);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [latest, setLatest] = useState<Record<number, Reading | null>>({}); // by parameter_id
  const [preferred, setPreferred] = useState<Record<number, Preferred | null>>({}); // by parameter_id
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
      setUserId(uid);

      // 1) Parameters
      const { data: pData } = await supabase
        .from('parameters')
        .select('id, key, unit, display_name')
        .in('key', PARAM_KEYS as any);

      const params: Parameter[] = pData ?? [];
      if (mounted) setParameters(params);

      // 2) Find or create a default tank for the user
      let t: Tank | null = null;
      {
        const { data: t1 } = await supabase
          .from('tanks')
          .select('id, name, volume_liters')
          .eq('user_id', uid)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (t1) t = t1 as Tank;
      }
      if (t == null) {
        // optional: create a default tank if none exists
        const { data: created, error: ctErr } = await supabase
          .from('tanks')
          .insert({ user_id: uid, name: 'My Tank', volume_liters: 200 })
          .select('id, name, volume_liters')
          .single();
        if (!ctErr && created) t = created as Tank;
      }
      if (mounted) setTank(t);

      // 3) Targets (try per-tank table first, else user-level 'targets')
      if (t?.id) {
        const { data: tt } = await supabase
          .from('tank_targets')
          .select('parameter_id, target_value, parameters!inner(key)')
          .eq('tank_id', t.id);
        if (tt && tt.length) {
          const map: Targets = {};
          for (const row of tt as any[]) {
            map[row.parameters.key] = row.target_value;
          }
          if (mounted) setTargets(map);
        } else {
          const { data: tg } = await supabase
            .from('targets')
            .select('alk, ca, mg, po4, no3, salinity');
          if (tg && tg.length) {
            const first = tg[0] as any;
            if (mounted) setTargets({
              alk: first.alk ?? null,
              ca: first.ca ?? null,
              mg: first.mg ?? null,
              po4: first.po4 ?? null,
              no3: first.no3 ?? null,
            });
          }
        }
      }

      // 4) Preferred products per parameter for this tank
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

      // 5) Latest readings (optional — if you have a readings table)
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
    let warnings: string[] = [];

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
        warnings.push('Missing potency on selected product (dose_ref_ml, delta_ref_value, volume_ref_liters).');
      }
    } else {
      if (latestReading == null) warnings.push('No recent reading found.');
      if (target == null) warnings.push('No target set (Dashboard).');
      if (!product) warnings.push('No product selected (Chemist).');
      if (Vtank == null) warnings.push('Tank volume unknown.');
    }

    return (
      <tr key={param.id} className="border-t">
        <td className="py-3 pr-3 align-top">
          <div className="font-medium">{param.display_name ?? param.key}</div>
          <div className="text-xs text-gray-500">{param.unit}</div>
        </td>
        <td className="py-3 pr-3 align-top">{latestReading ?? '—'}</td>
        <td className="py-3 pr-3 align-top">{target ?? '—'}</td>
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
            <div className="text-xs text-amber-700">{warnings.join(' ') || '—'}</div>
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
        Uses your selected Chemist product and potency, your latest reading, your target (Dashboard), and your tank volume.
      </p>

      <div className="mt-4 text-sm text-gray-700">
        <div><span className="font-medium">Tank:</span> {tank?.name ?? '—'} ({tank?.volume_liters ?? '—'} L)</div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Parameter</th>
              <th className="text-left font-medium px-3 py-2">Latest</th>
              <th className="text-left font-medium px-3 py-2">Target</th>
              <th className="text-left font-medium px-3 py-2">Product (Chemist)</th>
              <th className="text-left font-medium px-3 py-2">Recommended Dose</th>
            </tr>
          </thead>
          <tbody className="px-3">
            {parameters.map(renderRow)}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Tip: If a row shows “No product selected,” go to <a className="underline" href="/chemist">Chemist</a> and pick one.
        If it shows “Missing potency,” edit the product in <a className="underline" href="/products">Products</a> and add test potency.
      </div>
    </main>
  );
}