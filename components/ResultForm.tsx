"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Param = { id: number; key: string; display_name: string; unit: string };
type Tank = { id: string; name?: string };

export default function ResultForm({ onSaved }: { onSaved?: () => void }) {
  const [userId, setUserId] = useState<string | undefined>();
  const [tank, setTank] = useState<Tank | undefined>();
  const [params, setParams] = useState<Param[]>([]);
  const [parameterId, setParameterId] = useState<number | "">("");
  const [value, setValue] = useState<string>("");
  const [when, setWhen] = useState<string>(""); // datetime-local
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Find or create a default tank
      const t = await supabase.from("tanks").select("id, name").eq("user_id", user.id).limit(1);
      let tk: Tank | undefined = t.data?.[0];
      if (!tk) {
        const c = await supabase.from("tanks").insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" }).select("id, name").single();
        if (c.error) { setErr(c.error.message); return; }
        tk = c.data as Tank;
      }
      setTank(tk);

      // Load parameters
      const p = await supabase.from("parameters").select("id, key, display_name, unit");
      if (p.error) { setErr(p.error.message); return; }
      const desiredOrder = ["alk","ca","mg","po4","no3","salinity"];
      const filtered = (p.data || []).filter((x: any) => desiredOrder.includes(x.key));
      filtered.sort((a: any, b: any) => desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
      setParams(filtered as Param[]);
    })();
  }, []);

  const selectedParam = useMemo(() => params.find(p => p.id === parameterId), [params, parameterId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!userId || !tank) { setErr("Please sign in."); return; }
    if (!parameterId || !value) { setErr("Parameter and Result are required."); return; }
    setSaving(true);
    try {
      const measuredAt = when ? new Date(when).toISOString() : new Date().toISOString();
      const { error } = await supabase.from("results").insert({
        user_id: userId,
        tank_id: tank.id,
        parameter_id: typeof parameterId === "string" ? null : parameterId,
        value: Number(value),
        measured_at: measuredAt,
      });
      if (error) throw error;
      setValue("");
      setWhen("");
      if (onSaved) onSaved();
    } catch (e: any) {
      setErr(e.message || "Failed to save result.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="label">Date & time</label>
          <input
            type="datetime-local"
            className="input w-full"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="label">Parameter</label>
          <select
            className="input w-full"
            value={parameterId}
            onChange={(e) => setParameterId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select parameter…</option>
            {params.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="label">Result</label>
          <input
            type="number"
            step="any"
            className="input w-full"
            placeholder={selectedParam ? `e.g., 8.2 ${selectedParam.unit}` : "e.g., 8.2"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
    </form>
  );
}
