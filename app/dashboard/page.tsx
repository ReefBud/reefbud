'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Targets = {
  alk?: number | null;
  ca?: number | null;
  mg?: number | null;
  po4?: number | null;
  no3?: number | null;
  salinity?: number | null;
};

type Tank = { id: string; name?: string; volume_value?: number; volume_unit?: 'L'|'gal' };

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tank, setTank] = useState<Tank | null>(null);
  const [targets, setTargets] = useState<Targets>({});

  // cache param key -> id map
  const [paramMap, setParamMap] = useState<Record<string, number>>({});

  const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2 shadow-sm ' +
  'bg-gradient-to-b from-gray-50 to-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400';

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: { user } = { user: null } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1) ensure a tank
      const { data: tanks } = await supabase
      .from('tanks')
      .select('id,name,volume_value,volume_unit')
      .eq('user_id', user.id)
      .limit(1);

      let tk: Tank | null = tanks?.[0] ?? null;
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

      // 2) load parameters (id map)
      const { data: params } = await supabase.from('parameters').select('id,key');
      const map: Record<string, number> = {};
      (params ?? []).forEach((p: any) => { map[p.key] = p.id; });
      if (!live) return;
      setParamMap(map);

      // 3) load existing targets for this tank
      const { data: tgs } = await supabase
      .from('targets')
      .select('parameter_id,target_value')
      .eq('tank_id', tk.id);

      const byId: Record<number, number> = {};
      (tgs ?? []).forEach((t: any) => { byId[t.parameter_id] = Number(t.target_value); });

      const next: Targets = {
        alk: byId[map['alk']],
        ca: byId[map['ca']],
        mg: byId[map['mg']],
        po4: byId[map['po4']],
        no3: byId[map['no3']],
        salinity: byId[map['salinity']],
      };
      if (!live) return;
      setTargets(next);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const setNum =
  (key: keyof Targets, step = '0.1') =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTargets((s) => ({ ...s, [key]: v === '' ? null : Number(v) }));
  };

  const rowsToUpsert = useMemo(() => {
    if (!tank) return [];
    return (['alk','ca','mg','po4','no3','salinity'] as (keyof Targets)[])
    .filter((k) => paramMap[String(k)] !== undefined)
    .map((k) => ({
      tank_id: tank.id,
      parameter_id: paramMap[String(k)],
                 target_value: targets[k] ?? null
    }));
  }, [tank, targets, paramMap]);

  const saveTargets = async () => {
    if (!tank) return;
    setSaving(true);

    // Upsert 6 rows for this tank.
    const { error } = await supabase
    .from('targets')
    .upsert(rowsToUpsert, { onConflict: 'tank_id,parameter_id' });

    setSaving(false);
    if (error) {
      alert(`Could not save targets: ${error.message}`);
    } else {
      alert('Targets saved');
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
    <main className="max-w-3xl mx-auto p-4">
    <h1 className="text-2xl font-semibold">Target Parameters</h1>
    <p className="text-sm text-gray-600 mt-1">
    Set your desired targets per tank. These are used by the Calculator and visualized in Results.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
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
    <input className={inputClass}
