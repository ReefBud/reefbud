"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductPicker from "@/components/ProductPicker";

type Tank = { id: string; name?: string };
type Param = { id: number; key: "alk" | "ca" | "mg" | "po4" | "no3"; display_name: string };

export default function Chemist() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>();
  const [tank, setTank] = useState<Tank>();
  const [params, setParams] = useState<Param[]>([]);
  const [selected, setSelected] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userRes = await supabase.auth.getUser();
        const u = userRes.data.user;
        if (!u) {
          setLoading(false);
          setError("Please sign in to manage your Chemist selections.");
          return;
        }
        setUserId(u.id);

        // Find or create a default tank for this user (Calculator/Dashboard depend on it)
        const tanksRes = await supabase.from("tanks").select("id, name").eq("user_id", u.id).limit(1);
        let tk: Tank | undefined = tanksRes.data?.[0];
        if (!tk) {
          const createRes = await supabase
            .from("tanks")
            .insert({ user_id: u.id, name: "My Tank", volume_value: 200, volume_unit: "L" })
            .select("id, name")
            .single();
          if (createRes.error) throw createRes.error;
          tk = createRes.data as Tank;
        }
        setTank(tk);

        // Load parameters (these are global/static rows)
        const pRes = await supabase.from("parameters").select("id, key, display_name");
        if (pRes.error) throw pRes.error;
        const ps: Param[] = (pRes.data || []) as any;
        // Only the 5 we care about, in a friendly order
        const order = ["alk", "ca", "mg", "po4", "no3"];
        const filtered = ps.filter(p => order.includes(p.key));
        filtered.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
        setParams(filtered);

        // Load existing preferred products for this tank/user
        const prefRes = await supabase
          .from("preferred_products")
          .select("parameter_id, product_id")
          .eq("user_id", u.id)
          .eq("tank_id", tk.id);
        if (prefRes.error) throw prefRes.error;

        // Map param_id -> key
        const idToKey: Record<number, string> = {};
        filtered.forEach(p => {
          idToKey[p.id] = p.key;
        });

        const sel: Record<string, string> = {};
        (prefRes.data || []).forEach((row: any) => {
          const key = idToKey[row.parameter_id];
          if (key) sel[key] = row.product_id;
        });
        setSelected(sel);
      } catch (e: any) {
        console.error("Chemist init error:", e);
        setError(e?.message || "Failed to load Chemist data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function savePreferred(parameterId: number, productId?: string) {
    if (!userId || !tank) return;
    if (!productId) return;
    setError(null);
    try {
      // IMPORTANT: upsert requires a unique constraint on (user_id,tank_id,parameter_id)
      const up = await supabase
        .from("preferred_products")
        .upsert(
          {
            user_id: userId,
            tank_id: tank.id,
            parameter_id: parameterId,
            product_id: productId,
          },
          { onConflict: "user_id,tank_id,parameter_id" }
        )
        .select();
      if (up.error) throw up.error;
    } catch (e: any) {
      console.error("savePreferred error:", e);
      setError(e?.message || "Failed to save your selection. Check DB policies and unique index.");
    }
  }

  if (loading) return <main className="card">Loading Chemist…</main>;
  if (error) return <main className="card text-red-600">{error}</main>;
  if (!userId) return <main className="card">Please sign in to continue.</main>;
  if (!tank) return <main className="card">Preparing your tank…</main>;

  return (
    <main className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Chemist</h2>
        <p className="text-sm text-gray-600">
          Choose the product you use for each parameter. Your selection is saved for this tank, and the Calculator will use each product’s potency.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {params.map((p) => (
          <div key={p.id} className="card space-y-2">
            <div className="font-medium">{p.display_name}</div>
            <ProductPicker
              parameterId={p.id}
              value={selected[p.key]}
              onChange={(productId) => {
                setSelected((s) => ({ ...s, [p.key]: productId }));
                savePreferred(p.id, productId);
              }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
