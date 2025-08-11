'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Targets = {
  alk?: number | null;
  ca?: number | null;
  mg?: number | null;
  po4?: number | null;
  no3?: number | null;
  salinity?: number | null;
};

type Tank = { id: string; name?: string | null; volume_value?: number | null; volume_unit?: 'L'|'gal'|null };

export default function Dashboard(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [tank, setTank] = useState<Tank | null>(null);
  const [tankName, setTankName] = useState<string>('');
  const [tankVol, setTankVol] = useState<string>('');
  const [tankUnit, setTankUnit] = useState<'L'|'gal'>('L');

  const [targets, setTargets] = useState<Targets>({});
  const [paramMap, setParamMap] = useState<Record<string, number>>({});

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-3 py-2 shadow-sm ' +
    'bg-gradient-to-b from-gray-50 to-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400';

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: { user } = { user: null } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1) Ensure a tank exists for this user
      const { data: tanks } = await supabase
        .from('tanks')
        .select('id,name,volume_value,volume_unit')
        .eq('user_id', user.id)
        .limit(1);

      let tk: Tank | null = (tanks && tanks[0]) ? (tanks[0] as Tank) : null;
      if (!tk) {
        const { data: created, error } = await supabase
          .from('tanks')
          .insert({ user_id: user.id, name: 'My Tank', volume_value: 200, volume_unit: 'L' })
          .select()
          .single();
        if (error || !created) { setLoading(false); return; }
        tk = created as Tank;
      }
      if (!live) return;
      setTank(tk);
      setTankName(tk.name ?? 'My Tank');
      setTankVol(tk.volume_value != null ? String(tk.volume_value) : '');
      setTankUnit((tk.volume_unit as 'L'|'gal') ?? 'L');

      // 2) Load parameter ids
      const { data: params } = await supabase.from('parameters').select('id,key');
      const map: Record<string, number> = {};
      (params ?? []).forEach((p: any) => { map[p.key] = p.id; });
      if (!live) return;
      setParamMap(map);

      // 3) Load existing targets for this tank
      const { data: tgs } = await supabase
        .from('targets')
        .select('parameter_id,target_value')
        .eq('tank_id', tk.id);

      const byId: Record<number, number> = {};
      (tgs ?? []).forEach((t: any) => { byId[t.parameter_id] = Number(t.target_value); });

      const nextTargets: Targets = {
        alk: byId[map['alk']],
        ca: byId[map['ca']],
        mg: byId[map['mg']],
        po4: byId[map['po4']],
        no3: byId[map['no3']],
        salinity: byId[map['salinity']],
      };
      if (!live) return;
      setTargets(nextTargets);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const setNum =
    (key: keyof Targets, _step = '0.1') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTargets((s) => ({ ...s, [key]: v === '' ? null : Number(v) }));
    };

  const rowsToUpsert = useMemo(() => {
    if (!tank) return [];
    const keys = ['alk','ca','mg','po4','no3','salinity'] as (keyof Targets)[];
    return keys
      .filter((k) => paramMap[String(k)] !== undefined)
      .map((k) => ({
        tank_id: tank.id,
        parameter_id: paramMap[String(k)],
        target_value: targets[k] ?? null
      }));
  }, [tank, targets, paramMap]);

  const saveAll = async (): Promise<void> => {
    if (!tank) return;
    setSaving(true);

    // 1) Save tank details
    const volNum = tankVol === '' ? null : Number(tankVol);
    const { data: updatedTank, error: tankErr } = await supabase
      .from('tanks')
      .update({ name: tankName, volume_value: volNum, volume_unit: tankUnit })
      .eq('id', tank.id)
      .select()
      .single();

    if (tankErr || !updatedTank) {
      setSaving(false);
      alert(`Could not save tank: ${tankErr?.message ?? 'Unknown error'}`);
      return;
    }

    setTank(updatedTank as Tank);

    // 2) Upsert six target rows for this tank
    const { error: tgtErr } = await supabase
      .from('targets')
      .upsert(rowsToUpsert, { onConflict: 'tank_id,parameter_id' });

    setSaving(false);
    if (tgtErr) {
      alert(`Could not save targets: ${tgtErr.message}`);
    } else {
      alert('Tank and targets saved');
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold">Target Parameters</h1>
        <p className="text-sm text-gray-500 mt-2">Loading...</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your tank and target parameters.</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm mb-1">Tank name</label>
            <input
              className={inputClass}
              value={tankName}
              onChange={(e)=>setTankName(e.target.value)}
              placeholder="My Tank"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm mb-1">Tank volume</label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={tankVol}
              onChange={(e)=>setTankVol(e.target.value)}
              placeholder="200"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm mb-1">Unit</label>
            <select
              className={inputClass}
              value={tankUnit}
              onChange={(e)=>setTankUnit(e.target.value as 'L'|'gal')}
            >
              <option value="L">L</option>
              <option value="gal">gal</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Target Parameters</h2>
        <p className="text-sm text-gray-600 mt-1">
          These targets are used by the Calculator and shown in Results.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm mb-1">Alkalinity (dKH)</label>
            <input className={inputClass} type="number" step="0.1"
              value={targets.alk ?? ''} onChange={setNum('alk','0.1')} placeholder="8.2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Calcium (ppm)</label>
            <input className={inputClass} type="number" step="1"
              value={targets.ca ?? ''} onChange={setNum('ca','1')} placeholder="430" />
          </div>
          <div>
            <label className="block text-sm mb-1">Magnesium (ppm)</label>
            <input className={inputClass} type="number" step="1"
              value={targets.mg ?? ''} onChange={setNum('mg','1')} placeholder="1400" />
          </div>
          <div>
            <label className="block text-sm mb-1">Phosphate (ppm)</label>
            <input className={inputClass} type="number" step="0.001"
              value={targets.po4 ?? ''} onChange={setNum('po4','0.001')} placeholder="0.03" />
          </div>
          <div>
            <label className="block text-sm mb-1">Nitrate (ppm)</label>
            <input className={inputClass} type="number" step="0.1"
              value={targets.no3 ?? ''} onChange={setNum('no3','0.1')} placeholder="5" />
          </div>
          <div>
            <label className="block text-sm mb-1">Salinity (ppt)</label>
            <input className={inputClass} type="number" step="0.1"
              value={targets.salinity ?? ''} onChange={setNum('salinity','0.1')} placeholder="35.0" />
          </div>
        </div>
      </section>

      <button
        className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        onClick={saveAll}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save tank & targets'}
      </button>
    </main>
  );
}
