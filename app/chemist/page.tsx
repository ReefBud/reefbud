"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import ProductPicker from "@/components/ProductPicker";

type ParamKey = "alk" | "ca" | "mg" | "po4" | "no3";
type Tank = { id: string; name?: string | null };

type Targets = Record<ParamKey, number | null>;

const keys: ParamKey[] = ["alk","ca","mg","po4","no3"];
const labels: Record<ParamKey, string> = {
  alk: "Alkalinity (dKH)",
  ca: "Calcium (ppm)",
  mg: "Magnesium (ppm)",
  po4: "Phosphate (ppm)",
  no3: "Nitrate (ppm)"
};

export default function Chemist(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [tank, setTank] = useState<Tank | null>(null);
  const [targets, setTargets] = useState<Targets>({
    alk: 8.3, ca: 430, mg: 1350, po4: 0.05, no3: 10
  });
  const [preferred, setPreferred] = useState<Record<ParamKey, string|undefined>>({
    alk: undefined, ca: undefined, mg: undefined, po4: undefined, no3: undefined
  });

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-3 py-2 shadow-sm " +
    "bg-gradient-to-b from-gray-50 to-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400";

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: { user } = { user: null } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Ensure a tank exists
      const { data: tanks } = await supabase
        .from("tanks")
        .select("id,name")
        .eq("user_id", user.id)
        .limit(1);
      let tk: Tank | null = (tanks && tanks[0]) ? (tanks[0] as Tank) : null;
      if (!tk) {
        const { data: created } = await supabase
          .from("tanks")
          .insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" })
          .select()
          .single();
        tk = (created || null) as Tank | null;
      }
      if (!live || !tk) { setLoading(false); return; }
      setTank(tk);

      // Load parameter map
      const { data: params } = await supabase.from("parameters").select("id,key");
      const idByKey: Record<string, number> = {};
      (params || []).forEach((p:any) => { idByKey[p.key] = p.id; });

      // Load targets
      const { data: tgs } = await supabase
        .from("targets")
        .select("parameter_id,target_value")
        .eq("tank_id", tk.id);
      const nextTargets = { ...targets };
      (tgs || []).forEach((t:any) => {
        const k = keys.find(k => idByKey[k] === t.parameter_id);
        if (k) nextTargets[k] = t.target_value != null ? Number(t.target_value) : null;
      });
      if (!live) return;
      setTargets(nextTargets);

      // Load preferred products
      const { data: prefs } = await supabase
        .from("preferred_products")
        .select("parameter_key,product_id")
        .eq("tank_id", tk.id);
      const mapPref: Record<ParamKey, string|undefined> = { alk: undefined, ca: undefined, mg: undefined, po4: undefined, no3: undefined };
      (prefs || []).forEach((r:any) => {
        if (keys.includes(r.parameter_key)) mapPref[r.parameter_key as ParamKey] = r.product_id;
      });
      setPreferred(mapPref);

      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  async function saveTarget(key: ParamKey, value: number|null) {
    if (!tank) return;
    // get parameter id for this key
    const { data: params } = await supabase.from("parameters").select("id,key");
    const p = (params || []).find((x:any) => x.key === key);
    if (!p) return;
    await supabase.from("targets").upsert({
      tank_id: tank.id,
      parameter_id: p.id,
      target_value: value
    }).select();
  }

  async function savePreferred(key: ParamKey, productId: string|undefined) {
    if (!tank || !productId) return;
    await supabase.from("preferred_products").upsert({
      tank_id: tank.id,
      parameter_key: key,
      product_id: productId
    }).select();
  }

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Chemist</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set your preferred product for each parameter and adjust your target values.
        </p>
      </section>

      {loading ? (
        <div className="p-4 rounded-xl border">Loading...</div>
      ) : !tank ? (
        <div className="p-4 rounded-xl border">Sign in to manage Chemist settings.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {keys.map((k) => (
            <div key={k} className="p-4 border rounded-2xl space-y-3">
              <h3 className="font-medium">{labels[k]}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Target</label>
                  <input
                    className={inputClass}
                    type="number"
                    step={k === "po4" ? "0.001" : "0.1"}
                    value={targets[k] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setTargets((s) => ({ ...s, [k]: v }));
                      saveTarget(k, v);
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Product</label>
                  <ProductPicker
                    parameterKey={k}
                    value={preferred[k]}
                    onChange={(pid) => {
                      setPreferred((s) => ({ ...s, [k]: pid }));
                      if (pid) savePreferred(k, pid);
                    }}
                  />
                  {/** Helper text for Tropic Marin Balling A/B */}
                  <TMHelper parameterKey={k} productId={preferred[k]} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function TMHelper({ parameterKey, productId }:{
  parameterKey: ParamKey;
  productId?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!productId) { if (live) setText(null); return; }
      const { data } = await supabase
        .from("products")
        .select("brand,name")
        .eq("id", productId)
        .limit(1)
        .single();
      if (!live) return;
      const brand = (data?.brand || "").toLowerCase();
      const name = (data?.name || "").toLowerCase();

      if (brand.includes("tropic marin") && /balling\s*b/.test(name) && parameterKey === "alk") {
        setText("Guide: 30 ml raises Alkalinity by approx 2.2 dKH in 35 L.");
        return;
      }
      if (brand.includes("tropic marin") && /balling\s*a/.test(name) && parameterKey === "ca") {
        setText("Guide: 30 ml raises Calcium by approx 15 ppm in 35 L.");
        return;
      }
      setText(null);
    })();
    return () => { live = false; };
  }, [productId, parameterKey]);

  if (!text) return null;
  return <p className="text-xs text-gray-600 mt-2">{text}</p>;
}