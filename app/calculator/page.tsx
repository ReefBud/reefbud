'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Targets = {
  alk: number | null;
  ca: number | null;
  mg: number | null;
  po4: number | null;
  no3: number | null;
  salinity: number | null;
};

export default function CalculatorPage() {
  const [liters, setLiters] = useState<number | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Please sign in.'); return; }

    // Only select columns that actually exist in your DB:
    // volume_liters (canonical), volume_value + volume_unit (user input)
    const { data: tank, error: tErr } = await supabase
      .from('tanks')
      .select('volume_liters, volume_value, volume_unit')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (tErr) { setErr(tErr.message); return; }

    // If volume_liters missing, compute from value + unit
    let L: number | null = null;
    if (tank) {
      if (tank.volume_liters != null) {
        L = Number(tank.volume_liters);
      } else if (tank.volume_value != null) {
        const val = Number(tank.volume_value);
        const unit = (tank.volume_unit || 'L').toString().toLowerCase();
        L = unit === 'gal' ? val * 3.78541 : val;
      }
    }
    setLiters(Number.isFinite(L as number) ? (L as number) : null);

    // Single-row targets
    const { data: tgts, error: gErr } = await supabase
      .from('targets')
      .select('alk, ca, mg, po4, no3, salinity')
      .eq('user_id', user.id)
      .maybeSingle();

    if (gErr) { setErr(gErr.message); return; }
    if (tgts) {
      setTargets({
        alk: toNum(tgts.alk),
        ca: toNum(tgts.ca),
        mg: toNum(tgts.mg),
        po4: toNum(tgts.po4),
        no3: toNum(tgts.no3),
        salinity: toNum(tgts.salinity),
      });
    } else {
      setTargets(null);
    }
  }

  useEffect(() => { load(); }, []);

  const issues = useMemo(() => {
    const msgs: string[] = [];
    if (!liters || liters <= 0) msgs.push('Tank volume unknown.');
    if (!targets) msgs.push('No targets saved.');
    return msgs.join(' ');
  }, [liters, targets]);

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Calculator</h1>

      {issues && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {issues}
        </div>
      )}

      <section className="rounded-md border p-4">
        <h2 className="font-medium mb-2">Snapshot</h2>
        <ul className="text-sm space-y-1">
          <li><span className="opacity-70">Tank volume (L):</span> <span className="font-medium">{liters ?? '—'}</span></li>
          <li><span className="opacity-70">Targets:</span></li>
          <li className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            <span>Alk: <b>{fmt(targets?.alk)}</b> dKH</span>
            <span>Ca: <b>{fmt(targets?.ca)}</b> ppm</span>
            <span>Mg: <b>{fmt(targets?.mg)}</b> ppm</span>
            <span>PO₄: <b>{fmt(targets?.po4)}</b> ppm</span>
            <span>NO₃: <b>{fmt(targets?.no3)}</b> ppm</span>
            <span>Salinity: <b>{fmt(targets?.salinity)}</b> ppt</span>
          </li>
        </ul>
      </section>
    </main>
  );
}

function fmt(n?: number | null) {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : n;
}
function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
