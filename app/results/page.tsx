"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ResultsChart from "@/components/ResultsChart";
import ResultForm from "@/components/ResultForm";

type Param = { id: number; key: string; display_name: string; unit: string };
type Tank = { id: string; name?: string };

export default function ResultsPage() {
  const [userId, setUserId] = useState<string | undefined>();
  const [tank, setTank] = useState<Tank | undefined>();
  const [params, setParams] = useState<Param[]>([]);
  const [selectedParamId, setSelectedParamId] = useState<number | "">("");
  const [rows, setRows] = useState<{ id: string; measured_at: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function ensureUserTankAndParams() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in.");
    setUserId(user.id);

    // Find or create tank
    const t = await supabase.from("tanks").select("id, name").eq("user_id", user.id).limit(1);
    let tk: Tank | undefined = t.data?.[0];
    if (!tk) {
      const c = await supabase.from("tanks").insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" }).select("id, name").single();
      if (c.error) throw c.error;
      tk = c.data as Tank;
    }
    setTank(tk);

    // Load parameters
    const p = await supabase.from("parameters").select("id, key, display_name, unit");
    if (p.error) throw p.error;
    const desiredOrder = ["alk","ca","mg","po4","no3","salinity"];
    const filtered = (p.data || []).filter((x: any) => desiredOrder.includes(x.key));
    filtered.sort((a: any, b: any) => desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
    setParams(filtered as Param[]);

    // Default select first param if none chosen
    if (!selectedParamId && filtered.length) setSelectedParamId(filtered[0].id);
  }

  async function loadData(paramId: number, tkId: string) {
    const { data, error } = await supabase
      .from("results")
      .select('id, measured_at, value')
      .eq("user_id", userId)
      .eq("tank_id", tkId)
      .eq("parameter_id", paramId)
      .order("measured_at", { ascending: true });
    if (error) throw error;
    setRows((data || []) as any);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await ensureUserTankAndParams();
      } catch (e: any) {
        setErr(e?.message || "Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!userId || !tank || !selectedParamId) return;
      try {
        await loadData(Number(selectedParamId), tank.id);
      } catch (e: any) {
        setErr(e?.message || "Failed to load data");
      }
    })();
  }, [userId, tank, selectedParamId]);

  const selectedParam = useMemo(() => params.find(p => p.id === selectedParamId), [params, selectedParamId]);

  return (
    <main className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm text-gray-600">View your parameter trends over time.</p>
      </section>

      <section className="card space-y-4">
        <h3 className="text-base font-semibold">Add a result</h3>
        <ResultForm onSaved={() => {
          if (userId && tank && selectedParamId) {
            loadData(Number(selectedParamId), tank.id);
          }
        }} />
      </section>

      <section className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-1">
            <label className="label">Parameter</label>
            <select
              className="input w-full"
              value={selectedParamId}
              onChange={(e) => setSelectedParamId(e.target.value ? Number(e.target.value) : "")}
            >
              {params.map(p => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div className="text-right text-sm text-gray-600">
            {rows.length ? `${rows.length} readings` : "No data yet for this parameter"}
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <ResultsChart
        data={rows}
        unit={selectedParam?.unit}
        onPointDeleted={(id) => setRows(prev => prev.filter(r => r.id !== id))}
        />
      </section>
    </main>
  );
}
