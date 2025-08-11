
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthCalendar from "@/components/MonthCalendar";

type Result = {
  id: string;
  date_iso: string;
  time_str: string;
  alk?: number; ca?: number; mg?: number; po4?: number; no3?: number;
};

export default function ResultsPage() {
  const [userId, setUserId] = useState<string|undefined>();
  const [items, setItems] = useState<Result[]>([]);
  const [dateISO, setDateISO] = useState<string>(new Date().toISOString().slice(0,10));
  const [time, setTime] = useState<string>(new Date().toTimeString().slice(0,5));
  const [alk, setAlk] = useState<string>("");
  const [ca, setCa] = useState<string>("");
  const [mg, setMg] = useState<string>("");
  const [po4, setPo4] = useState<string>("");
  const [no3, setNo3] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("readings")
        .select("id, date_iso, time_str, alk, ca, mg, po4, no3")
        .eq("user_id", user.id)
        .order("date_iso", { ascending: false })
        .order("time_str", { ascending: false });
      setItems((data as any) || []);
    })();
  }, []);

  async function add() {
    if (!userId) return;
    const payload:any = { user_id: userId, date_iso: dateISO, time_str: time };
    if (alk) payload.alk = Number(alk);
    if (ca) payload.ca = Number(ca);
    if (mg) payload.mg = Number(mg);
    if (po4) payload.po4 = Number(po4);
    if (no3) payload.no3 = Number(no3);
    const { data, error } = await supabase.from("readings").insert(payload).select().single();
    if (!error && data) {
      setItems(prev => [data as any, ...prev]);
      setAlk(""); setCa(""); setMg(""); setPo4(""); setNo3("");
    }
  }

  async function remove(id: string) {
    await supabase.from("readings").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const now = new Date();
  const marked = useMemo(() => Array.from(new Set(items.map(i => i.date_iso))), [items]);

  return (
    <main className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold">Results</h2>
        {!userId && <p className="text-sm text-gray-600">Sign in to log results.</p>}
      </div>

      {userId && (
        <>
          <section className="card space-y-3">
            <h3 className="font-medium">Add result</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="block text-sm">Date</label>
                <input className="input" type="date" value={dateISO} onChange={e=>setDateISO(e.target.value)} /></div>
              <div><label className="block text-sm">Time</label>
                <input className="input" type="time" value={time} onChange={e=>setTime(e.target.value)} /></div>
              <div><label className="block text-sm">Alk (dKH)</label>
                <input className="input" type="number" step="0.01" value={alk} onChange={e=>setAlk(e.target.value)} /></div>
              <div><label className="block text-sm">Ca (ppm)</label>
                <input className="input" type="number" step="1" value={ca} onChange={e=>setCa(e.target.value)} /></div>
              <div><label className="block text-sm">Mg (ppm)</label>
                <input className="input" type="number" step="1" value={mg} onChange={e=>setMg(e.target.value)} /></div>
              <div><label className="block text-sm">PO4 (ppm)</label>
                <input className="input" type="number" step="0.001" value={po4} onChange={e=>setPo4(e.target.value)} /></div>
              <div><label className="block text-sm">NO3 (ppm)</label>
                <input className="input" type="number" step="0.1" value={no3} onChange={e=>setNo3(e.target.value)} /></div>
            </div>
            <button className="btn" onClick={add}>Add</button>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-medium mb-2">Calendar</h3>
              <MonthCalendar year={now.getFullYear()} month={now.getMonth()} markedDates={marked} />
              <p className="text-xs text-gray-500 mt-2">Dots indicate days with saved results.</p>
            </div>
            <div className="card">
              <h3 className="font-medium mb-2">Recent results</h3>
              {items.length === 0 ? <p className="text-sm text-gray-500">No results yet.</p> : (
                <ul className="divide-y">
                  {items.map(i => (
                    <li key={i.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">{i.date_iso} {i.time_str}</div>
                        <div className="text-gray-600">
                          {i.alk !== null && i.alk !== undefined && <>Alk {i.alk} dKH · </>}
                          {i.ca  !== null && i.ca  !== undefined && <>Ca {i.ca} ppm · </>}
                          {i.mg  !== null && i.mg  !== undefined && <>Mg {i.mg} ppm · </>}
                          {i.po4 !== null && i.po4 !== undefined && <>PO4 {i.po4} ppm · </>}
                          {i.no3 !== null && i.no3 !== undefined && <>NO3 {i.no3} ppm</>}
                        </div>
                      </div>
                      <button className="btn" onClick={()=>remove(i.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
