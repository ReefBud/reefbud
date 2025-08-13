'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Simple 3-line calculator
 * - Parameters: ALK, MG, CA
 * - Target: single-row `targets` table (user_id keyed)
 * - Current: latest `readings` per parameter for the user's main tank
 * - Current Daily Dose: inferred from consumption using last N readings and product potency
 * - New Dose: current daily dose plus gentle correction toward target with guardrails
 */

type Targets = {
  alk: number | null;
  ca: number | null;
  mg: number | null;
  po4?: number | null;
  no3?: number | null;
  salinity?: number | null;
};

type Tank = {
  id: string;
  volume_liters: number | null;
  volume_value?: number | null;
  volume_unit?: string | null;
};

type Reading = {
  parameter_key: 'alk'|'ca'|'mg';
  value: number;
  measured_at: string; // ISO
};

type ProductRow = {
  parameter_key: 'alk'|'ca'|'mg';
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
};

// Guardrails (per day changes)
const CAP = {
  alk: 0.25,   // dKH/day
  ca: 25,      // ppm/day
  mg: 100,     // ppm/day
};

// Helper to compute potency (delta per ml per L)
function potencyPerMlPerL(prod?: ProductRow | null): number | null {
  if (!prod) return null;
  const { dose_ref_ml, delta_ref_value, volume_ref_liters } = prod;
  if (!dose_ref_ml || !delta_ref_value || !volume_ref_liters) return null;
  const ppmPerMlPerL = delta_ref_value / (dose_ref_ml * volume_ref_liters);
  return ppmPerMlPerL; // units: (param units) per ml per L
}

// Compute ml needed to change `changeValue` in a tank of `liters` given potency
function mlForChange(changeValue: number, liters: number, potency: number): number {
  // changeValue (param units) = ml * potency * liters
  // ml = changeValue / (potency * liters)
  const denom = potency * Math.max(1e-9, liters);
  return changeValue / denom;
}

export default function CalculatorPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [latest, setLatest] = useState<Record<'alk'|'ca'|'mg', Reading | null>>({
    alk: null, ca: null, mg: null,
  });
  const [history, setHistory] = useState<Record<'alk'|'ca'|'mg', Reading[]>>({
    alk: [], ca: [], mg: [],
  });
  const [products, setProducts] = useState<Record<'alk'|'ca'|'mg', ProductRow | null>>({
    alk: null, ca: null, mg: null,
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Please sign in.'); return; }

    // 1) Tank (liters)
    const { data: tankRow, error: tErr } = await supabase
      .from('tanks')
      .select('id, volume_liters, volume_value, volume_unit')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (tErr) { setErr(tErr.message); return; }
    const liters = (() => {
      if (!tankRow) return null;
      if (tankRow.volume_liters != null) return Number(tankRow.volume_liters);
      if (tankRow.volume_value != null) {
        const val = Number(tankRow.volume_value);
        const unit = (tankRow.volume_unit || 'L').toString().toLowerCase();
        return unit === 'gal' ? val * 3.78541 : val;
      }
      return null;
    })();
    setTank(tankRow ? { id: tankRow.id, volume_liters: liters } : null);

    // 2) Targets (single-row)
    const { data: tgts, error: gErr } = await supabase
      .from('targets')
      .select('alk, ca, mg')
      .eq('user_id', user.id)
      .maybeSingle();
    if (gErr) { setErr(gErr.message); return; }
    setTargets({
      alk: toNum(tgts?.alk),
      ca: toNum(tgts?.ca),
      mg: toNum(tgts?.mg),
    });

    // 3) Preferred product potencies (join preferred_products -> products -> parameters)
    // Expect a view or join via RPC; here we’ll do two queries for simplicity.
    // a) get parameter ids/keys
    const { data: params } = await supabase
      .from('parameters')
      .select('id, key')
      .in('key', ['alk','ca','mg']);
    const mapKeyToId: Record<string, number> = {};
    const mapIdToKey: Record<number, 'alk'|'ca'|'mg'> = {} as any;
    (params ?? []).forEach((p: any) => { mapKeyToId[p.key] = p.id; mapIdToKey[p.id] = p.key; });

    // b) find preferred product per key (for first tank)
    let preferred: Record<'alk'|'ca'|'mg', ProductRow | null> = { alk: null, ca: null, mg: null };
    if (tankRow) {
      const { data: pp } = await supabase
        .from('preferred_products')
        .select('parameter_id, product_id')
        .eq('user_id', user.id)
        .eq('tank_id', tankRow.id);
      const productIds = (pp ?? []).map((r: any) => r.product_id);
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, dose_ref_ml, delta_ref_value, volume_ref_liters, parameter_id');
        // Note: RLS on products allows global (user_id null) + user-owned, as you configured
        const byId: Record<string, any> = {};
        (prods ?? []).forEach((p: any) => { byId[p.id] = p; });
        (pp ?? []).forEach((row: any) => {
          const key = mapIdToKey[row.parameter_id];
          const p = byId[row.product_id];
          if (key && p) {
            preferred[key] = {
              parameter_key: key,
              dose_ref_ml: toNum(p.dose_ref_ml),
              delta_ref_value: toNum(p.delta_ref_value),
              volume_ref_liters: toNum(p.volume_ref_liters),
            };
          }
        });
      }
    }
    setProducts(preferred);

    // 4) Readings (latest and history window)
    if (tankRow) {
      // Get last 21 days to compute slope
      const since = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString();
      const { data: readings } = await supabase
        .from('readings')
        .select('parameter_id, value, measured_at')
        .eq('user_id', user.id)
        .eq('tank_id', tankRow.id)
        .gte('measured_at', since)
        .order('measured_at', { ascending: true });
      const byKey: Record<'alk'|'ca'|'mg', Reading[]> = { alk: [], ca: [], mg: [] };
      (readings ?? []).forEach((r: any) => {
        const key = mapIdToKey[r.parameter_id];
        if (key) byKey[key].push({ parameter_key: key, value: Number(r.value), measured_at: r.measured_at });
      });
      setHistory(byKey);
      setLatest({
        alk: lastOrNull(byKey.alk),
        ca: lastOrNull(byKey.ca),
        mg: lastOrNull(byKey.mg),
      });
    }
  }

  const lines = useMemo(() => {
    if (!tank?.volume_liters) return null;
    const L = tank.volume_liters;

    const out: { key: 'alk'|'mg'|'ca'; label: string; current: number|null; target: number|null; currentDose: number|null; newDose: number|null; note?: string }[] = [];

    (['alk','mg','ca'] as const).forEach((key) => {
      const current = latest[key]?.value ?? null;
      const target = (targets as any)?.[key] ?? null;

      // Potency
      const pot = potencyPerMlPerL(products[key]);
      // Consumption per day from history (positive means tank is using it daily)
      const cons = consumptionPerDay(history[key]);
      // Current daily dose in ml/day to maintain: convert consumption to ml/day
      const currentDose = (pot && L && cons && cons > 0) ? mlForChange(cons, L, pot) : 0;

      // Correction toward target (units/day), capped
      let correctionUnitsPerDay = 0;
      if (current != null && target != null) {
        const diff = target - current; // positive means we need to raise
        const cap = CAP[key];
        if (diff > 0) correctionUnitsPerDay = Math.min(diff, cap);
        else if (diff < 0) {
          // above target: reduce — simplest rule is to pause dosing
          correctionUnitsPerDay = diff; // negative; we'll clamp later
        }
      }

      let newDose = currentDose;
      let note = '';

      if (pot && L && correctionUnitsPerDay !== 0) {
        const correctionMl = mlForChange(Math.abs(correctionUnitsPerDay), L, pot);
        if (correctionUnitsPerDay > 0) {
          newDose = currentDose + correctionMl;
          note = `+${round(correctionMl)} ml/day to rise ~${round(correctionUnitsPerDay)} ${unit(key)}/day`;
        } else {
          // reduce dose; don't go below 0
          newDose = Math.max(0, currentDose - correctionMl);
          note = `-${round(correctionMl)} ml/day to fall ~${round(Math.abs(correctionUnitsPerDay))} ${unit(key)}/day`;
        }
      }

      out.push({
        key,
        label: label(key),
        current,
        target,
        currentDose: isFiniteNum(currentDose) ? currentDose : null,
        newDose: isFiniteNum(newDose) ? newDose : null,
        note
      });
    });

    return out;
  }, [tank, targets, latest, products, history]);

  const issues = useMemo(() => {
    const msgs: string[] = [];
    if (!tank?.volume_liters) msgs.push('Tank volume unknown.');
    if (!targets) msgs.push('No targets saved.');
    // If any product potency is missing, warn
    (['alk','ca','mg'] as const).forEach(k => {
      if (!potencyPerMlPerL(products[k])) msgs.push(`${label(k)} product potency unknown.`);
      if (!latest[k]) msgs.push(`No recent reading for ${label(k)}.`);
    });
    return Array.from(new Set(msgs)).join(' ');
  }, [tank, targets, products, latest]);

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Calculator</h1>

      {issues && issues.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {issues}
        </div>
      ) : null}

      <section className="rounded-md border p-4 space-y-2">
        <h2 className="font-medium">Simple Plan</h2>
        <p className="text-xs opacity-70">Guardrails: ≤ 0.25 dKH/day Alk, ≤ 25 ppm/day Ca, ≤ 100 ppm/day Mg.</p>
        <ul className="text-sm">
          {lines?.map((ln) => (
            <li key={ln.key} className="py-1">
              <b>{ln.label}</b> — {fmt(ln.current)} {unit(ln.key)} {'>'} {fmt(ln.target)} {unit(ln.key)} {'>'} Current Daily Dose {fmtMl(ln.currentDose)} = <b>{fmtMl(ln.newDose)}</b> {ln.note ? <span className="opacity-70">({ln.note})</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// Utilities
function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function label(k: 'alk'|'ca'|'mg') {
  return k === 'alk' ? 'Alkalinity' : k === 'ca' ? 'Calcium' : 'Magnesium';
}
function unit(k: 'alk'|'ca'|'mg') {
  return k === 'alk' ? 'dKH' : 'ppm';
}
function fmt(n?: number | null) {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : round(n);
}
function fmtMl(n?: number | null) {
  return n === null || n === undefined || Number.isNaN(n) ? '— ml/day' : `${round(n)} ml/day`;
}
function round(n: number, dp = 2) {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);
}
function isFiniteNum(n: any) {
  return typeof n === 'number' && Number.isFinite(n);
}
function lastOrNull<T>(arr: T[]): T | null {
  return arr.length ? arr[arr.length - 1] : null;
}

// Estimate consumption per day from history using simple slope over time
function consumptionPerDay(points: Reading[]): number | null {
  // Consumption is positive if the parameter is dropping over time
  if (!points || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const t0 = new Date(first.measured_at).getTime();
  const t1 = new Date(last.measured_at).getTime();
  const days = Math.max(1e-9, (t1 - t0) / (1000*3600*24));
  const delta = last.value - first.value; // if negative, it's being consumed
  const perDay = -delta / days; // make positive for consumption
  return perDay > 0 ? perDay : 0;
}
