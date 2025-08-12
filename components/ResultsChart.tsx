'use client';
import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import DeleteReadingButton from '../app/components/DeleteReadingButton';

type Point = { id?: string; measured_at: string | Date; value: number; parameter_key?: string | null; parameter?: string | null };
type Props = {
  data: Point[];
  unit?: string;
  onPointDeleted?: (id: string) => void;
};

function fmtDate(ts: string | number | Date) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function ResultsChart({ data, unit, onPointDeleted }: Props) {
  const [selected, setSelected] = useState<Point | null>(null);

  const handleChartClick = (e: any) => {
    const p = e && e.activePayload && e.activePayload[0] && e.activePayload[0].payload;
    if (p && p.id) {
      setSelected(p);
    }
  };

  return (
    <div className="w-full">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            onClick={handleChartClick}
            margin={{ top: 12, right: 12, bottom: 8, left: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="measured_at"
              tickFormatter={(ts: string | number | Date) =>
                new Date(ts).toLocaleString(undefined, {
                  year: '2-digit',
                  month: 'short',
                  day: '2-digit',
                })
              }
            />
            <YAxis tickFormatter={(n: number) => (unit ? `${n} ${unit}` : String(n))} />

            <Tooltip
              labelFormatter={(ts: string | number) => fmtDate(ts)}
              formatter={(val: any) => (unit ? [`${val} ${unit}`, 'Value'] : [val, 'Value'])}
              isAnimationActive={false}
              wrapperStyle={{ pointerEvents: 'none' }}
            />

            <Line
              type="monotone"
              dataKey="value"
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              strokeWidth={2}
              isAnimationActive={false}
            />

            {selected ? (
              <ReferenceDot
                x={selected.measured_at as any}
                y={selected.value as any}
                r={5}
                fill="#ef4444"
                stroke="none"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selected && selected.id ? (
        <div className="mt-3 flex items-center justify-between rounded-md border bg-white p-3 text-sm shadow">
          <div className="space-y-0.5">
            <div className="font-medium">Selected point</div>
            <div className="opacity-80">{fmtDate(selected.measured_at as any)}</div>
            <div className="opacity-80">
              Value: <span className="font-medium">{selected.value}{unit ? ` ${unit}` : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeleteReadingButton
              id={String(selected.id)}
              label="Remove"
              onDeleted={(id) => {
                onPointDeleted?.(id);
                setSelected(null);
              }}
              tableName="results"
            />
            <button
              className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setSelected(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
