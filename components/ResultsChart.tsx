"use client";

import dynamic from "next/dynamic";
import React from "react";

/**
 * Fix for Next.js + Recharts dynamic imports:
 * Map each named export to a pseudo default export so the loader shape matches.
 */
const LineChart = dynamic(() => import("recharts").then(m => ({ default: m.LineChart })), { ssr: false });
const Line = dynamic(() => import("recharts").then(m => ({ default: m.Line })), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

type Point = {
  measured_at: string | Date;
  value: number;
};

export default function ResultsChart({ data, unit }: { data: Point[]; unit?: string }) {
  // Normalize dates to ISO strings for Recharts
  const rows = (data || []).map(d => ({
    ...d,
    measured_at: typeof d.measured_at === "string" ? d.measured_at : (d.measured_at as Date).toISOString(),
  }));

  if (!rows.length) {
    return <div className="text-sm text-gray-600">No data yet for this parameter.</div>;
  }

  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="measured_at" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: unit || "", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
