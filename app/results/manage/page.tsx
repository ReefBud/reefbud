// app/results/manage/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import DeleteReadingButton from '@/app/components/DeleteReadingButton';

type Reading = { id: string; parameter_id: number; value: number; measured_at: string; note: string | null };

const PARAM: Record<number, string> = { 1:'Alkalinity', 2:'Calcium', 3:'Magnesium', 4:'Phosphate', 5:'Nitrate', 6:'Salinity' };

export default function ManageResultsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled=false;
    (async () => {
      const { data, error } = await supabase.from('readings').select('id, parameter_id, value, measured_at, note')
        .order('measured_at', { ascending: false }).limit(200);
      if (cancelled) return;
      setLoading(false);
      if (error) setError(error.message);
      else setReadings(data || []);
    })();
    return () => { cancelled=true; };
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Manage Results</h1>
      <ul className="space-y-2">
        {readings.map(r => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">{PARAM[r.parameter_id] ?? `Param ${r.parameter_id}`} = {r.value}</div>
              <div className="text-sm opacity-70">{new Date(r.measured_at).toLocaleString()}{r.note ? ` · ${r.note}` : ''}</div>
            </div>
            <DeleteReadingButton id={r.id} onDeleted={(id) => setReadings(prev => prev.filter(x => x.id !== id))} />
          </li>
        ))}
      </ul>
      {readings.length === 0 && <div className="opacity-70">No readings found.</div>}
    </div>
  );
}
