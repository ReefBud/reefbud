"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductForm from "@/components/ProductForm";

type Row = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number | null;
  grams_per_liter: number | null;
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
  user_id?: string | null;
  helper_text?: string | null;
};

type Param = { id: number; key: string; display_name: string; unit: string };

export default function ProductsPage() {
  const [userId, setUserId] = useState<string | undefined>();
  const [items, setItems] = useState<Row[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;

    const p = await supabase.from("parameters").select("id, key, display_name, unit");
    if (!p.error && p.data) setParams(p.data as any);

    const { data, error } = await supabase
      .from("products")
      .select("id, brand, name, parameter_id, grams_per_liter, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text, user_id");
    if (error) throw error;
    const filtered = (data || []).filter((r: any) => r.user_id === null || r.user_id === uid);
    filtered.sort((a,b)=> `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
    setItems(filtered as Row[]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);
        await reload();
      } catch (e:any) {
        console.error("load products error", e);
        setErr(e?.message || "Failed loading products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const paramMap = useMemo(() => {
    const m = new Map<number, Param>();
    params.forEach(p => m.set(p.id, p));
    return m;
  }, [params]);

  return (
    <main className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Products</h2>
        <p className="text-sm text-gray-600">
          Add your dosing products. This list combines your products and the global catalog.
        </p>
      </section>

      <ProductForm onSaved={() => reload()} />

      <section className="card">
        <h3 className="text-base font-semibold">All visible products</h3>
        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Brand</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Parameter</th>
                  <th className="py-2 pr-4">g/L</th>
                  <th className="py-2 pr-4">Potency</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const p = it.parameter_id ? paramMap.get(it.parameter_id) : undefined;
                  const unit = p?.unit || "units";
                  const potency = (it.dose_ref_ml && it.delta_ref_value && it.volume_ref_liters)
                    ? `${it.dose_ref_ml} ml → +${it.delta_ref_value} ${unit} in ${it.volume_ref_liters} L`
                    : "—";
                  return (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 pr-4">{it.brand}</td>
                      <td className="py-2 pr-4">{it.name}</td>
                      <td className="py-2 pr-4">{p?.display_name || "—"}</td>
                      <td className="py-2 pr-4">{it.grams_per_liter ?? "—"}</td>
                      <td className="py-2 pr-4">{potency}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
