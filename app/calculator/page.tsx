'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { potencyPerMlPerL, doseMlForDelta, slopePerDay, estimateConsumptionPerDay, nearThreshold, maxSpikePerDay } from '@/lib/doseMath';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  product: Product | null;
  latest: number | null;
  dailySlope: number; // units/day
  currentDailyMl: string; // user input
  extraDailyMl: number | null; // how many ml extra they need on top of their current dose
  correctionMl: number | null;
  working: string[];
  warnings: string[];
};

const PARAM_KEYS: Array<'alk'|'ca'|'mg'> = ['alk','ca','mg'];

const keyForLS = (uid: string, tankId: string, paramKey: string) => `rb.dose.${uid}.${tankId}.${paramKey}`;

export default function CalculatorPage() {
  const [userId, setUserId] = useState<string>('');
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // refresh helper for a single parameter: refetch latest results for that param
  async function refreshParam(parameter_id: number) {
    if (!tank) return;
    // get last 14 days readings from RESULTS table
    const { data: rows, error } = await supabase
      .from('results')
      .select('*')
      .eq('tank_id', tank.id)
      .eq('parameter_id', parameter_id)
      .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
      .order('measured_at', { ascending: true });
    if (error) {
      setBundles(prev => ({ ...prev, [parameter_id]: { ...prev[parameter_id], warnings: [error.message] } }));
      return;
    }
    const arr = (rows || []) as unknown as Reading[];
    const latest = arr.length ? arr[arr.length - 1].value : null;
    const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
    setBundles(prev => recompute({ ...prev, [parameter_id]: { ...prev[parameter_id], latest, dailySlope: slope } }));
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not signed in'); setLoading(false); return; }
      setUserId(user.id);

      // Tank
      let { data: tanks, error: terr } = await supabase.from('tanks').select('*').eq('user_id', user.id).order('created_at',{ascending:true}).limit(1);
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

      // Parameters
      const { data: plist, error: perr } = await supabase.from('parameters').select('*').in('key', PARAM_KEYS);
      if (perr) { setErr(perr.message); setLoading(false); return; }
      setParams(plist || []);

      // Targets
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // Preferred products
      const { data: prefs } = await supabase.from('preferred_products').select('*').eq('user_id', user.id).eq('tank_id', t.id);
      const prefMap = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefMap.set(pp.parameter_id, pp.product_id));

      // Recent results per param (14d)
      const paramIds = (plist || []).map(p => p.id);
      const { data: resultsRows } = await supabase
        .from('results').select('*')
        .eq('tank_id', t.id)
        .in('parameter_id', paramIds)
        .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
        .order('measured_at', { ascending: true });

      const byParam: Record<number, Reading[]> = {};
      (resultsRows || []).forEach((r: any) => {
        if (!byParam[r.parameter_id]) byParam[r.parameter_id] = [];
        byParam[r.parameter_id].push(r as Reading);
      });

      // Build initial bundles
      const initial: Record<number, ParamBundle> = {};
      for (const p of (plist || [])) {
        const arr = byParam[p.id] || [];
        const latest = arr.length ? arr[arr.length-1].value : null;
        const { slopePerDay: s } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        // load currentDailyMl from localStorage
        let currentDailyMl = '';
        try {
          const k = keyForLS(user.id, t.id, p.key);
          const saved = localStorage.getItem(k);
          if (saved) currentDailyMl = saved;
        } catch {}
        initial[p.id] = {
          param: p,
          productId: prefMap.get(p.id) ?? null,
          product: null,
          latest,
          dailySlope: s,
          currentDailyMl,
          extraDailyMl: null,
          correctionMl: null,
          working: [],
          warnings: [],
        };
      }
      setBundles(initial);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // recompute all bundles using current targets/tank state
  const recompute = (state: Record<number, ParamBundle>) => {
    if (!tank) return state;
    const tankL = tank.volume_liters ?? tank.volume_value ?? 0;
    const next: Record<number, ParamBundle> = {};
    for (const [pidStr, pb0] of Object.entries(state)) {
      const pid = Number(pidStr);
      const pb = pb0 as ParamBundle;
      const working: string[] = [];
      const warnings: string[] = [];
      let extraDailyMl: number | null = null;
      let correctionMl: number | null = null;

      const tkey = pb.param.key as 'alk'|'ca'|'mg';
      const targetValue = targets ? (targets as any)[tkey] as number | null : null;
      const current = pb.latest;
      const unitsPerMlPerL = pb.product ? potencyPerMlPerL({
        dose_ref_ml: pb.product.dose_ref_ml,
        delta_ref_value: pb.product.delta_ref_value,
        volume_ref_liters: pb.product.volume_ref_liters,
      }) : null;

      // Show working — potency lines
      if (pb.product && unitsPerMlPerL != null) {
        working.push(`Potency (units/ml/L) = ${pb.product.delta_ref_value} / (${pb.product.dose_ref_ml} × ${pb.product.volume_ref_liters}) = ${unitsPerMlPerL.toFixed(6)}`);
        working.push(`Per-ml effect in your tank = ${unitsPerMlPerL.toFixed(6)} × ${tankL} L = ${(unitsPerMlPerL * tankL).toFixed(6)} ${pb.param.unit}/ml`);
      }

      // Estimate consumption using user's current daily dose & observed slope
      if (unitsPerMlPerL != null) {
        const curMl = Number(pb.currentDailyMl) || 0;
        const consumption = estimateConsumptionPerDay(pb.dailySlope, curMl, unitsPerMlPerL, tankL);
        if (pb.product) {
          working.push(`Observed slope = ${pb.dailySlope.toFixed(3)} ${pb.param.unit}/day`);
          working.push(`Dose effect from your current dose = ${curMl} ml/day × ${(unitsPerMlPerL*tankL).toFixed(6)} = ${(curMl * unitsPerMlPerL * tankL).toFixed(3)} ${pb.param.unit}/day`);
          working.push(`Estimated consumption = doseEffect - slope = ${(curMl * unitsPerMlPerL * tankL).toFixed(3)} - ${pb.dailySlope.toFixed(3)} = ${(consumption).toFixed(3)} ${pb.param.unit}/day`);
        }

        // Required ml/day to keep up with consumption
        const reqMl = doseMlForDelta(consumption, unitsPerMlPerL, tankL);
        if (pb.product) {
          working.push(`Required ml/day = consumption / (potency × tankL) = ${consumption.toFixed(3)} / (${unitsPerMlPerL.toFixed(6)} × ${tankL}) = ${reqMl.toFixed(2)} ml/day`);
        }
        // Extra needed on top of current
        extraDailyMl = Math.max(0, reqMl - (Number(pb.currentDailyMl) || 0));
        if (pb.product) {
          working.push(`Extra ml/day needed = required - current = ${reqMl.toFixed(2)} - ${(Number(pb.currentDailyMl)||0).toFixed(2)} = ${extraDailyMl.toFixed(2)} ml/day`);
        }
      }

      // Correction to reach target (if below target)
      if (current != null && targetValue != null && unitsPerMlPerL != null && tankL > 0) {
        const delta = targetValue - current;
        const thr = nearThreshold[tkey];
        if (delta > 0) {
          correctionMl = doseMlForDelta(delta, unitsPerMlPerL, tankL);
          working.push(`Correction (ml) = delta / (potency × tankL) = ${delta.toFixed(3)} / (${unitsPerMlPerL.toFixed(6)} × ${tankL}) = ${correctionMl.toFixed(2)} ml`);
          const maxSpike = maxSpikePerDay[tkey];
          if (delta > maxSpike) {
            warnings.push(`Safe spike for ${pb.param.display_name} is ~${maxSpike} ${pb.param.unit}/day. Consider splitting the correction over ${Math.ceil(delta / maxSpike)} days.`);
          }
          if (delta <= thr) warnings.push('Near target — avoid large corrections.');
        } else if (delta < 0) {
          warnings.push('Above target — hold or reduce dose.');
        }
      }

      next[pid] = { ...pb, extraDailyMl, correctionMl, working, warnings };
    }
    return next;
  };

  // set bundle field and recompute
  const setBundle = (parameter_id: number, patch: Partial<ParamBundle>) => {
    setBundles(prev => recompute({ ...prev, [parameter_id]: { ...prev[parameter_id], ...patch } }));
  };

  const onSelectProduct = async (parameter_id: number, productId: string | null, product?: Product | null) => {
    if (!tank) return;
    setBundle(parameter_id, { productId, product: product ?? null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !productId) return;
    await supabase.from('preferred_products').upsert({ user_id: user.id, tank_id: tank.id, parameter_id, product_id: productId }, { onConflict: 'user_id,tank_id,parameter_id' });
  };

  const onChangeDaily = (p: Parameter, v: string) => {
    if (!tank || !userId) return;
    // keep digits and decimal
    const clean = v.replace(/[^\d.]/g, '');
    try { localStorage.setItem(keyForLS(userId, tank.id, p.key), clean); } catch {}
    setBundle(p.id, { currentDailyMl: clean });
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">Targets come from Dashboard. Latest readings and trend use your Results. Choose a product, enter your current daily dose, and press Refresh if needed.</p>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Tank</h2>
        <p className="text-sm text-gray-700">Volume: {tank.volume_liters ?? tank.volume_value ?? 0} L</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {params.map((p) => {
          const pb = bundles[p.id];
          if (!pb) return null;
          const tkey = p.key as 'alk'|'ca'|'mg';
          const targetValue = targets ? (targets as any)[tkey] as number | null : null;
          const maxSpike = maxSpikePerDay[tkey];
          return (
            <section key={p.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{p.display_name}</h3>
                <button
                  className="text-sm rounded-md border px-2 py-1 hover:bg-gray-50"
                  onClick={() => refreshParam(p.id)}
                  title="Refresh latest results and trend"
                >
                  Refresh
                </button>
              </div>

              <ProductSelectInline
                tank={tank}
                parameter={p}
                value={pb.productId}
                onChange={(id, prod) => onSelectProduct(p.id, id, prod)}
              />

              <div className="text-sm space-y-1">
                <div>Latest: {pb.latest ?? '—'} {p.unit}</div>
                <div>Target: {targetValue ?? '—'} {p.unit}</div>
                <div>Trend: {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
              </div>

              <div>
                <label className="block text-sm mb-1">Your current daily dose (ml/day)</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={pb.currentDailyMl}
                  onChange={(e) => onChangeDaily(p, e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="rounded-md bg-gray-50 p-2 text-sm">
                <div>
                  <span className="font-medium">Extra ml/day needed:</span>{' '}
                  {pb.extraDailyMl != null ? `${pb.extraDailyMl.toFixed(2)} ml/day` : '—'}
                </div>
                <div>
                  <span className="font-medium">Correction now:</span>{' '}
                  {pb.correctionMl != null ? `${pb.correctionMl.toFixed(2)} ml` : '—'}
                </div>
                <div className="text-xs text-gray-600 mt-2">Max safe daily spike for this parameter ≈ {maxSpike} {p.unit}.</div>
              </div>

              {pb.warnings.length > 0 && (
                <div className="text-xs text-amber-700 space-y-1">
                  {pb.warnings.map((w,i)=> <div key={i}>• {w}</div>)}
                </div>
              )}

              {pb.working.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer select-none font-medium">Show working</summary>
                  <div className="mt-1 space-y-1">
                    {pb.working.map((w,i)=> <div key={i}>{w}</div>)}
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
