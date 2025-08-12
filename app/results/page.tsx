'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ResultsChart from '../../components/ResultsChart';
import ResultForm from '../components/ResultForm';

type Row = {
  id: string;
  value: number | null;
  measured_at: string;
  parameter_key?: string | null;
};

const PARAMS = [
  { key: 'alk',      label: 'Alkalinity', unit: 'dKH', domain: [7, 12] as [number, number] },
{ key: 'ca',       label: 'Calcium',    unit: 'ppm', domain: [400, 450] as [number, number] },
{ key: 'mg',       label: 'Magnesium',  unit: 'ppm', domain: [1350, 1450] as [number, number] },
{ key: 'po4',      label: 'Phosphate',  unit: 'ppm', domain: [0.03, 0.1] as [number, number] },
{ key: 'no3',      label: 'Nitrate',    unit: 'ppm', domain: [5, 15] as [number, number] },
{ key: 'salinity', label: 'Salinity',   unit: 'ppt', domain: [30, 40] as [number, number] },
] as const;

type ParamKey = typeof PARAMS[number]['key'];

export default function ResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paramKey, setParamKey] = useState<ParamKey>('alk');
  const [tankId, setTankId] = useState<string | null>(null);

  // Get first tank for the user
  useEffect(() => {
    async function fetchTank() {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error('Please sign in');

        const { data: tanks, error: tanksErr } = await supabase
        .from('tanks')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

        if (tanksErr) throw tanksErr;
        if (!tanks?.length) throw new Error('No tanks found for this user');

        setTankId(tanks[0].id);
      } catch (e: any) {
        setError(e.message || 'Failed to load tank');
      }
    }
    fetchTank();
  }, []);

  async function load(selected: ParamKey, selectedTankId: string) {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      // Resolve parameter_id by key
      const { data: p, error: pErr } = await supabase
      .from('parameters')
      .select('id')
      .eq('key', selected)
      .single();
      if (pErr) throw pErr;
      if (!p?.id) throw new Error(`Parameter id not found for "${selected}"`);

      const { data, error } = await supabase
      .from('results')
      .select('id, value, measured_at, parameter_key')
      .eq('user_id', user.id)
      .eq('tank_id', selectedTankId)
      .eq('parameter_id', p.id)
      .order('measured_at', { ascending: true });

      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Load when param or tank changes
  useEffect(() => {
    if (tankId) load(paramKey, tankId);
  }, [paramKey, tankId]);

    const unit = useMemo(
      () => PARAMS.find(p => p.key === paramKey)?.unit,
                         [paramKey]
    );

    // Y-axis: target domain, expanded to fit data
    const yDomain = useMemo<[number, number] | undefined>(() => {
      const base = PARAMS.find(p => p.key === paramKey)?.domain;
      if (!rows.length) return base;

      const values = rows
      .map(r => Number(r.value ?? NaN))
      .filter(v => Number.isFinite(v)) as number[];
      if (!values.length) return base;

      let min = Math.min(...values);
      let max = Math.max(...values);

      if (base) {
        min = Math.min(min, base[0]);
        max = Math.max(max, base[1]);
      }
      const span = Math.max(1e-9, max - min);
      const pad = Math.max(span * 0.05, 0.001);
      return [Math.max(0, min - pad), max + pad];
    }, [rows, paramKey]);

    // Optimistic add (keeps delete working by using real id)
    function handleSaved(inserted: { id: string; measured_at: string; value: number; parameter_key?: string | null; }) {
      // Only add if reading matches the currently selected param
      if ((inserted.parameter_key ?? null) !== paramKey) return;
      setRows(prev => {
        if (prev.some(r => r.id === inserted.id)) return prev;
        const next: Row = {
          id: inserted.id,
          measured_at: inserted.measured_at,
          value: inserted.value,
          parameter_key: inserted.parameter_key ?? null,
        };
        return [...prev, next].sort(
          (a, b) => +new Date(a.measured_at) - +new Date(b.measured_at)
        );
      });
    }

    return (
      <div className="mx-auto max-w-4xl p-4 space-y-4">
      <div className="flex justify-between">
      <div>
      <h1 className="text-xl font-semibold">Results</h1>
      <p className="text-sm text-gray-600">Click a point to select it, then Remove.</p>
      </div>
      <select
      className="rounded-md border px-2 py-1 text-sm"
      value={paramKey}
      onChange={(e) => setParamKey(e.target.value as ParamKey)}
      >
      {PARAMS.map(p => (
        <option key={p.key} value={p.key}>{p.label}</option>
      ))}
      </select>
      </div>

      {tankId && (
        <ResultForm
        defaultParam={paramKey}
        tankId={tankId}
        onSaved={handleSaved}
        />
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <ResultsChart
        data={rows.map(r => ({ ...r, value: Number(r.value ?? 0) }))}
        unit={unit}
        yDomain={yDomain}
        onPointDeleted={(id) => setRows(prev => prev.filter(x => x.id !== id))}
        />
      )}
      </div>
    );
}
