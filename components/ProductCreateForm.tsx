"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Param = { id: number; key: string; display_name: string };

export default function ProductCreateForm({ onCreated }: { onCreated?: () => void }) {
  const [params, setParams] = useState<Param[]>([]);
  const [userId, setUserId] = useState<string>();
  const [form, setForm] = useState({
    brand: "",
    name: "",
    parameterId: 0,
    doseRefMl: "",
    deltaRefValue: "",
    volumeRefLiters: "",
    helperText: ""
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: { user } }, { data: ps }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("parameters").select("id,key,display_name")
      ]);
      if (user) setUserId(user.id);
      setParams((ps || []) as Param[]);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return alert("Sign in first");
    if (!form.brand || !form.name || !form.parameterId) return alert("Fill brand, name, and parameter");

    setBusy(true);
    const { error } = await supabase.from("products").insert({
      user_id: userId,
      brand: form.brand.trim(),
      name: form.name.trim(),
      parameter_id: form.parameterId,
      dose_ref_ml: form.doseRefMl ? Number(form.doseRefMl) : null,
      delta_ref_value: form.deltaRefValue ? Number(form.deltaRefValue) : null,
      volume_ref_liters: form.volumeRefLiters ? Number(form.volumeRefLiters) : null,
      helper_text: form.helperText || null,
      parameter_key: params.find(p => p.id === form.parameterId)?.key || null
    } as any);
    setBusy(false);

    if (error) {
      console.error("create product error", error);
      return alert("Could not create product: " + error.message);
    }
    setForm({ brand: "", name: "", parameterId: 0, doseRefMl: "", deltaRefValue: "", volumeRefLiters: "", helperText: "" });
    onCreated?.();
    alert("Product added");
  }

  return (
    <form onSubmit={submit} className="space-y-3 card">
      <h3 className="text-base font-semibold">Add custom product</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input" placeholder="Brand" value={form.brand}
          onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
        <input className="input" placeholder="Name" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <select className="input" value={form.parameterId}
          onChange={e => setForm(f => ({ ...f, parameterId: Number(e.target.value) }))}>
          <option value={0}>Parameter…</option>
          {params.map(p => (<option key={p.id} value={p.id}>{p.display_name}</option>))}
        </select>
        <input className="input" placeholder="Dose ref (ml)" type="number" step="any" value={form.doseRefMl}
          onChange={e => setForm(f => ({ ...f, doseRefMl: e.target.value }))} />
        <input className="input" placeholder="Delta ref value" type="number" step="any" value={form.deltaRefValue}
          onChange={e => setForm(f => ({ ...f, deltaRefValue: e.target.value }))} />
        <input className="input" placeholder="Volume ref (L)" type="number" step="any" value={form.volumeRefLiters}
          onChange={e => setForm(f => ({ ...f, volumeRefLiters: e.target.value }))} />
      </div>

      <textarea className="input" placeholder="Helper text (optional)"
        value={form.helperText} onChange={e => setForm(f => ({ ...f, helperText: e.target.value }))} />

      <button className="btn" disabled={busy} type="submit">{busy ? "Saving…" : "Save product"}</button>
    </form>
  );
}
