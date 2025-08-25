'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DeleteReadingButton from '../../../components/DeleteReadingButton';

type Row = { id: string; value: number | null; measured_at: string; parameter_key?: string | null; parameter?: string | null };

export default function ManageResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');
      const { data, error } = await supabase
      .from('results')
      .select('id, value, measured_at, parameter_key, parameter')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(200);
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
    <h1 className="text-xl font-semibold">Manage Results</h1>
    {loading && <div>Loading…</div>}
    {error && <div className="text-red-600">{error}</div>}
    <ul className="divide-y border rounded-lg">
    {rows.map(r => (
      <li key={r.id} className="flex justify-between p-3">
      <div>
      <div>Value: {r.value ?? '—'}</div>
      <div className="text-xs opacity-70">{new Date(r.measured_at).toLocaleString()}</div>
      {(r.parameter_key || r.parameter) && (
        <div className="text-xs opacity-70">Param: {r.parameter_key || r.parameter}</div>
      )}
      </div>
      <DeleteReadingButton
      id={r.id}
      label="Remove"
      onDeleted={(id) => setRows(prev => prev.filter(x => x.id !== id))}
      />
      </li>
    ))}
    </ul>
    </div>
  );
}
