"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Param = { id: number; key: string; display_name: string; unit: string };
type ProductRow = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number | null;
  grams_per_liter: number | null;
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
  helper_text?: string | null;
  user_id?: string | null;
};

export default function ProductForm({ onSaved }: { onSaved?: () => void }) {
  const [userId, setUserId] = useState<string | undefined>();
  const [params, setParams] = useState<Param[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form fields
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [parameterId, setParameterId] = useState<number | "">(""); // parameter
  const [gpl, setGpl] = useState<string>(""); // grams per liter
  const [doseMl, setDoseMl] = useState<string>(""); // dose_ref_ml
  const [deltaVal, setDeltaVal] = useState<string>(""); // delta_ref_value
  const [tankVol, setTankVol] = useState<string>(""); // volume_ref_liters

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const p = await supabase.from("parameters").select("id, key, display_name, unit");
      if (!p.error && p.data) {
        const desiredOrder = ["alk","ca","mg","po4","no3"];
        const filtered = (p.data as any[]).filter(x => desiredOrder.includes(x.key));
        filtered.sort((a,b)=> desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
        setParams(filtered as Param[]);
      }
    })();
  }, []);

  const selectedParam = useMemo(() => params.find(p => p.id === parameterId), [params, parameterId]);

  const potencyPreview = useMemo(() => {
    const dml = parseFloat(doseMl || "0");
    const dval = parseFloat(deltaVal || "0");
    const v = parseFloat(tankVol || "0");
    if (!dml || !dval || !v) return "";
    const unit = selectedParam?.unit || "units";
    return `${dml} ml → +${dval} ${unit} in ${v} L`;
  }, [doseMl, deltaVal, tankVol, selectedParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!userId) { setErr("Please sign in."); return; }
    if (!brand.trim() || !name.trim() || !parameterId) {
      setErr("Brand, Parameter and Name are required.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("products").upsert({
        user_id: userId,
        brand: brand.trim(),
        name: name.trim(),
        parameter_id: typeof parameterId === "string" ? null : parameterId,
        grams_per_liter: gpl ? Number(gpl) : null,
        dose_ref_ml: doseMl ? Number(doseMl) : null,
        delta_ref_value: deltaVal ? Number(deltaVal) : null,
        volume_ref_liters: tankVol ? Number(tankVol) : null,
      }, { onConflict: "user_id,brand,name,parameter_id" });
      if (error) throw error;
      if (onSaved) onSaved();
      // Keep values so user can tweak, but surface success state if you prefer.
    } catch (e:any) {
      console.error("save product error", e);
      setErr(e?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card space-y-4">
        <h3 className="text-base font-semibold">Add custom product</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="label">Brand</label>
            <input className="input w-full" placeholder="Tropic Marin" value={brand} onChange={e=>setBrand(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="label">Parameter</label>
            <select className="input w-full" value={parameterId} onChange={e=>setParameterId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select parameter…</option>
              {params.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="label">Name of Product</label>
            <input className="input w-full" placeholder="Balling B (Alkalinity)" value={name} onChange={e=>setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="label">Grams per liter (g/L)</label>
            <input className="input w-full" type="number" step="any" placeholder="e.g., 100" value={gpl} onChange={e=>setGpl(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="label">Dose reference (ml)</label>
            <input className="input w-full" type="number" step="any" placeholder="e.g., 10" value={doseMl} onChange={e=>setDoseMl(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="label">Raises by (units)</label>
            <input className="input w-full" type="number" step="any" placeholder="e.g., 15" value={deltaVal} onChange={e=>setDeltaVal(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="label">In tank volume (L)</label>
            <input className="input w-full" type="number" step="any" placeholder="e.g., 200" value={tankVol} onChange={e=>setTankVol(e.target.value)} />
          </div>
        </div>

        {potencyPreview && (
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
            <div className="font-medium">Potency preview</div>
            <div>{potencyPreview}</div>
          </div>
        )}

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="flex gap-2">
          <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save product"}</button>
        </div>
      </div>
    </form>
  );
}
