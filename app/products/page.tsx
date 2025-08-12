"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductCreateForm from "@/components/ProductCreateForm";

type Row = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number;
  parameter_key?: string | null;
  helper_text?: string | null;
  dose_ref_ml?: number | null;
  delta_ref_value?: number | null;
  volume_ref_liters?: number | null;
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [params, setParams] = useState<Record<number, string>>({});

  async function load() {
    const [{ data: ps }, { data: me }] = await Promise.all([
      supabase.from("parameters").select("id,display_name"),
      supabase.auth.getUser()
    ]);

    const map: Record<number, string> = {};
    (ps || []).forEach((p: any) => { map[p.id] = p.display_name; });
    setParams(map);

    const uid = me?.user?.id;
    const orClause = uid ? `user_id.is.null,user_id.eq.${uid}` : `user_id.is.null`;

    const { data } = await supabase
      .from("products")
      .select("id,brand,name,parameter_id,parameter_key,helper_text,dose_ref_ml,delta_ref_value,volume_ref_liters,user_id")
      .or(orClause);

    setRows((data || []).sort((a: any, b: any) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`)));
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Products</h2>
      <ProductCreateForm onCreated={load} />

      <section className="card">
        <h3 className="text-base font-semibold mb-2">Your products and global</h3>
        <div className="divide-y">
          {rows.map(r => (
            <div key={r.id} className="py-2">
              <div className="font-medium">{r.brand} — {r.name}</div>
              <div className="text-sm text-gray-600">
                Parameter: {params[r.parameter_id] || r.parameter_key || r.parameter_id}
                {r.dose_ref_ml && r.delta_ref_value && r.volume_ref_liters ? (
                  <> • Potency: {r.dose_ref_ml} ml → +{r.delta_ref_value} in {r.volume_ref_liters} L</>
                ) : null}
              </div>
              {r.helper_text ? <div className="text-xs mt-1 italic">{r.helper_text}</div> : null}
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-gray-500">No products yet.</div>}
        </div>
      </section>
    </main>
  );
}
