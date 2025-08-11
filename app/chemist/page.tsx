"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductPicker from "@/components/ProductPicker";
import Link from "next/link";

type Tank = { id: string };
type ParamKey = "alk" | "ca" | "mg" | "po4" | "no3";

export default function Chemist() {
  const [userId, setUserId] = useState<string | undefined>();
  const [tank, setTank] = useState<Tank | undefined>();
  const [targets, setTargets] = useState<Record<ParamKey, number>>({
    alk: 8.3,
    ca: 430,
    mg: 1350,
    po4: 0.05,
    no3: 10,
  });
  const [prod, setProd] = useState<Record<ParamKey, string | undefined>>({
    alk: undefined,
    ca: undefined,
    mg: undefined,
    po4: undefined,
    no3: undefined,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Find or create tank
      const { data: tanks } = await supabase
      .from("tanks")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

      let tk: Tank | null = (tanks && tanks[0]) ? (tanks[0] as Tank) : null;

      if (!tk) {
        const { data: created, error } = await supabase
        .from("tanks")
        .insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" })
        .select()
        .single();
        if (error || !created) return; // bail if we couldn't create
        tk = created as Tank;
      }

      setTank(tk);
      if (!tk) return; // TS-safe guard

      // Load parameter map
      const { data: params } = await supabase.from("parameters").select("id, key");
      const map: Record<number, ParamKey> = {};
      (params || []).forEach((p: any) => { map[p.id] = p.key as ParamKey; });

      // Load existing targets for this tank
      const tankId = tk.id;
      const { data: tgs } = await supabase
      .from("targets")
      .select("parameter_id, target_value")
      .eq("tank_id", tankId);

      const merged = { ...targets };
      (tgs || []).forEach((t: any) => {
        const key = map[t.parameter_id];
        if (key) merged[key] = Number(t.target_value);
      });
        setTargets(merged);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveTarget(key: ParamKey, value: number) {
    if (!tank) return;
    const { data: params } = await supabase.from("parameters").select("id, key");
    const p = (params || []).find((x: any) => x.key === key);
    if (!p) return;
    await supabase
    .from("targets")
    .upsert({ tank_id: tank.id, parameter_id: p.id, target_value: value })
    .select();
  }

  return (
    <main className="space-y-6">
    <div className="card">
    <div className="flex items-center justify-between">
    <div>
    <h2 className="text-lg font-semibold">Targets & Products</h2>
    <p className="text-sm text-gray-600">Set your preferred targets, then select the product you use for each.</p>
    </div>
    <Link className="btn" href="/products">Manage products</Link>
    </div>
    </div>

    {(!userId || !tank) ? (
      <div className="card">Sign in to manage targets.</div>
    ) : (
      <div className="grid grid-cols-1 gap-4">
      {(["alk","ca","mg","po4","no3"] as ParamKey[]).map(key => (
        <section key={key} className="card space-y-3">
        <h3 className="font-medium">{key.toUpperCase()}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
        <label className="block text-sm">Target</label>
        <input
        className="input"
        type="number"
        step="0.001"
        value={targets[key]}
        onChange={e => {
          const v = Number(e.target.value);
          setTargets(s => ({ ...s, [key]: v }));
          saveTarget(key, v);
        }}
        />
        </div>
        <div className="md:col-span-2">
        <label className="block text-sm mb-1">Product</label>
        <ProductPicker parameterKey={key} value={prod[key]} onChange={(id) => setProd(s => ({ ...s, [key]: id }))} />
        </div>
        </div>
        </section>
      ))}
      </div>
    )}
    </main>
  );
}
