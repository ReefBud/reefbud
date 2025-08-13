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
  dailySlope: number; // units/day, >0 rising
  recommendedDailyMl: number | null;
  correctionMl: number | null;
  warnings: string[];
  currentDailyMl: string; // user input
  adjustmentMl: number | null; // recommended - current
};

const PARAM_KEYS: Array<'alk' | 'ca' | 'mg'> = ['alk','ca','mg'];

function lsKey(userId: string, tankId: string, paramKey: string) {
  return `rb:dose:${userId}:${tankId}:${paramKey}`;
}

export default function CalculatorPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Parameter[]>([]);
  const [targets, setTargets] = useState<TargetRow | null>(null);
  const [bundles, setBundles] = useState<Record<number, ParamBundle>>({}); // by parameter_id
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
      setUserId(user.id);

      // 2) find/create first tank
      const { data: tanks, error: terr } = await supabase
        .from('tanks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
      if (terr) { setErr(terr.message); setLoading(false); return; }
      let t = (tanks && tanks[0]) as Tank | undefined;
      if (!t) {
        const { data: created, error: cerr } = await supabase
          .from('tanks')
          .insert({ user_id: user.id, name: 'My Tank', volume_value: 200, volume_unit: 'L', volume_liters: 200 })
          .select('*').single();
        if (cerr) { setErr(cerr.message); setLoading(false); return; }
        t = created as unknown as Tank;
      }
      if (!mounted) return;
      setTank(t!);

      // 3) params (Alk, Ca, Mg only)
      const { data: plist, error: perr } = await supabase
        .from('parameters').select('*').in('key', PARAM_KEYS).order('id', { ascending: true });
      if (perr) { setErr(perr.message); setLoading(false); return; }
      const byKey: Record<string, Parameter> = {};
      (plist || []).forEach(p => byKey[p.key] = p);
      setParams(plist || []);

      // 4) targets (from Dashboard table)
      const { data: tgt } = await supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle();
      setTargets(tgt as TargetRow | null);

      // 5) latest results + trends (use Results table; last 14 days)
      const paramIds = (plist || []).map(p => p.id);
      const { data: res } = await supabase
        .from('results')
        .select('*')
        .eq('tank_id', t!.id)
        .in('parameter_id', paramIds)
        .gte('measured_at', new Date(Date.now() - 14*24*60*60*1000).toISOString())
        .order('measured_at', { ascending: true });

      const readingsByParam = new Map<number, Reading[]>();
      (res || []).forEach((r: any) => {
        if (!readingsByParam.has(r.parameter_id)) readingsByParam.set(r.parameter_id, []);
        readingsByParam.get(r.parameter_id)!.push(r as Reading);
      });

      // 6) preferred products
      const { data: prefs } = await supabase
        .from('preferred_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('tank_id', t!.id);
      const prefMap = new Map<number, string>();
      (prefs || []).forEach((pp: any) => prefMap.set(pp.parameter_id, pp.product_id));

      // 7) assemble bundles
      const initial: Record<number, ParamBundle> = {};
      for (const p of (plist || [])) {
        const arr = readingsByParam.get(p.id) || [];
        const latest = arr.length ? arr[arr.length - 1].value : null;
        const { slopePerDay: slope } = slopePerDay(arr.map(x => ({ value: x.value, measured_at: x.measured_at })));
        // load current daily dose from localStorage
        let currentDailyMl = '';
        try {
          const k = lsKey(user.id, t!.id, p.key);
          const v = localStorage.getItem(k);
          if (v != null) currentDailyMl = v;
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
          currentDailyMl,
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

    // find target for this param
    const tkey = pb.param.key as 'alk'|'ca'|'mg';
    const targetValue = targets ? (targets as any)[tkey] as number | null : null;
    const current = pb.latest;

    // daily consumption from trend (use only negative slope as consumption)
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
      if (delta > 0) {
        correctionMl = doseMlForDelta(delta, unitsPerMlPerL, tankL);
      } else if (delta < 0) {
        warnings.push('Above target — hold/reduce dosing.');
      }
      const thr = nearThreshold[tkey];
      if (Math.abs(delta) <= thr) warnings.push('Near target — maintain; avoid big corrections.');
    }

    // current daily dose and adjustment
    const cur = parseFloat(pb.currentDailyMl);
    if (isFinite(cur) && recommendedDailyMl != null) {
      adjustmentMl = recommendedDailyMl - cur;
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
    if (!tank || !userId) return;
    setBundle(parameter_id, { productId, product: product ?? null });
    if (!productId) return;
    await supabase.from('preferred_products').upsert({
      user_id: userId, tank_id: tank.id, parameter_id, product_id: productId
    }, { onConflict: 'user_id,tank_id,parameter_id' });
  };

  const onCurrentDoseChange = (parameter_id: number, paramKey: string, v: string) => {
    setBundle(parameter_id, { currentDailyMl: v });
    try {
      if (userId && tank) localStorage.setItem(lsKey(userId, tank.id, paramKey), v);
    } catch {}
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>Loading…</p></main>;
  if (err) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p className="text-red-600">{err}</p></main>;
  if (!tank) return <main className="p-4"><h1 className="text-2xl font-semibold">Calculator</h1><p>No tank found.</p></main>;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <p className="text-sm text-gray-600">
        Uses your Dashboard targets and latest Results to compute daily dosing and a gentle correction.
        Only Alkalinity, Calcium, and Magnesium are included.
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
                <div>Target (Dashboard): {targetValue ?? '—'} {p.unit}</div>
                <div>Trend (14d): {pb.dailySlope > 0 ? '+' : ''}{pb.dailySlope.toFixed(3)} {p.unit}/day</div>
              </div>

              <div className="text-sm rounded-md bg-gray-50 p-2 space-y-1">
                <div>
                  <span className="font-medium">Recommended daily dose:</span>{' '}
                  {pb.recommendedDailyMl != null ? `${pb.recommendedDailyMl.toFixed(2)} ml/day` : '—'}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Your current daily dose (ml/day)</label>
                  <input
                    className="w-24 rounded-md border px-2 py-1"
                    inputMode="numeric"
                    value={pb.currentDailyMl}
                    onChange={(e) => onCurrentDoseChange(p.id, p.key, e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="e.g. 20"
                  />
                </div>
                <div>
                  <span className="font-medium">Adjustment:</span>{' '}
                  {pb.adjustmentMl != null ? `${pb.adjustmentMl >= 0 ? '+' : ''}${pb.adjustmentMl.toFixed(2)} ml/day` : '—'}
                </div>
                <div>
                  <span className="font-medium">Correction (to reach target):</span>{' '}
                  {pb.correctionMl != null ? `${pb.correctionMl.toFixed(2)} ml now` : '—'}
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
