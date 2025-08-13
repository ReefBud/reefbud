'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Parameter, Tank, TargetRow, Product, Reading } from '@/lib/types';
import ProductSelectInline from '@/app/components/ProductSelectInline';
import { potencyPerMlPerL, doseMlForDelta, slopePerDay, nearThreshold } from '@/lib/doseMath';

type ParamBundle = {
  param: Parameter;
  productId: string | null;
  product: Product | null;
  latest: number | null;
  dailySlope: number;
  recommendedDailyMl: number | null;
  correctionMl: number | null;
  warnings: string[];
  yourDailyMl: string; // user input, persisted to localStorage
  adjustmentMl: number | null; // recommendedDailyMl - yourDailyMl
};

const PARAM_KEYS: Array<'alk' | 'ca' | 'mg'> = ['alk','ca','mg'];

export default function CalculatorPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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

      // Parameters (only Alk/Ca/Mg)
      const { data: plist, error: perr } = await supabase.from('parameters').select('*').in('key', PARAM_KEYS);
      if (perr) { setErr(perr.message); setLoading(false); return; }
      setParams(plist || []);

      // Targets
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // Preferred products
      const { data: prefs } = await supabase
        .from('preferred_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('tank_id', t.id);

      const prefMap = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefMap.set(pp.parameter_id, pp.product_id));

      // Latest readings + slopes from RESULTS table (not 'readings')
      const paramIds = (plist || []).map(p => p.id);
      const sinceISO = new Date(Date.now() - 14*24*60*60*1000).toISOString();
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .eq('tank_id', t.id)
        .in('parameter_id', paramIds)
        .gte('measured_at', sinceISO)
        .order('measured_at', { ascending: true });

      // Group by parameter and compute latest + slope
      const byParam = new Map<number, Reading[]>();
      (results || []).forEach((r: any) => {
        const pid = r.parameter_id;
        if (!byParam.has(pid)) byParam.set(pid, []);
        byParam.get(pid)!.push({ id: r.id, user_id: r.user_id, tank_id: r.tank_id, parameter_id: r.parameter_id, value: r.value, measured_at: r.measured_at } as any);
      });

      const initial: Record<number, ParamBundle> = {};
      for (const p of plist || []) {
        const arr = byParam.get(p.id) || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        // hydrate yourDailyMl from localStorage
        let yourDailyMl = '';
        try {
          const key = `rb:dailyDose:${user.id}:${t.id}:${p.id}`;
          const saved = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
          if (saved) yourDailyMl = saved;
        } catch {}
        initial[p.id] = {
          param: p,
          productId: prefMap.get(p.id) ?? null,
          product: null,
          latest,
          dailySlope: slope,
          recommendedDailyMl: null,
          correctionMl: null,
          warnings: [],
          yourDailyMl,
          adjustmentMl: null,
        };
      }
      setBundles(initial);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const computeForParam = (pb: ParamBundle): ParamBundle => {
    if (!tank) return pb;
    const tankL = tank.volume_liters ?? tank.volume_value ?? 0;
    const warnings: string[] = [];
    let recommendedDailyMl: number | null = null;
    let correctionMl: number | null = null;
    let adjustmentMl: number | null = null;

    const tkey = pb.param.key as 'alk'|'ca'|'mg';
    const targetValue = targets ? (targets as any)[tkey] as number | null : null;
    const current = pb.latest;

    // falling values => consumption
    const consumptionPerDay = pb.dailySlope < 0 ? (-pb.dailySlope) : 0;

    const unitsPerMlPerL = pb.product
      ? potencyPerMlPerL({
          dose_ref_ml: pb.product.dose_ref_ml,
          delta_ref_value: pb.product.delta_ref_value,
          volume_ref_liters: pb.product.volume_ref_liters,
        })
      : null;

    if (unitsPerMlPerL != null && tankL > 0) {
      // daily maintenance dose from consumption
      recommendedDailyMl = consumptionPerDay > 0
        ? doseMlForDelta(consumptionPerDay, unitsPerMlPerL, tankL)
        : 0;
    }

    if (current != null && targetValue != null && unitsPerMlPerL != null && tankL > 0) {
      const delta = targetValue - current;
      if (delta > 0) {
        correctionMl = doseMlForDelta(delta, unitsPerMlPerL, tankL);
      } else if (delta < 0) {
        warnings.push('Above target — hold dosing.');
      }
      const thr = nearThreshold[tkey];
      if (Math.abs(delta) <= thr) {
        warnings.push('Near target — avoid big corrections.');
      }
    }

    // Adjustment relative to user's current baseline dose
    if (recommendedDailyMl != null) {
      const baseline = Number(pb.yourDailyMl);
      if (isFinite(baseline)) {
        adjustmentMl = recommendedDailyMl - baseline;
      }
    }

    return { ...pb, recommendedDailyMl, correctionMl, warnings, adjustmentMl };
  };

  const recomputeAll = (state: Record<number, ParamBundle>) => {
    const next: Record<number, ParamBundle> = {};
    for (const [pid, pb] of Object.entries(state)) {
      next[Number(pid)] = computeForParam(pb as ParamBundle);
    }
    return next;
  };

  useEffect(() => {
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !productId) return;
    await supabase.from('preferred_products').upsert({
      user_id: user.id, tank_id: tank.id, parameter_id, product_id: productId
    }, { onConflict: 'user_id,tank_id,parameter_id' });
  };

  const onYourDailyChange = (parameter_id: number, val: string) => {
    setBundle(parameter_id, { yourDailyMl: val });
    try {
      if (!userId || !tank) return;
      const key = `rb:dailyDose:${userId}:${tank.id}:${parameter_id}`;
      window.localStorage.setItem(key, val);
    } catch {}
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">
        Uses your latest <strong>Results</strong>, targets, and product potency to recommend daily dose and a gentle correction.
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
                <div>Latest reading (from Results): {pb.latest ?? '—'} {p.unit}</div>
                <div>Target: {targetValue ?? '—'} {p.unit}</div>
                <div>Trend (14 days): {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Your current daily dose (ml/day)</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={pb.yourDailyMl}
                  onChange={(e) => onYourDailyChange(p.id, e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="e.g. 4"
                />
              </div>

              <div className="text-sm rounded-md bg-gray-50 p-2 space-y-1">
                <div>
                  <span className="font-medium">Recommended daily dose:</span>{' '}
                  {pb.recommendedDailyMl != null ? `${pb.recommendedDailyMl.toFixed(2)} ml/day` : '—'}
                </div>
                <div>
                  <span className="font-medium">Correction (if below target):</span>{' '}
                  {pb.correctionMl != null ? `${pb.correctionMl.toFixed(2)} ml now` : '—'}
                </div>
                <div>
                  <span className="font-medium">Adjustment vs your dose:</span>{' '}
                  {pb.adjustmentMl != null ?
                    `${pb.adjustmentMl >= 0 ? '+' : ''}${pb.adjustmentMl.toFixed(2)} ml/day` : '—'}
                </div>
              </div>

              <div className="text-xs text-amber-700 space-y-1">
                {pb.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
