"use client";

import { useEffect, useState } from "react";

// Dynamic import to avoid SSR issues and to avoid hard-failing if recharts isn't installed yet
let Recharts: any = null;
let rechartsLoadError: string | null = null;

export default function ResultsChart({
  data,
  xKey = "ts",
  yKey = "value",
  yUnit,
  height = 320,
}: {
  data: Array<Record<string, any>>;
  xKey?: string;
  yKey?: string;
  yUnit?: string;
  height?: number;
}) {
  const [, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        const mod = await import("recharts");
        Recharts = mod;
        setReady((r) => !r); // force re-render
      } catch (e: any) {
        rechartsLoadError = e?.message || "Failed to load charting lib.";
        setReady((r) => !r);
      }
    })();
  }, []);

  if (rechartsLoadError) {
    return (
      <div className="text-sm text-red-600">
        {rechartsLoadError}. Try running <code>npm install recharts</code> locally and redeploy.
      </div>
    );
  }

  if (!Recharts) {
    return <div className="text-sm text-gray-600">Loading chart…</div>;
  }

  const {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
  } = Recharts;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v: any) => {
              try {
                const d = new Date(v);
                return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              } catch {
                return v;
              }
            }}
          />
          <YAxis
            label={yUnit ? { value: yUnit, angle: -90, position: "insideLeft" } : undefined}
            allowDecimals
          />
          <Tooltip
            labelFormatter={(v: any) => {
              try {
                const d = new Date(v);
                return d.toLocaleString();
              } catch {
                return v;
              }
            }}
          />
          <Legend />
          <Line type="monotone" dataKey={yKey} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
