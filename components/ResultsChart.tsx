"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { measured_at: string | Date; value: number };
type Props = {
  data: Point[];
  unit?: string;          // e.g. "dKH", "ppm"
  label?: string;         // e.g. "Alkalinity"
  height?: number;        // chart height px
};

export default function ResultsChart({
  data,
  unit = "",
  label = "Result",
  height = 320,
}: Props) {
  const safe = Array.isArray(data)
  ? data
  .filter((d) => d && d.measured_at != null && d.value != null)
  .map((d) => ({
    measured_at:
    typeof d.measured_at === "string"
    ? d.measured_at
    : (d.measured_at as Date).toISOString(),
               value: Number(d.value),
  }))
  .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  : [];

  if (safe.length === 0) {
    return (
      <div className="text-sm text-gray-600">
      No data yet. Add a result above to see the trend here.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
    <ResponsiveContainer>
    <LineChart data={safe} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
    dataKey="measured_at"
    tick={{ fontSize: 12 }}
    minTickGap={24}
    />
    <YAxis
    tick={{ fontSize: 12 }}
    width={48}
    domain={["auto", "auto"]}
    label={{
      value: unit || "",
      angle: -90,
      position: "insideLeft",
      offset: 10,
      style: { textAnchor: "middle", fontSize: 12 },
    }}
    />
    <Tooltip
    formatter={(v: any) => [`${v}${unit ? ` ${unit}` : ""}`, label]}
    labelFormatter={(ts: any) =>
      new Date(ts).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    />
    <Line
    type="monotone"
    dataKey="value"
    dot={false}
    strokeWidth={2}
    isAnimationActive={false}
    />
    </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
