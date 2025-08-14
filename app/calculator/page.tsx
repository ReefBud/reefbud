'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { potencyPerMlPerL, doseMlForDelta, slopePerDay, nearThreshold, maxSpike, splitDaysNeeded } from '@/lib/doseMath';

type ParamKey = 'alk' | 'ca' | 'mg';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  latest: number | null;
  dailySlope: number;
  currentDailyMl: number;
  maintainMlPerDay: number | null;
  extraMlPerDay: number | null;
  correctionMl: number | null;
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

  const tankLiters = tank?.volume_liters ?? tank?.volume_value ?? 0;
  const localDoseKey = (pid: number, pkey: string) => userId && tank ? `dose:${userId}:${tank.id}:${pkey}` : '';

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not signed in'); setLoading(false); return; }
      setUserId(user.id);

      // Tank (Dashboard)
      let { data: tanks, error: terr } = await supabase
        .from('tanks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
      if (terr) { setErr(terr.message); setLoading(false); return; }
      let t: Tank | null = (tanks && tanks[0]) || null;
      if (!t) {
        const { data: created, error: cerr } = await supabase
          .from('tanks').insert({ user_id: user.id, name: 'My Tank', volume_value: 200, volume_unit: 'L', volume_liters: 200 })
          .select('*').single();
        if (cerr) { setErr(cerr.message); setLoading(false); return; }
        t = created as unknown as Tank;
      }
      if (!mounted) return;
      setTank(t);

      // Parameters
      const { data: plist, error: perr } = await supabase.from('parameters').select('*').in('key', PARAM_KEYS);
      if (perr) { setErr(perr.message); setLoading(false); return; }
      setParams(plist || []);

      // Targets (Dashboard)
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // Preferred products (what you're using)
      const { data: prefs } = await supabase
        .from('preferred_products').select('parameter_id,product_id')
        .eq('user_id', user.id).eq('tank_id', t!.id);
      const prefIdByParam = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefIdByParam.set(pp.parameter_id, pp.product_id));

      // Products for these params
      const paramIds = (plist || []).map(p => p.id);
      const { data: prods, error: perror } = await supabase
        .from('products').select('*')
        .in('parameter_id', paramIds)
        .order('brand', { ascending: true }).order('name', { ascending: true });
      if (perror) { setErr(perror.message); setLoading(false); return; }
      const pMap: Record<string, Product> = {};
      (prods || []).forEach((p: any) => { pMap[p.id] = p as Product; });
      setProductsById(pMap);

      // Results history (trendDays window)
      const byParam = await fetchResultsByDays(t!.id, paramIds, trendDays);

      // Build bundles
      const initial: Record<number, ParamBundle> = {};
      for (const p of plist || []) {
        const arr = byParam[p.id] || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        const stored = localStorage.getItem(localDoseKey(p.id, p.key)) || '0';
        const currentDailyMl = Math.max(0, Number(stored) || 0);
        initial[p.id] = {
          param: p,
          productId: prefIdByParam.get(p.id) ?? null,
          latest,
          dailySlope: slope,
          currentDailyMl,
          maintainMlPerDay: null,
          extraMlPerDay: null,
          correctionMl: null,
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

  // Re-fetch trend when trendDays changes
  useEffect(() => {
    (async () => {
      if (!tank || params.length === 0) return;
      const paramIds = params.map(p => p.id);
      const byParam = await fetchResultsByDays(tank.id, paramIds, trendDays);
      const next: Record<number, ParamBundle> = { ...bundles };
      for (const p of params) {
        const arr = byParam[p.id] || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        if (!next[p.id]) continue;
        next[p.id] = { ...next[p.id], latest, dailySlope: slope };
      }
      setBundles(computeAll(next));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendDays]);

  async function fetchResultsByDays(tankId: string, paramIds: number[], days: number) {
    const { data } = await supabase
      .from('results').select('*')
      .eq('tank_id', tankId)
      .in('parameter_id', paramIds)
      .gte('measured_at', new Date(Date.now() - days*24*60*60*1000).toISOString())
      .order('measured_at', { ascending: true });
    const byParam: Record<number, Reading[]> = {};
    (data || []).forEach((r: any) => {
      if (!byParam[r.parameter_id]) byParam[r.parameter_id] = [];
      byParam[r.parameter_id].push(r as Reading);
    });
    return byParam;
  }

  function computeAll(
    state?: Record<number, ParamBundle>,
    tankArg?: Tank | null,
    targetsArg?: TargetRow | null,
    productsArg?: Record<string, Product>
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
      const warnings: string[] = [];
      const working: string[] = [];
      const pkey = pb.param.key as ParamKey;

      const prod = pb.productId ? pmap[pb.productId] : null;
      const potency = prod ? potencyPerMlPerL({
        dose_ref_ml: prod.dose_ref_ml,
        delta_ref_value: prod.delta_ref_value,
        volume_ref_liters: prod.volume_ref_liters,
      }) : null;

      if (!potency || !isFinite(potency) || (tl || 0) <= 0) {
        if (!potency) warnings.push('Select a product with potency set in Products.');
        if ((tl || 0) <= 0) warnings.push('Set a valid tank volume on Dashboard.');
        next[pid] = { ...pb, maintainMlPerDay: null, extraMlPerDay: null, correctionMl: null, warnings, working };
        continue;
      }

      const perMlTank = potency * tl;
      const slope = pb.dailySlope || 0; // units/day; negative means falling
      const latest = pb.latest;
      const targetValue = tgt ? (tgt as any)[pkey] as number | null : null;

      // Maintain dose (absolute):
      // maintain = currentDailyMl − slope / perMlTank
      // If slope is negative (falling), maintain > currentDailyMl (i.e., add more).
      const maintain = Math.max(0, pb.currentDailyMl - (slope / perMlTank));
      const extra = Math.max(0, maintain - pb.currentDailyMl);

      // Correction now (below target)
      let correction: number | null = null;
      if (latest != null && targetValue != null) {
        const delta = targetValue - latest; // >0 => below target
        const absDelta = Math.abs(delta);
        if (delta > 0) {
          correction = doseMlForDelta(delta, potency, tl);
          const thr = nearThreshold[pkey];
          if (absDelta <= thr) warnings.push('Near target. Maintain; avoid big corrections.');
          const max = maxSpike[pkey];
          if (absDelta > max) {
            const days = splitDaysNeeded(absDelta, pkey);
            warnings.push(`Safe correction for ${pb.param.display_name} ≈ ${max} ${pb.param.unit}/day. Consider splitting over ${days} days.`);
          }
        } else if (delta < 0) {
          warnings.push('Above target. Reduce or pause dosing; consider a partial water change.');
        }
      }

      // Working (explicit numbers)
      working.push(`Potency (units/ml/L) = delta_ref / (dose_ref_ml × volume_ref_L)`);
      working.push(`Per ml in your tank = potency × tank_L = ${potency.toFixed(6)} × ${tl} = ${perMlTank.toFixed(6)} ${pb.param.unit}/ml`);
      working.push(`Observed slope over last ${trendDays} days = ${(slope >= 0 ? '+' : '') + slope.toFixed(6)} ${pb.param.unit}/day`);
      working.push(`Maintain dose = current − slope / perMlTank = ${pb.currentDailyMl} − (${slope.toFixed(6)} / ${perMlTank.toFixed(6)}) = ${maintain.toFixed(6)} ml/day`);
      working.push(`Extra to add = max(0, maintain − current) = ${extra.toFixed(6)} ml/day`);

      next[pid] = { ...pb, maintainMlPerDay: maintain, extraMlPerDay: extra, correctionMl: correction, warnings, working };
    }
    return next;
  }

  // Refresh button — re-pull last N days for that param
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
    setBundles(prev => computeAll({ ...prev, [p.id]: { ...prev[p.id], latest, dailySlope: slope } }));
  };

  const onSelectProduct = async (parameter_id: number, productId: string | null) => {
    if (!tank || !userId) return;
    setBundles(prev => computeAll({ ...prev, [parameter_id]: { ...prev[parameter_id], productId } }));
    if (productId) {
      await supabase.from('preferred_products').upsert({
        user_id: userId, tank_id: tank.id, parameter_id, product_id: productId
      }, { onConflict: 'user_id,tank_id,parameter_id' });
    }
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">
        Reads tank size & targets from Dashboard, potency from Products (for your selected product), and your Results trend to calculate the daily dose to hold steady.
      </p>

      <section className="rounded-lg border p-4 flex items-center gap-3">
        <h2 className="text-lg font-medium">Settings</h2>
        <label className="text-sm">Trend window:&nbsp;
          <select className="rounded-md border px-2 py-1 text-sm" value={trendDays} onChange={e => setTrendDays(Number(e.target.value) || 7)}>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
          </select>
        </label>
        <span className="text-xs text-gray-500">Shorter windows react faster; longer windows smooth noise.</span>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Tank</h2>
        <p className="text-sm text-gray-700">Volume: {tankLiters} L</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {params.map((p) => {
          const pb = bundles[p.id];
          if (!pb) return null;
          const targetValue = targets ? (targets as any)[p.key as ParamKey] as number | null : null;

          const changeFromCurrent = (pb.maintainMlPerDay != null)
            ? (pb.maintainMlPerDay - pb.currentDailyMl)
            : null;

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
                <label className="block text-sm">Your current daily dose (ml/day)</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  inputMode="numeric"
                  value={pb.currentDailyMl}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0);
                    const key = localDoseKey(p.id, p.key);
                    if (key) localStorage.setItem(key, String(v));
                    setBundles(prev => computeAll({ ...prev, [p.id]: { ...prev[p.id], currentDailyMl: v } }));
                  }}
                  placeholder="e.g. 30"
                />
              </div>

              <div className="rounded-md bg-gray-50 p-2 text-sm">
                <div><span className="font-medium">Maintain dose:</span> {pb.maintainMlPerDay != null ? `${pb.maintainMlPerDay.toFixed(2)} ml/day` : '—'}</div>
                {changeFromCurrent != null && (
                  <div>
                    {changeFromCurrent > 0
                      ? <span>Add extra: {changeFromCurrent.toFixed(2)} ml/day</span>
                      : <span>Reduce by: {Math.abs(changeFromCurrent).toFixed(2)} ml/day</span>}
                  </div>
                )}
                <div><span className="font-medium">Correction now:</span> {pb.correctionMl != null ? `${pb.correctionMl.toFixed(2)} ml` : '—'}</div>
              </div>

              {pb.warnings.length > 0 && (
                <div className="text-xs text-amber-700 space-y-1">
                  {pb.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </div>
              )}

              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer select-none">Show working</summary>
                <ul className="list-disc ml-5 space-y-1 mt-2">
                  {pb.working.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
