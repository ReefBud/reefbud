'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, PreferredProduct, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { potencyPerMlPerL, doseMlForDelta, slopePerDay, waterChangeResult, nearThreshold } from '@/lib/doseMath';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  product: Product | null;
  latest: number | null;
  dailySlope: number; // units/day, >0 means rising
  recommendedDailyMl: number | null;
  correctionMl: number | null;
  warnings: string[];
  saltmix: string; // user-entered baseline for 20% WC preview
  wc20Result: number | null;
};

const PARAM_KEYS: Array<'alk' | 'ca' | 'mg'> = ['alk','ca','mg'];

export default function CalculatorPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({}); // key: parameter_id
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      // 1) user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not signed in'); setLoading(false); return; }

      // 2) find/create tank
      let { data: tanks, error: terr } = await supabase
        .from('tanks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (terr) { setErr(terr.message); setLoading(false); return; }
      let t: Tank | null = (tanks && tanks[0]) || null;
      if (!t) {
        const { data: created, error: cerr } = await supabase
          .from('tanks')
          .insert({ user_id: user.id, name: 'My Tank', volume_value: 200, volume_unit: 'L', volume_liters: 200 })
          .select('*')
          .single();
        if (cerr) { setErr(cerr.message); setLoading(false); return; }
        t = created as unknown as Tank;
      }
      if (!mounted) return;
      setTank(t);

      // 3) params (alk, ca, mg)
      const { data: plist, error: perr } = await supabase
        .from('parameters').select('*').in('key', PARAM_KEYS);
      if (perr) { setErr(perr.message); setLoading(false); return; }
      const byKey: Record<string, Parameter> = {};
      (plist || []).forEach(p => { byKey[p.key] = p; });
      setParams(plist || []);

      // 4) targets
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // 5) preferred products
      const { data: prefs } = await supabase
        .from('preferred_products').select('*')
        .eq('user_id', user.id)
        .eq('tank_id', t.id);
      const prefMap = new Map<number, string>(); // parameter_id -> product_id
      (prefs || []).forEach((pp: any) => prefMap.set(pp.parameter_id, pp.product_id));

      // 6) latest readings and slopes (last 14 days)
      const paramIds = (plist || []).map(p => p.id);
      // Fetch recent readings
      const { data: readings } = await supabase
        .from('readings')
        .select('*')
        .eq('tank_id', t.id)
        .in('parameter_id', paramIds)
        .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
        .order('measured_at', { ascending: true });
      const readingsByParam = new Map<number, Reading[]>();
      (readings || []).forEach((r: any) => {
        if (!readingsByParam.has(r.parameter_id)) readingsByParam.set(r.parameter_id, []);
        readingsByParam.get(r.parameter_id)!.push(r as Reading);
      });

      // 7) assemble bundles
      const initial: Record<number, ParamBundle> = {};
      for (const p of plist || []) {
        const arr = readingsByParam.get(p.id) || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        initial[p.id] = {
          param: p,
          productId: prefMap.get(p.id) ?? null,
          product: null,
          latest,
          dailySlope: slope,
          recommendedDailyMl: null,
          correctionMl: null,
          warnings: [],
          saltmix: '',
          wc20Result: latest,
        };
      }
      setBundles(initial);

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // compute recommendations when we have all pieces (tank, targets, product potency, etc.)
  const computeForParam = (pb: ParamBundle): ParamBundle => {
    if (!tank) return pb;
    const tankL = tank.volume_liters ?? tank.volume_value ?? 0;
    const warnings: string[] = [];
    let recommendedDailyMl: number | null = null;
    let correctionMl: number | null = null;
    let wc20Result: number | null = pb.latest;

    // find target for this param
    const tkey = pb.param.key as 'alk'|'ca'|'mg';
    const targetValue = targets ? (targets as any)[tkey] as number | null : null;
    const current = pb.latest;

    // daily consumption interpreted as positive when falling (consumption): -slope if slope < 0 else 0
    const consumptionPerDay = pb.dailySlope < 0 ? (-pb.dailySlope) : 0;

    // product potency
    const unitsPerMlPerL = pb.product
      ? potencyPerMlPerL({
          dose_ref_ml: pb.product.dose_ref_ml,
          delta_ref_value: pb.product.delta_ref_value,
          volume_ref_liters: pb.product.volume_ref_liters,
        })
      : null;

    if (unitsPerMlPerL != null && tankL > 0) {
      if (consumptionPerDay > 0) {
        recommendedDailyMl = doseMlForDelta(consumptionPerDay, unitsPerMlPerL, tankL);
      } else {
        recommendedDailyMl = 0;
      }
    }

    if (current != null && targetValue != null && unitsPerMlPerL != null && tankL > 0) {
      const delta = targetValue - current;
      // Only suggest correction when below target (positive delta)
      if (delta > 0) {
        correctionMl = doseMlForDelta(delta, unitsPerMlPerL, tankL);
      } else if (delta < 0) {
        // Above target: suggest hold/reduce
        warnings.push('Above target — hold dosing or consider a partial water change.');
      }
      // near target guardrail
      const thr = nearThreshold[tkey];
      if (Math.abs(delta) <= thr) {
        warnings.push('Near target — maintain current dosing; avoid big corrections.');
      }
    }

    // 20% water change preview if user filled saltmix baseline
    if (current != null && pb.saltmix.trim() !== '') {
      const sm = Number(pb.saltmix);
      if (isFinite(sm)) wc20Result = waterChangeResult(current, sm, 0.2);
    }

    return { ...pb, recommendedDailyMl, correctionMl, warnings, wc20Result };
  };

  const recomputeAll = (state: Record<number, ParamBundle>) => {
    const next: Record<number, ParamBundle> = {};
    for (const [pid, pb] of Object.entries(state)) {
      next[Number(pid)] = computeForParam(pb as ParamBundle);
    }
    return next;
  };

  useEffect(() => {
    // when targets/tank/bundles change, recompute
    setBundles(prev => recomputeAll(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tank?.volume_liters, targets]);

  const setBundle = (parameter_id: number, patch: Partial<ParamBundle>) => {
    setBundles(prev => {
      const merged = { ...prev[parameter_id], ...patch } as ParamBundle;
      const next = { ...prev, [parameter_id]: merged };
      return recomputeAll(next);
    });
  };

  const onSelectProduct = async (parameter_id: number, productId: string | null, product?: Product | null) => {
    if (!tank) return;
    setBundle(parameter_id, { productId, product: product ?? null });
    // Persist selection into preferred_products so it sticks across sessions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !productId) return;
    await supabase.from('preferred_products').upsert({
      user_id: user.id, tank_id: tank.id, parameter_id, product_id: productId
    }, { onConflict: 'user_id,tank_id,parameter_id' });
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  const paramById = new Map(params.map(p => [p.id, p]));

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">
        Recommends daily dose from recent consumption and a gentle correction if below target.
        Set your targets on the Dashboard. Only Alkalinity, Calcium, and Magnesium are considered here.
      </p>

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
          return (
            <section key={p.id} className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">{p.display_name}</h3>

              <ProductSelectInline
                tank={tank}
                parameter={p}
                value={pb.productId}
                onChange={(id, prod) => onSelectProduct(p.id, id, prod)}
              />

              <div className="text-sm space-y-1">
                <div>Latest reading: {pb.latest ?? '—'} {p.unit}</div>
                <div>Target: {targetValue ?? '—'} {p.unit}</div>
                <div>Trend (7–14 days): {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
              </div>

              <div className="text-sm rounded-md bg-gray-50 p-2">
                <div>
                  <span className="font-medium">Daily dose:</span>{' '}
                  {pb.recommendedDailyMl != null ? `${pb.recommendedDailyMl.toFixed(2)} ml/day` : '—'}
                </div>
                <div>
                  <span className="font-medium">Correction:</span>{' '}
                  {pb.correctionMl != null ? `${pb.correctionMl.toFixed(2)} ml now` : '—'}
                </div>
              </div>

              <div className="text-xs text-amber-700 space-y-1">
                {pb.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Salt mix baseline ({p.unit}) for 20% WC preview</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={pb.saltmix}
                  onChange={(e) => setBundle(p.id, { saltmix: e.target.value })}
                  placeholder={tkey === 'alk' ? '8.0' : (tkey === 'ca' ? '430' : '1350')}
                />
                <div className="text-xs text-gray-600">
                  After 20% water change: {pb.wc20Result != null ? `${pb.wc20Result.toFixed(2)} ${p.unit}` : '—'}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
