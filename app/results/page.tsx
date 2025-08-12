"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ResultsChart from "@/components/ResultsChart";

type Param = { id: number; key: "alk" | "ca" | "mg" | "po4" | "no3" | "salinity"; display_name: string; unit: string };
type Tank = { id: string; name?: string };

type ResultRow = {
  created_at?: string;
  measured_at?: string;
  ts?: string;
  value?: number;
  parameter_id?: number | null;
  parameter_key?: string | null;
  user_id?: string | null;
  tank_id?: string | null;
};

const PARAM_ORDER: Array<Param["key"]> = ["alk", "ca", "mg", "po4", "no3", "salinity"];

export default function ResultsPage() {
  const [userId, setUserId] = useState<string>();
  const [tank, setTank] = useState<Tank>();
  const [params, setParams] = useState<Param[]>([]);
  const [paramKey, setParamKey] = useState<Param["key"]>("alk");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Load user, tank, parameters
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setErr("Please sign in to view results.");
          setLoading(false);
          return;
        }
        setUserId(user.id);

        // find or create a tank
        const t = await supabase.from("tanks").select("id, name").eq("user_id", user.id).limit(1);
        let tk = t.data?.[0] as Tank | undefined;
        if (!tk) {
          const created = await supabase.from("tanks").insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" }).select("id, name").single();
          if (created.error) throw created.error;
          tk = created.data as Tank;
        }
        setTank(tk);

        // get parameters
        const p = await supabase.from("parameters").select("id, key, display_name, unit");
        if (p.error) throw p.error;
        const list = (p.data || []) as any[];
        const filtered = list.filter((x) => PARAM_ORDER.includes(x.key));
        filtered.sort((a, b) => PARAM_ORDER.indexOf(a.key) - PARAM_ORDER.indexOf(b.key));
        setParams(filtered);
      } catch (e: any) {
        console.error("init results error", e);
        setErr(e?.message || "Failed to initialize Results.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedParam = useMemo(() => params.find((p) => p.key === paramKey), [params, paramKey]);
  const yUnit = selectedParam?.unit;

  // Load timeseries for selected parameter
  useEffect(() => {
    (async () => {
      if (!userId || !tank || !selectedParam) return;
      setLoading(true);
      setErr(null);
      try {
        // Try common shapes in order:
        // 1) results with parameter_id + tank_id + user_id
        let q = supabase
          .from("results")
          .select("created_at, measured_at, value, parameter_id, parameter_key, user_id, tank_id")
          .eq("user_id", userId)
          .eq("tank_id", tank.id)
          .eq("parameter_id", selectedParam.id)
          .order("measured_at", { ascending: true })
          .order("created_at", { ascending: true });
        let r = await q;
        let data = r.data as ResultRow[] | null;
        if (r.error) throw r.error;

        // 2) Fallback to parameter_key if no rows
        if (!data || data.length === 0) {
          const r2 = await supabase
            .from("results")
            .select("created_at, measured_at, value, parameter_id, parameter_key, user_id, tank_id")
            .eq("user_id", userId)
            .eq("tank_id", tank.id)
            .eq("parameter_key", selectedParam.key)
            .order("measured_at", { ascending: true })
            .order("created_at", { ascending: true });
          if (r2.error) throw r2.error;
          data = r2.data as ResultRow[] | null;
        }

        setRows(data || []);
      } catch (e: any) {
        console.error("load timeseries error", e);
        setErr(e?.message || "Failed to load results.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, tank?.id, selectedParam?.id, selectedParam?.key]);

  const chartData = useMemo(() => {
    return (rows || []).map((r) => ({
      ts: r.measured_at || r.created_at || r.ts || null,
      value: typeof r.value === "number" ? r.value : (r.value ? Number(r.value) : null),
    })).filter((d) => d.ts && d.value !== null);
  }, [rows]);

  return (
    <main className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm text-gray-600">
          View your parameter trends over time.
        </p>
      </section>

      <section className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="label">Parameter</label>
            <select
              className="input w-full"
              value={paramKey}
              onChange={(e) => setParamKey(e.target.value as Param["key"])}
            >
              {params.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="text-gray-600">Loading…</div>
          ) : err ? (
            <div className="text-red-600">{err}</div>
          ) : chartData.length === 0 ? (
            <div className="text-gray-600">No data for {selectedParam?.display_name} yet.</div>
          ) : (
            <ResultsChart data={chartData} yUnit={yUnit} />
          )}
        </div>
      </section>
    </main>
  );
}
