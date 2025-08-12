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
  parameter?: string | null;
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

  // Fetch user's first tank
  useEffect(() => {
    async function fetchTank() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Please sign in');

        const { data: tanks, error: tanksError } = await supabase
        .from('tanks')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

        if (tanksError) throw tanksError;
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

      let { data, error } = await supabase
      .from('results')
      .select('id, value, measured_at, parameter_key, parameter')
      .eq('user_id', user.id)
      .eq('tank_id', selectedTankId)
      .eq('parameter_key', selected)
      .order('measured_at', { ascending: true });

      if (error || !data?.length) {
        const res2 = await supabase
        .from('results')
        .select('id, value, measured_at, parameter')
        .eq('user_id', user.id)
        .eq('tank_id', selectedTankId)
        .eq('parameter', selected)
        .order('measured_at', { ascending: true });

        if (!res2.error && res2.data) {
          data = res2.data.map((r: any) => ({ ...r, parameter_key: r.parameter }));
        }
      }
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Load whenever parameter or tank changes
  useEffect(() => {
    if (tankId) load(paramKey, tankId);
  }, [paramKey, tankId]);

    const unit = useMemo(
      () => PARAMS.find(p => p.key === paramKey)?.unit,
                         [paramKey]
    );

    // Smart yDomain: prefer target domain, but expand to include data
    const yDomain = useMemo<[number, number] | undefined>(() => {
      const base = PARAMS.find(p => p.key === paramKey)?.domain;
      if (!rows.length) return base;

      const values = rows
      .map(r => Number(r.value ?? NaN))
      .filter(v => Number.isFinite(v)) as number[];
      if (!values.length) return base;

      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);

      let min = base ? Math.min(base[0], dataMin) : dataMin;
      let max = base ? Math.max(base[1], dataMax) : dataMax;

      // tiny padding so points don’t sit on the border
      const span = Math.max(1e-9, max - min);
      const pad = Math.max(span * 0.05, 0.001);
      min = Math.max(0, min - pad); // clamp to 0 for nutrient params
      max = max + pad;

      return [min, max];
    }, [rows, paramKey]);

    // Handle optimistic add from the form
    function handleSaved(inserted: { id: string; measured_at: string; value: number; parameter_key?: string | null; parameter?: string | null; }) {
      // Only add if this reading belongs to the currently selected param
      const key = inserted.parameter_key ?? inserted.parameter ?? null;
      if (key !== paramKey) return;
      setRows(prev => {
        // de-dup by id in case a reload happens at the same time
        const exists = prev.some(r => r.id === inserted.id);
        if (exists) return prev;
        const next: Row = {
          id: inserted.id,
          measured_at: inserted.measured_at,
          value: inserted.value,
          parameter_key: inserted.parameter_key ?? null,
          parameter: inserted.parameter ?? null,
        };
        const merged = [...prev, next].sort((a, b) => +new Date(a.measured_at) - +new Date(b.measured_at));
        return merged;
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
