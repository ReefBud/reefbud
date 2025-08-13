'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { saveTargetsUpsert } from './saveTargetsUpsert';

type TankRow = {
  id: string;
  name: string | null;
  volume_value: number | null;   // what your UI edits
  volume_unit: 'L' | 'gal' | null;
  volume_liters: number | null;  // normalized by DB trigger
};

export default function DashboardPage() {
  const [tank, setTank] = useState<TankRow | null>(null);

  const [alk, setAlk] = useState<string>('');
  const [ca, setCa] = useState<string>('');
  const [mg, setMg] = useState<string>('');
  const [po4, setPo4] = useState<string>('');
  const [no3, setNo3] = useState<string>('');
  const [sal, setSal] = useState<string>(''); // ppt

  const [volValue, setVolValue] = useState<string>('');
  const [volUnit, setVolUnit] = useState<'L' | 'gal'>('L');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErr('Please sign in.');
      return;
    }

    // Load or create a tank for this user (keep your existing behavior)
    const { data: tanks, error } = await supabase
      .from('tanks')
      .select('id, name, volume_value, volume_unit, volume_liters')
      .eq('user_id', user.id)
      .limit(1);

    if (error) { setErr(error.message); return; }

    let row: TankRow | null = (tanks?.[0] as any) ?? null;

    if (!row) {
      const { data: created, error: createErr } = await supabase
        .from('tanks')
        .insert([{ user_id: user.id, name: 'My Tank', volume_value: null, volume_unit: 'L' }])
        .select('id, name, volume_value, volume_unit, volume_liters')
        .limit(1);

      if (createErr) { setErr(createErr.message); return; }
      row = (created?.[0] as any) ?? null;
    }

    setTank(row);
    setVolValue(row?.volume_value?.toString() ?? '');
    setVolUnit((row?.volume_unit as any) ?? 'L');

    // Load single-row targets
    const { data: tgt, error: tErr } = await supabase
      .from('targets')
      .select('alk, ca, mg, po4, no3, salinity')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tErr) {
      // no row yet is fine
    } else if (tgt) {
      setAlk(tgt.alk?.toString() ?? '');
      setCa(tgt.ca?.toString() ?? '');
      setMg(tgt.mg?.toString() ?? '');
      setPo4(tgt.po4?.toString() ?? '');
      setNo3(tgt.no3?.toString() ?? '');
      setSal(tgt.salinity?.toString() ?? '');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveAll() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in.');

      // 1) Save tank volume (trigger will normalize volume_liters)
      if (!tank) throw new Error('No tank found.');
      const { error: upErr } = await supabase.from('tanks').update({
        volume_value: volValue !== '' ? Number(volValue) : null,
        volume_unit: volUnit,
      }).eq('id', tank.id);
      if (upErr) throw upErr;

      // 2) Save targets to single-row table
      await saveTargetsUpsert({
        userId: user.id,
        alk: alk !== '' ? Number(alk) : null,
        ca: ca !== '' ? Number(ca) : null,
        mg: mg !== '' ? Number(mg) : null,
        po4: po4 !== '' ? Number(po4) : null,
        no3: no3 !== '' ? Number(no3) : null,
        salinity: sal !== '' ? Number(sal) : null,
      });

      setMsg('Saved.');
      await load(); // refresh to show normalized liters etc.
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className=\"mx-auto max-w-3xl p-4 space-y-4\">
      <h1 className=\"text-xl font-semibold\">Dashboard</h1>

      {/* Tank volume */}
      <section className=\"rounded-md border p-4 space-y-3\">
        <h2 className=\"font-medium\">Tank Volume</h2>
        <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-3\">
          <label className=\"text-sm\">
            <span className=\"mb-1 block opacity-75\">Value</span>
            <input
              type=\"number\"
              step=\"any\"
              value={volValue}
              onChange={e => setVolValue(e.target.value)}
              className=\"w-full rounded-md border px-2 py-1.5\"
            />
          </label>
          <label className=\"text-sm\">
            <span className=\"mb-1 block opacity-75\">Unit</span>
            <select
              className=\"w-full rounded-md border px-2 py-1.5\"
              value={volUnit}
              onChange={e => setVolUnit(e.target.value as 'L' | 'gal')}
            >
              <option value=\"L\">L</option>
              <option value=\"gal\">gal</option>
            </select>
          </label>
          <div className=\"text-sm self-end\">
            <div className=\"opacity-75\">Normalized (liters)</div>
            <div className=\"font-medium\">{tank?.volume_liters ?? '—'}</div>
          </div>
        </div>
      </section>

      {/* Target Parameters */}
      <section className=\"rounded-md border p-4 space-y-3\">
        <h2 className=\"font-medium\">Target Parameters</h2>

        <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-3\">
          <Field label=\"Alkalinity (dKH)\" value={alk} setValue={setAlk} />
          <Field label=\"Calcium (ppm)\" value={ca} setValue={setCa} />
          <Field label=\"Magnesium (ppm)\" value={mg} setValue={setMg} />
          <Field label=\"Phosphate (ppm)\" value={po4} setValue={setPo4} />
          <Field label=\"Nitrate (ppm)\" value={no3} setValue={setNo3} />
          <Field label=\"Salinity (ppt)\" value={sal} setValue={setSal} />
        </div>
      </section>

      <div className=\"flex items-center gap-3\">
        <button
          onClick={saveAll}
          disabled={busy}
          className=\"rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60\"
        >
          {busy ? 'Saving…' : 'Save tank & targets'}
        </button>
        {msg && <span className=\"text-green-700 text-sm\">{msg}</span>}
        {err && <span className=\"text-red-600 text-sm\">Error: {err}</span>}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
}) {
  return (
    <label className=\"text-sm\">
      <span className=\"mb-1 block opacity-75\">{label}</span>
      <input
        type=\"number\"
        step=\"any\"
        value={value}
        onChange={e => setValue(e.target.value)}
        className=\"w-full rounded-md border px-2 py-1.5 bg-[linear-gradient(#fafafa,#f3f4f6)]\"
      />
    </label>
  );
}
