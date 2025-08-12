// app/results/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ResultsChart from '../../components/ResultsChart';

type Row = {
  id: string;
  value: number | null;
  measured_at: string;
  parameter_key?: string | null;
  parameter?: string | null;
  parameter_id?: number | null;
};

const PARAMS = [
  { key: 'alk', label: 'Alkalinity', unit: 'dKH' },
  { key: 'ca', label: 'Calcium', unit: 'ppm' },
  { key: 'mg', label: 'Magnesium', unit: 'ppm' },
  { key: 'po4', label: 'Phosphate', unit: 'ppm' },
  { key: 'no3', label: 'Nitrate', unit: 'ppm' },
  { key: 'salinity', label: 'Salinity', unit: 'ppt' },
] as const;

export default function ResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paramKey, setParamKey] = useState<typeof PARAMS[number]['key']>('alk');

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      // Try a wide select that works across common schemas:
      // 1st attempt includes parameter_key (newer)
      let { data, error } = await supabase
        .from('results')
        .select('id, value, measured_at, parameter_key, parameter, parameter_id')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: true });

      // Fallback: minimal shape (older schemas)
      if (error) {
        const res2 = await supabase
          .from('results')
          .select('id, value, measured_at')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: true });
        if (res2.error) throw res2.error;
        data = res2.data;
      }

      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const unit = useMemo(() => PARAMS.find(p => p.key === paramKey)?.unit, [paramKey]);

  const filtered = useMemo(() => {
    // Client-side filter if we have a parameter marker, otherwise show all rows
    return rows
      .filter(r => {
        if (r.parameter_key) return r.parameter_key === paramKey;
        if (r.parameter) return r.parameter === paramKey;
        return true;
      })
      .map(r => ({
        id: r.id,
        measured_at: r.measured_at,
        value: Number(r.value ?? 0),
        parameter_key: r.parameter_key ?? null,
        parameter: r.parameter ?? null,
      }));
  }, [rows, paramKey]);

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Results</h1>
          <p className="text-sm text-gray-600">Click a point in the chart to select it, then press Remove.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="param" className="text-sm">Parameter</label>
          <select
            id="param"
            className="rounded-md border px-2 py-1 text-sm"
            value={paramKey}
            onChange={e => setParamKey(e.target.value as any)}
          >
            {PARAMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {!loading && !error ? (
        <ResultsChart
          data={filtered as any}
          unit={unit}
          onPointDeleted={(id) => setRows(prev => prev.filter(x => x.id !== id))}
        />
      ) : null}
    </div>
  );
}
