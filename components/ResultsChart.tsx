'use client';
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import InjectDeleteIntoRechartsTooltip from '@/app/results/InjectDeleteIntoRechartsTooltip';

type Point = { id?: string; measured_at: string | Date; value: number };
type Props = {
  data: Point[];
  unit?: string;
  onPointDeleted?: (id: string) => void;
};

export default function ResultsChart({ data, unit, onPointDeleted }: Props) {
  return (
    <div className="w-full">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
            <YAxis
              tickFormatter={(n: number) => (unit ? `${n} ${unit}` : String(n))}
            />
            {onPointDeleted ? (
              <Tooltip
                content={
                  <InjectDeleteIntoRechartsTooltip
                    onLocalDelete={(id) => onPointDeleted(id)}
                  />
                }
              />
            ) : (
              <Tooltip
                labelFormatter={(ts: string | number) =>
                  new Date(ts).toLocaleString()
                }
                formatter={(val: any) => (unit ? [`${val}`, unit] : [val])}
              />
            )}
            <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
