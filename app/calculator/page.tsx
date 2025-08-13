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
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Please sign in.'); return; }

    // Tank liters: Calculator expects a liters field (we maintain it via DB trigger)
    const { data: tank, error: tErr } = await supabase
      .from('tanks')
      .select('volume_liters, volume, liters, tank_volume, size_liters')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (tErr) { setErr(tErr.message); return; }

    const L = (tank as any)?.volume_liters
      ?? (tank as any)?.volume
      ?? (tank as any)?.liters
      ?? (tank as any)?.tank_volume
      ?? (tank as any)?.size_liters
      ?? null;
    setLiters(typeof L === 'number' ? L : (L ? Number(L) : null));

    // Single-row targets
    const { data: tgts, error: gErr } = await supabase
      .from('targets')
      .select('alk, ca, mg, po4, no3, salinity')
      .eq('user_id', user.id)
      .maybeSingle();

    if (gErr) { setErr(gErr.message); return; }
    setTargets({
      alk: nullableNum((tgts as any)?.alk),
      ca: nullableNum((tgts as any)?.ca),
      mg: nullableNum((tgts as any)?.mg),
      po4: nullableNum((tgts as any)?.po4),
      no3: nullableNum((tgts as any)?.no3),
      salinity: nullableNum((tgts as any)?.salinity),
    });
  }

  useEffect(() => { load(); }, []);

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!liters || liters <= 0) out.push('Tank volume unknown.');
    if (!targets) out.push('No targets saved.');
    // your existing checks for readings and preferred products remain elsewhere
    return out.join(' ');
  }, [liters, targets]);

  return (
    <main className=\"mx-auto max-w-3xl p-4 space-y-4\">
      <h1 className=\"text-xl font-semibold\">Calculator</h1>
      {issues && issues.length > 0 ? (
        <div className=\"rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900\">
          {issues}
        </div>
      ) : null}

      <section className=\"rounded-md border p-4\">
        <h2 className=\"font-medium mb-2\">Snapshot</h2>
        <ul className=\"text-sm space-y-1\">
          <li><span className=\"opacity-70\">Tank volume (L):</span> <span className=\"font-medium\">{liters ?? '—'}</span></li>
          <li><span className=\"opacity-70\">Targets:</span></li>
          <li className=\"grid grid-cols-2 sm:grid-cols-3 gap-1\">
            <span>Alk: <b>{fmt(targets?.alk)}</b> dKH</span>
            <span>Ca: <b>{fmt(targets?.ca)}</b> ppm</span>
            <span>Mg: <b>{fmt(targets?.mg)}</b> ppm</span>
            <span>PO₄: <b>{fmt(targets?.po4)}</b> ppm</span>
            <span>NO₃: <b>{fmt(targets?.no3)}</b> ppm</span>
            <span>Salinity: <b>{fmt(targets?.salinity)}</b> ppt</span>
          </li>
        </ul>
      </section>

      {/* Your dosing math UI remains here; this file’s focus is reading liters + targets */}
      {msg && <div className=\"text-green-700 text-sm\">{msg}</div>}
      {err && <div className=\"text-red-600 text-sm\">Error: {err}</div>}
    </main>
  );
}

function fmt(n?: number | null) {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : n;
}
function nullableNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
