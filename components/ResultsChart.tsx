"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReLineChart = dynamic(async () => {
  const m = await import("recharts");
  return m.LineChart;
}, { ssr: false });
const ReLine = dynamic(async () => (await import("recharts")).Line, { ssr: false });
const ReXAxis = dynamic(async () => (await import("recharts")).XAxis, { ssr: false });
const ReYAxis = dynamic(async () => (await import("recharts")).YAxis, { ssr: false });
const ReCartesianGrid = dynamic(async () => (await import("recharts")).CartesianGrid, { ssr: false });
const ReTooltip = dynamic(async () => (await import("recharts")).Tooltip, { ssr: false });
const ReResponsiveContainer = dynamic(async () => (await import("recharts")).ResponsiveContainer, { ssr: false });

export default function ResultsChart({ data, unit }: { data: { measured_at: string; value: number }[]; unit?: string }) {
  const points = useMemo(() => {
    return (data || []).map(d => ({
      t: new Date(d.measured_at).toLocaleString(),
      v: Number(d.value),
    }));
  }, [data]);

  if (!ReLineChart) {
    return <div className="text-sm text-gray-600">Recharts is not installed. Run: <code>npm install recharts</code></div>;
  }

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ReResponsiveContainer>
        <ReLineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <ReCartesianGrid strokeDasharray="3 3" />
          <ReXAxis dataKey="t" />
          <ReYAxis unit={unit ? ` ${unit}` : ""} />
          <ReTooltip />
          <ReLine type="monotone" dataKey="v" dot={false} />
        </ReLineChart>
      </ReResponsiveContainer>
    </div>
  );
}
