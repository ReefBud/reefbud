// app/results/ResultsChart.example.tsx
'use client';
import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import InjectDeleteIntoRechartsTooltip from '@/app/results/InjectDeleteIntoRechartsTooltip';

type Reading = { id: string; measured_at: string; value: number };

export default function ResultsChartExample({ initialReadings }: { initialReadings: Reading[] }) {
  const [readings, setReadings] = useState(initialReadings);

  const data = useMemo(
    () => readings.map(r => ({ id: r.id, date: r.measured_at, value: r.value })),
    [readings]
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString()} />
          <YAxis />
          <Tooltip content={
            <InjectDeleteIntoRechartsTooltip onLocalDelete={(id) => {
              setReadings(prev => prev.filter(r => r.id !== id));
            }} />
          }/>
          <Line type="monotone" dataKey="value" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
