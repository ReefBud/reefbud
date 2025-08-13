'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { potencyPerMlPerL, doseMlForDelta, slopePerDay, nearThreshold, maxSpike } from '@/lib/doseMath';

type ParamKey = 'alk' | 'ca' | 'mg';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  latest: number | null;
  dailySlope: number; // units/day; >0 rising
  currentDailyMl: number; // user's current daily dose input
  extraMlPerDay: number | null; // additional ml/day needed
  correctionMl: number | null; // correction now if below target
  working: string[];
  warnings: string[];
};

const PARAM_KEYS: ParamKey[] = ['alk','ca','mg'];

export default function CalculatorPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({}); // by parameter_id
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
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

      // user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not signed in'); setLoading(false); return; }
      setUserId(user.id);

      // tank
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

      // params Alk/Ca/Mg
      const { data: plist, error: perr } = await supabase.from('parameters').select('*').in('key', PARAM_KEYS);
      if (perr) { setErr(perr.message); setLoading(false); return; }
      const byKey: Record<string, Parameter> = {};
      (plist || []).forEach(p => byKey[p.key] = p);
      setParams(plist || []);

      // targets
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // preferred products
      const { data: prefs } = await supabase
        .from('preferred_products').select('parameter_id,product_id')
        .eq('user_id', user.id).eq('tank_id', t!.id);
      const prefIdByParam = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefIdByParam.set(pp.parameter_id, pp.product_id));

      // all products for these parameters (global + user)
      const paramIds = (plist || []).map(p => p.id);
      const { data: prods, error: perror } = await supabase
        .from('products').select('*')
        .in('parameter_id', paramIds)
        .order('brand', { ascending: true }).order('name', { ascending: true });
      if (perror) { setErr(perror.message); setLoading(false); return; }
      const pMap: Record<string, Product> = {};
      (prods || []).forEach((p: any) => { pMap[p.id] = p as Product; });
      setProductsById(pMap);

      // results: last 14 days for those params
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .eq('tank_id', t!.id)
        .in('parameter_id', paramIds)
        .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
        .order('measured_at', { ascending: true });
      const byParam: Record<number, Reading[]> = {};
      (results || []).forEach((r: any) => {
        if (!byParam[r.parameter_id]) byParam[r.parameter_id] = [];
        byParam[r.parameter_id].push(r as Reading);
      });

      // build bundles
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
          extraMlPerDay: null,
          correctionMl: null,
          working: [],
          warnings: [],
        };
      }
      if (!mounted) return;
      setBundles(initial);

      setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProduct = (productId: string | null): Product | null => {
    if (!productId) return null;
    return productsById[productId] || null;
  };

  const computeForParam = (pb: ParamBundle): ParamBundle => {
    if (!tank) return pb;
    const warnings: string[] = [];
    const working: string[] = [];
    const pkey = pb.param.key as ParamKey;
    const targetValue = targets ? (targets as any)[pkey] as number | null : null;

    const prod = getProduct(pb.productId);
    const potency = prod ? potencyPerMlPerL({
      dose_ref_ml: prod.dose_ref_ml,
      delta_ref_value: prod.delta_ref_value,
      volume_ref_liters: prod.volume_ref_liters,
    }) : null;

    if (!potency || !isFinite(potency)) {
      warnings.push('Product potency missing — set test dose, change, and tank size on the product.');
      return { ...pb, extraMlPerDay: null, correctionMl: null, working, warnings };
    }

    const perMlTank = potency * (tankLiters || 0);
    if (perMlTank <= 0) {
      warnings.push('Tank volume or potency is invalid.');
      return { ...pb, extraMlPerDay: null, correctionMl: null, working, warnings };
    }

    const slope = pb.dailySlope || 0; // units/day; >0 rising
    const latest = pb.latest;

    // Dose effect from current daily dose
    const doseEffect = pb.currentDailyMl * perMlTank; // units/day
    // Estimated consumption (how much tank is actually using per day)
    // If system rises by slope, consumption ~= doseEffect - slope
    let consumption = doseEffect - slope;
    if (!isFinite(consumption) || consumption < 0) consumption = 0;

    // Required ml/day to hold level (counter consumption)
    const requiredMlPerDay = consumption / perMlTank;
    // Extra ml/day above current
    const extraMlPerDay = Math.max(0, requiredMlPerDay - pb.currentDailyMl);

    // Correction now if below target
    let correctionMl: number | null = null;
    if (latest != null && targetValue != null) {
      const delta = targetValue - latest; // >0 means below target
      const absDelta = Math.abs(delta);
      if (delta > 0) {
        correctionMl = doseMlForDelta(delta, potency, tankLiters || 0);
        // Safe spike checks
        const max = maxSpike[pkey];
        if (absDelta > max) {
          warnings.push(`Safe correction limit for ${pb.param.display_name} is about ${max} ${pb.param.unit}/day. Consider splitting.`);
        }
      } else if (delta < 0) {
        warnings.push('Above target — reduce or pause dosing; consider partial water change.');
      }
      const thr = nearThreshold[pkey];
      if (Math.abs(delta) <= thr) warnings.push('Near target — maintain; avoid big corrections.');
    }

    // Working out text
    working.push(`Potency (units/ml/L) = delta_ref / (dose_ref_ml × volume_ref_L)`);
    working.push(`Per-ml effect in tank = potency × tank_L = ${(potency).toFixed(6)} × ${tankLiters} = ${(perMlTank).toFixed(6)} ${pb.param.unit}/ml`);
    working.push(`Dose effect from your current dose = ${pb.currentDailyMl} ml/day × ${perMlTank.toFixed(6)} = ${(doseEffect).toFixed(6)} ${pb.param.unit}/day`);
    working.push(`Observed slope (Results) = ${(slope >= 0 ? '+' : '') + slope.toFixed(6)} ${pb.param.unit}/day`);
    working.push(`Estimated consumption = doseEffect − slope = ${(doseEffect).toFixed(6)} − ${(slope).toFixed(6)} = ${(consumption).toFixed(6)} ${pb.param.unit}/day`);
    working.push(`Required ml/day = consumption / perMlTank = ${(consumption).toFixed(6)} / ${perMlTank.toFixed(6)} = ${(requiredMlPerDay).toFixed(6)} ml/day`);
    working.push(`Extra ml/day needed = max(0, required − current) = max(0, ${(requiredMlPerDay).toFixed(6)} − ${pb.currentDailyMl}) = ${extraMlPerDay.toFixed(6)} ml/day`);
    if (correctionMl != null) {
      working.push(`Correction now (if below target) = delta / perMlPerL / tank_L`);
    }

    return { ...pb, extraMlPerDay, correctionMl, warnings, working };
  };

  const recomputeAll = (state: Record<number, ParamBundle>) => {
    const next: Record<number, ParamBundle> = {};
    for (const [pid, pb] of Object.entries(state)) {
      next[Number(pid)] = computeForParam(pb as ParamBundle);
    }
    return next;
  };

  // Recompute whenever dependencies change
  useEffect(() => {
    setBundles(prev => recomputeAll(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tankLiters, targets, productsById]);

  // Update helper
  const setBundle = (parameter_id: number, patch: Partial<ParamBundle>) => {
    setBundles(prev => {
      const merged = { ...prev[parameter_id], ...patch } as ParamBundle;
      const next = { ...prev, [parameter_id]: merged };
      return recomputeAll(next);
    });
  };

  // Select product (persist to preferred_products and compute immediately)
  const onSelectProduct = async (parameter_id: number, productId: string | null, _product?: Product | null) => {
    if (!tank || !userId) return;
    setBundle(parameter_id, { productId });
    if (productId) {
      await supabase.from('preferred_products').upsert({
        user_id: userId, tank_id: tank.id, parameter_id, product_id: productId
      }, { onConflict: 'user_id,tank_id,parameter_id' });
    }
  };

  // Per-parameter refresh: reload latest results & slope for that parameter only
  const refreshParam = async (p: Parameter) => {
    if (!tank) return;
    const { data } = await supabase
      .from('results').select('*')
      .eq('tank_id', tank.id)
      .eq('parameter_id', p.id)
      .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
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
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">
        Select your product, enter your current daily dose, and review the extra ml/day needed and safe correction now.
      </p>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Tank</h2>
        <p className="text-sm text-gray-700">Volume: {tankLiters} L</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {params.map((p) => {
          const pb = bundles[p.id];
          if (!pb) return null;
          const targetValue = targets ? (targets as any)[p.key as ParamKey] as number | null : null;

          return (
            <section key={p.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{p.display_name}</h3>
                <button
                  className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => refreshParam(p)}
                >
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
                <div>Trend (Results): {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
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
                    setBundle(p.id, { currentDailyMl: v });
                  }}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="rounded-md bg-gray-50 p-2 text-sm">
                <div><span className="font-medium">Extra ml/day needed:</span> {pb.extraMlPerDay != null ? pb.extraMlPerDay.toFixed(2) : '—'}</div>
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
