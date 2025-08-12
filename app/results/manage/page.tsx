// app/results/manage/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import DeleteReadingButton from '@/app/components/DeleteReadingButton';

type Reading = {
  id: string;
  value: number | null;
  measured_at: string;
};

export default function ManageResultsPage() {
  const supabase = createClient();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('readings')
      .select('id, value, measured_at')
      .order('measured_at', { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    setReadings((data as Reading[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('readings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel) };
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Manage Results</h1>
      <p className="text-sm opacity-70">Delete incorrect readings quickly. This list is private to your account.</p>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      <ul className="divide-y rounded-lg border">
        {readings.map(r => (
          <li key={r.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">Value: {r.value ?? '—'}</div>
              <div className="text-xs opacity-70">{new Date(r.measured_at).toLocaleString()}</div>
            </div>
            <DeleteReadingButton
              id={r.id}
              label="Remove"
              onDeleted={(id) => setReadings(prev => prev.filter(x => x.id !== id))}
            />
          </li>
        ))}
        {!loading && readings.length === 0 && (
          <li className="p-3 text-sm opacity-70">No readings yet.</li>
        )}
      </ul>
    </div>
  );
}
