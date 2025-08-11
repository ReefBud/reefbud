
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  brand: string | null;
  name: string;
  parameter_key: "alk"|"ca"|"mg"|"po4"|"no3";
  dose_ref_ml?: number | null;
  delta_ref_value?: number | null;
  volume_ref_liters?: number | null;
};

export default function ProductsPage() {
  const [userId, setUserId] = useState<string|undefined>();
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<Omit<Product,"id">>({
    brand: "", name: "", parameter_key: "alk", dose_ref_ml: null, delta_ref_value: null, volume_ref_liters: null
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("products").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setItems((data as any) || []);
    })();
  }, []);

  async function add() {
    if (!userId || !form.name) return;
    const payload = { user_id: userId, ...form };
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    if (!error && data) setItems(prev => [data as any, ...prev]);
  }

  async function remove(id: string) {
    await supabase.from("products").delete().eq("id", id);
    setItems(prev => prev.filter(p => p.id !== id));
  }

  return (
    <main className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold">Products</h2>
        {!userId && <p className="text-sm text-gray-600">Sign in to manage products.</p>}
      </div>

      {userId && (
        <>
          <section className="card space-y-3">
            <h3 className="font-medium">Add product</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="block text-sm">Brand</label>
                <input className="input" value={form.brand ?? ""} onChange={e=>setForm(f=>({ ...f, brand: e.target.value }))} /></div>
              <div><label className="block text-sm">Name</label>
                <input className="input" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-sm">Parameter</label>
                <select className="input" value={form.parameter_key} onChange={e=>setForm(f=>({ ...f, parameter_key: e.target.value as any }))}>
                  <option value="alk">Alkalinity (dKH)</option>
                  <option value="ca">Calcium (ppm)</option>
                  <option value="mg">Magnesium (ppm)</option>
                  <option value="po4">Phosphates (ppm)</option>
                  <option value="no3">Nitrates (ppm)</option>
                </select></div>
              <div><label className="block text-sm">Dose ref (ml)</label>
                <input className="input" type="number" value={form.dose_ref_ml ?? ""} onChange={e=>setForm(f=>({ ...f, dose_ref_ml: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><label className="block text-sm">Raises by (units)</label>
                <input className="input" type="number" step="0.001" value={form.delta_ref_value ?? ""} onChange={e=>setForm(f=>({ ...f, delta_ref_value: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><label className="block text-sm">In volume (L)</label>
                <input className="input" type="number" value={form.volume_ref_liters ?? ""} onChange={e=>setForm(f=>({ ...f, volume_ref_liters: e.target.value ? Number(e.target.value) : null }))} /></div>
            </div>
            <button className="btn" onClick={add}>Add product</button>
          </section>

          <section className="card space-y-2">
            <h3 className="font-medium">Your products</h3>
            {items.length === 0 ? <p className="text-sm text-gray-500">No products yet.</p> : (
              <ul className="divide-y">
                {items.map(p => (
                  <li key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{p.brand || "Unknown"} — {p.name}</div>
                      <div className="text-xs text-gray-500">
                        Param: {p.parameter_key.toUpperCase()} | {
                          (p.dose_ref_ml && p.delta_ref_value && p.volume_ref_liters)
                          ? `${p.dose_ref_ml} ml -> +${p.delta_ref_value} in ${p.volume_ref_liters} L`
                          : "Potency: unknown"
                        }
                      </div>
                    </div>
                    <button className="btn" onClick={()=>remove(p.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
