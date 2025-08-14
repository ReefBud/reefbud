'use client';

import AssistantPanel from "./AssistantPanel";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { dosingCalculator, slopePerDay } from '@/lib/doseMath';

type ParamKey = 'alk' | 'ca' | 'mg';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  latest: number | null;
  dailySlope: number; // dKH/day for Alk, ppm/day for Ca/Mg
  strength_factor: number; // 1.0 by default
  outputs: null | ReturnType<typeof dosingCalculator>;
  working: string[];
  warnings: string[];
};

const PARAM_KEYS: ParamKey[] = ['alk','ca','mg'];

export default function CalculatorPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({});
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [trendDays, setTrendDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const tank_L = tank?.volume_liters ?? tank?.volume_value ?? 0;
  const localSFKey = (pid: number, pkey: string) => userId && tank ? `sf:${userId}:${tank.id}:${pkey}` : '';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not signed in'); setLoading(false); return; }
      setUserId(user.id);

      // Tank
      let { data: tanks, error: terr } = await supabase
      .from('tanks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
      if (terr) { setErr(terr.message); setLoading(false); return; }
      let t: Tank | null = (tanks && tanks[0]) || null;
      if (!t) {
        const { data: created, error: cerr } = await supabase
        .from('tanks')
        .insert({ user_id: user.id, name: 'My Tank', volume_value: 200, volume_unit: 'L', volume_liters: 200 })
        .select('*').single();
        if (cerr) { setErr(cerr.message); setLoading(false); return; }
        t = created as unknown as Tank;
      }
      if (!mounted) return;
      setTank(t);

      // Params
      const { data: plist } = await supabase.from('parameters').select('*').in('key', PARAM_KEYS);
      setParams(plist || []);

      // Targets (Dashboard)
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // Preferred products
      const { data: prefs } = await supabase
      .from('preferred_products').select('parameter_id,product_id')
      .eq('user_id', user.id).eq('tank_id', t!.id);
      const prefIdByParam = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefIdByParam.set(pp.parameter_id, pp.product_id));

      // Products
      const paramIds = (plist || []).map(p => p.id);
      const { data: prods } = await supabase
      .from('products').select('*')
      .in('parameter_id', paramIds)
      .order('brand', { ascending: true }).order('name', { ascending: true });
      const pMap: Record<string, Product> = {};
      (prods || []).forEach((p: any) => { pMap[p.id] = p as Product; });
      setProductsById(pMap);

      // Results (trend window)
      const { data: results } = await supabase
      .from('results').select('*')
      .eq('tank_id', t!.id)
      .in('parameter_id', paramIds)
      .gte('measured_at', new Date(Date.now() - trendDays*24*60*60*1000).toISOString())
      .order('measured_at', { ascending: true });
      const byParam: Record<number, Reading[]> = {};
      (results || []).forEach((r: any) => {
        if (!byParam[r.parameter_id]) byParam[r.parameter_id] = [];
        byParam[r.parameter_id].push(r as Reading);
      });

      // Build bundles
      const initial: Record<number, ParamBundle> = {};
      for (const p of plist || []) {
        const arr = byParam[p.id] || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        const sfStored = localStorage.getItem(localSFKey(p.id, p.key));
        initial[p.id] = {
          param: p,
     productId: prefIdByParam.get(p.id) ?? null,
     latest,
     dailySlope: slope,
     strength_factor: sfStored ? Math.max(0.01, Number(sfStored) || 1) : 1.0,
     outputs: null,
     working: [],
     warnings: [],
        };
      }
      if (!mounted) return;
      setBundles(computeAll(initial, t, tgt as TargetRow | null, pMap));

      setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute when trendDays changes
  useEffect(() => {
    (async () => {
      if (!tank || params.length === 0) return;
      const paramIds = params.map(p => p.id);
      const { data } = await supabase
      .from('results').select('*')
      .eq('tank_id', tank.id)
      .in('parameter_id', paramIds)
      .gte('measured_at', new Date(Date.now() - trendDays*24*60*60*1000).toISOString())
      .order('measured_at', { ascending: true });
      const byParam: Record<number, Reading[]> = {};
      (data || []).forEach((r: any) => {
        if (!byParam[r.parameter_id]) byParam[r.parameter_id] = [];
        byParam[r.parameter_id].push(r as Reading);
      });
      const next = { ...bundles };
      for (const p of params) {
        const arr = byParam[p.id] || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        next[p.id] = { ...next[p.id], latest, dailySlope: slope };
      }
      setBundles(computeAll(next));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendDays]);

  function computeAll(
    state?: Record<number, ParamBundle>,
    tankArg?: Tank | null,
    targetsArg?: TargetRow | null,
    productsArg?: Record<string, Product>,
  ) {
    const base = state ?? bundles;
    const t = tankArg ?? tank;
    const tgt = targetsArg ?? targets;
    const pmap = productsArg ?? productsById;
    const tl = t?.volume_liters ?? t?.volume_value ?? 0;

    const next: Record<number, ParamBundle> = {};
    for (const [pidStr, pb0] of Object.entries(base)) {
      const pid = Number(pidStr);
      const pb = { ...pb0 };
      const working: string[] = [];
      const warnings: string[] = [];

      const pkey = pb.param.key as ParamKey;
      const prod = pb.productId ? pmap[pb.productId] : null;
      const dose_ref_ml = prod?.dose_ref_ml ?? null;
      const volume_ref_L = prod?.volume_ref_liters ?? null;
      const delta_ref_units = prod?.delta_ref_value ?? null;

      if (!dose_ref_ml || !volume_ref_L || !delta_ref_units || (tl || 0) <= 0) {
        if (!dose_ref_ml || !volume_ref_L || !delta_ref_units) warnings.push('Set product potency in Products (dose_ref_ml, volume_ref_L, delta_ref_dkh).');
        if ((tl || 0) <= 0) warnings.push('Set a valid tank volume on Dashboard.');
        next[pid] = { ...pb, outputs: null, working, warnings };
        continue;
      }

      const current_value = pb.latest ?? 0;
      const target_value = tgt ? (tgt as any)[pkey] as number | null : null;
      const slope = pb.dailySlope || 0;

      const out = dosingCalculator({
        tank_L: tl,
        current_value,
        target_value: target_value ?? current_value,
        avg_daily_slope_units_per_day: slope,
        dose_ref_ml: Number(dose_ref_ml),
                                   volume_ref_L: Number(volume_ref_L),
                                   delta_ref_units: Number(delta_ref_units),
                                   strength_factor: pb.strength_factor,
      });

      // Working — exact variable names
      working.push(`potency_dkh_per_ml_per_L = delta_ref_dkh / (dose_ref_ml * volume_ref_L)`);
      working.push(`delta_dkh_per_ml_in_tank_at_label = potency_dkh_per_ml_per_L * tank_L`);
      working.push(`delta_dkh_per_ml_in_tank = delta_dkh_per_ml_in_tank_at_label * strength_factor`);
      working.push(`correction_ml = max(0, target_dkh - current_dkh) / delta_dkh_per_ml_in_tank`);
      working.push(`maintenance_ml_per_day = max(0, -avg_daily_slope_dkh_per_day) / delta_dkh_per_ml_in_tank`);
      working.push(`today_total_ml = correction_ml + maintenance_ml_per_day`);

      next[pid] = { ...pb, outputs: out, working, warnings };
    }
    return next;
  }

  const setBundle = (pid: number, patch: Partial<ParamBundle>) => {
    setBundles(prev => computeAll({ ...prev, [pid]: { ...prev[pid], ...patch } }));
  };

  const onSelectProduct = async (parameter_id: number, productId: string | null) => {
    if (!tank || !userId) return;
    setBundle(parameter_id, { productId });
    if (productId) {
      await supabase.from('preferred_products').upsert({
        user_id: userId, tank_id: tank.id, parameter_id, product_id: productId
      }, { onConflict: 'user_id,tank_id,parameter_id' });
    }
  };

  const refreshParam = async (p: Parameter) => {
    if (!tank) return;
    const { data } = await supabase
    .from('results').select('*')
    .eq('tank_id', tank.id)
    .eq('parameter_id', p.id)
    .gte('measured_at', new Date(Date.now() - trendDays*24*60*60*1000).toISOString())
    .order('measured_at', { ascending: true });
    const arr = (data as any[] | null) || [];
    const latest = arr.length ? arr[arr.length - 1].value : null;
    const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
    setBundle(p.id, { latest, dailySlope: slope });
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
    <h1 className="text-2xl font-semibold">OroBit Reef Alkalinity Dosing Calculator</h1>
    <p className="text-sm text-gray-600">
    Pulls tank size & targets from Dashboard, your product potency from Products, and your recent Results trend.
    Implements your exact spec with strength factor & clear working.
    </p>

    {/* >>> ChatGPT Dosing Assistant block added here <<< */}
    <section className="mt-6">
    <h2 className="text-xl font-semibold mb-2">Dosing Assistant</h2>
    <AssistantPanel />
    </section>

    <section className="rounded-lg border p-4 flex items-center gap-3">
    <h2 className="text-lg font-medium">Settings</h2>
    <label className="text-sm">Trend window:&nbsp;
    <select className="rounded-md border px-2 py-1 text-sm" value={trendDays} onChange={e => setTrendDays(Number(e.target.value) || 7)}>
    <option value={3}>3 days</option>
    <option value={7}>7 days</option>
    <option value={14}>14 days</option>
    </select>
    </label>
    </section>

    <section className="rounded-lg border p-4">
    <h2 className="text-lg font-medium">Tank</h2>
    <p className="text-sm text-gray-700">Volume: {tank_L} L</p>
    </section>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {params.map((p) => {
      const pb = bundles[p.id];
      if (!pb) return null;
      const pkey = p.key as ParamKey;
      const targetValue = targets ? (targets as any)[pkey] as number | null : null;
      const o = pb.outputs;

      return (
        <section key={p.id} className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
        <h3 className="font-medium">{p.display_name}</h3>
        <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => refreshParam(p)}>
        Refresh
        </button>
        </div>

        <ProductSelectInline
        tank={tank}
        parameter={p}
        value={pb.productId}
        onChange={(id) => onSelectProduct(p.id, id)}
        />

        <div className="text-sm space-y-1">
        <div>Latest reading: {pb.latest ?? '—'} {p.unit}</div>
        <div>Target: {targetValue ?? '—'} {p.unit}</div>
        <div>Trend (last {trendDays}d): {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
        </div>

        <div className="space-y-1">
        <label className="text-sm">Strength factor (default 1.0)</label>
        <input
        className="w-full rounded-md border px-3 py-2"
        inputMode="decimal"
        value={pb.strength_factor}
        onChange={(e) => {
          const sf = Math.max(0.01, Number(e.target.value.replace(/[^\d.]/g, '')) || 1);
          const key = localSFKey(p.id, p.key);
          if (key) localStorage.setItem(key, String(sf));
          setBundle(p.id, { strength_factor: sf });
        }}
        placeholder="1.0"
        />
        </div>

        <div className="rounded-md bg-gray-50 p-2 text-sm">
        {o
          ? (<>
          <div><span className="font-medium">One-time correction:</span> {o.correction_ml.toFixed(2)} ml ({o.correction_needed_units.toFixed(2)} {p.unit}){(pkey==='alk' && o.correction_needed_units>0.5) ? ' — consider splitting' : ''}</div>
          <div><span className="font-medium">Daily maintenance:</span> {o.maintenance_ml_per_day.toFixed(2)} ml/day (covers {o.consumption_units_per_day.toFixed(3)} {p.unit}/day consumption)</div>
          <div><span className="font-medium">Dose today:</span> {o.today_total_ml.toFixed(2)} ml</div>
          </>)
          : <div>Set product potency and tank volume to see results.</div>
        }
        </div>

        {pb.working.length > 0 && (
          <details className="text-xs text-gray-600">
          <summary className="cursor-pointer select-none">Show working</summary>
          <ul className="list-disc ml-5 space-y-1 mt-2">
          {pb.working.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          </details>
        )}
        </section>
      );
    })}
    </div>
    </main>
  );
}
