
"use client";
import { useMemo } from "react";

export default function MonthCalendar({ year, month, markedDates }:{year:number;month:number;markedDates:string[]}) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = useMemo(() => {
    const cells: Array<{ day?: number; iso?: string; marked?: boolean }> = [];
    for (let i = 0; i < startDay; i++) cells.push({});
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(year, month, d).toISOString().slice(0,10);
      cells.push({ day: d, iso, marked: markedDates.includes(iso) });
    }
    while (cells.length % 7 !== 0) cells.push({});
    const out: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i+7));
    return out;
  }, [year, month, startDay, daysInMonth, markedDates]);
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-100 text-xs font-medium">
        {labels.map(l => <div key={l} className="p-2 text-center">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 text-sm">
        {rows.flat().map((c, idx) => (
          <div key={idx} className="h-12 border-t border-gray-200 relative">
            {c.day && <div className="absolute top-1 left-1 text-xs">{c.day}</div>}
            {c.marked && <div className="w-2 h-2 rounded-full bg-black absolute bottom-1 right-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}
