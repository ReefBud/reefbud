// app/results/ResultsListExample.tsx
'use client';
import { useState } from 'react';
import DeleteReadingButton from '@/app/components/DeleteReadingButton';

type Reading = {
  id: string;
  parameter_name: string;
  value: number;
  measured_at: string;
};

export default function ResultsListExample({ initialReadings }: { initialReadings: Reading[] }) {
  const [readings, setReadings] = useState<Reading[]>(initialReadings);
  const [calendarEvents, setCalendarEvents] = useState<{ id: string; date: string; title: string }[]>(
    initialReadings.map(r => ({ id: r.id, date: r.measured_at, title: `${r.parameter_name} ${r.value}` }))
  );

  return (
    <ul className="space-y-2">
      {readings.map(r => (
        <li key={r.id} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="font-medium">{r.parameter_name} = {r.value}</div>
            <div className="text-sm opacity-70">{new Date(r.measured_at).toLocaleString()}</div>
          </div>
          <DeleteReadingButton
            id={r.id}
            className="text-red-600 hover:opacity-70"
            onDeleted={(id) => {
              setReadings(prev => prev.filter(x => x.id !== id));
              setCalendarEvents(prev => prev.filter(e => e.id !== id));
            }}
          />
        </li>
      ))}
    </ul>
  );
}
