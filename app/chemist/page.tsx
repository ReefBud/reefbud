"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductPicker from "@/components/ProductPicker";

type Tank = { id: string };
type Param = { id: number; key: string; display_name: string };

export default function Chemist() {
  const [userId, setUserId] = useState<string>();
  const [tank, setTank] = useState<Tank>();
  const [params, setParams] = useState<Param[]>([]);
  const [selected, setSelected] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // ensure a tank exists
      const { data: tanks } = await supabase.from("tanks").select("id").eq("user_id", user.id).limit(1);
      let tk = (tanks && tanks[0]) as Tank | undefined;
      if (!tk) {
        const { data: created } = await supabase.from("tanks")
          .insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" })
          .select("id").single();
        tk = (created as any) || undefined;
      }
      if (!tk) return;
      setTank(tk);

      // load parameters
      const { data: p } = await supabase.from("parameters").select("id,key,display_name");
      const ps = (p || []) as Param[];
      setParams(ps);

      // load existing preferred products for this tank
      const { data: prefs } = await supabase
        .from("preferred_products")
        .select("parameter_id,product_id")
        .eq("user_id", user.id)
        .eq("tank_id", tk.id);

      const idToKey: Record<number, string> = {};
      ps.forEach(pr => { idToKey[pr.id] = pr.key; });

      const sel: Record<string, string> = {};
      (prefs || []).forEach((r: any) => {
        const key = idToKey[r.parameter_id];
        if (key) sel[key] = r.product_id;
      });
      setSelected(sel);
    })();
  }, []);

  async function savePreferred(paramId: number, productId?: string) {
    if (!userId || !tank || !productId) return;
    const { error } = await supabase
      .from("preferred_products")
      .upsert({ user_id: userId, tank_id: tank.id, parameter_id: paramId, product_id: productId }, { onConflict: "user_id,tank_id,parameter_id" });
    if (error) {
      console.error("preferred_products upsert error", error);
      alert("Could not save your selection: " + error.message);
    }
  }

  if (!userId) return <main className="card">Sign in to manage your Chemist settings.</main>;
  if (!tank) return <main className="card">Preparing your tank…</main>;

  return (
    <main className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Chemist</h2>
        <p className="text-sm text-gray-600">
          Choose the product you use for each parameter. The Calculator will read these and use each product’s potency.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {params.map(p => (
          <div key={p.id} className="card space-y-2">
            <div className="font-medium">{p.display_name}</div>
            <ProductPicker
              parameterId={p.id}
              value={selected[p.key]}
              onChange={(productId) => {
                setSelected(s => ({ ...s, [p.key]: productId }));
                savePreferred(p.id, productId);
              }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
