
// app/calculator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Doses = { alk?: number; ca?: number; mg?: number };
type Params = { alk?: number; ca?: number; mg?: number };
type Targets = Params;

type ProductPotencyRaw = {
  dose_ml?: number;
  delta_value?: number;
  volume_liters?: number;
  brand?: string | null;
  name?: string | null;
};

function safeNum(n: unknown): number | undefined {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  return Number.isFinite(v) ? v : undefined;
}
function round2(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "";
  return (Math.round(n * 100) / 100).toString();
}

export default function CalculatorPage() {
  // Inputs
  const [tankLiters, setTankLiters] = useState<number | undefined>(undefined);
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});

  // Product raw entries by parameter
  const [product, setProduct] = useState<{[K in 'alk'|'ca'|'mg']?: ProductPotencyRaw}>({});

  // Derived
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});
  const [slopesPerDay, setSlopesPerDay] = useState<{[K in 'alk'|'ca'|'mg']?: number}>({});
  const [loading, setLoading] = useState(false);

  function incPerMlTankFor(param: keyof Doses): number | undefined {
    const pr = product[param as 'alk'|'ca'|'mg'];
    if (!pr || !tankLiters) return undefined;
    const D = pr.dose_ml, d = pr.delta_value, Vref = pr.volume_liters, V = tankLiters;
    if (!D || !d || !Vref || !V) return undefined;
    if (!Number.isFinite(D) || !Number.isFinite(d) || !Number.isFinite(Vref) || !Number.isFinite(V) || D <= 0 || Vref <= 0 || V <= 0) return undefined;
    return (d / D) * (Vref / V);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Latest tank
        const { data: tanks } = await supabase
          .from("tanks")
          .select("id, volume_liters, volume_value")
          .order("created_at", { ascending: false })
          .limit(1);
        const tank = (tanks ?? [])[0] ?? null;
        const tankId = tank?.id ?? null;
        if (tank) {
          const vol =
            typeof tank.volume_liters === "number" ? tank.volume_liters :
            typeof tank.volume_value === "number" ? tank.volume_value : undefined;
          if (vol && !cancelled) setTankLiters(vol);
        }

        // Targets
        const { data: tgt } = await supabase
          .from("targets")
          .select("alk, ca, mg")
          .eq("user_id", user.id)
          .maybeSingle();
        if (tgt && !cancelled) {
          setTarget({
            alk: typeof tgt.alk === "number" ? tgt.alk : undefined,
            ca:  typeof tgt.ca  === "number" ? tgt.ca  : undefined,
            mg:  typeof tgt.mg  === "number" ? tgt.mg  : undefined,
          });
        }

        // Products preferred
        const nextProducts: any = {};
        const { data: prefs } = await supabase
          .from("preferred_products")
          .select("parameter_key, products:product_id (brand, name, dose_ref_ml, delta_ref_value, volume_ref_liters)")
          .in("parameter_key", ["alk","ca","mg"])
          .limit(10);
        if (prefs) {
          for (const row of prefs) {
            const pk = (row as any).parameter_key as "alk"|"ca"|"mg";
            const prod: any = (row as any).products ?? {};
            if (prod && prod.dose_ref_ml != null && prod.delta_ref_value != null && prod.volume_ref_liters != null) {
              nextProducts[pk] = {
                dose_ml: Number(prod.dose_ref_ml),
                delta_value: Number(prod.delta_ref_value),
                volume_liters: Number(prod.volume_ref_liters),
                brand: prod.brand ?? null,
                name: prod.name ?? null
              };
            }
          }
        }
        // Fallback: latest user product
        const unresolved = (["alk","ca","mg"] as const).filter(k => !nextProducts[k]);
        if (unresolved.length) {
          const { data: plist } = await supabase.from("parameters").select("id, key").in("key", unresolved as any);
          const idByKey = new Map<string, number>();
          for (const p of plist ?? []) idByKey.set((p as any).key, (p as any).id);
          for (const key of unresolved) {
            const pid = idByKey.get(key);
            if (!pid) continue;
            const { data: prows } = await supabase
              .from("products")
              .select("brand, name, dose_ref_ml, delta_ref_value, volume_ref_liters")
              .eq("user_id", user.id)
              .eq("parameter_id", pid)
              .order("created_at", { ascending: false })
              .limit(1);
            const p0: any = (prows ?? [])[0];
            if (p0 && p0.dose_ref_ml != null && p0.delta_ref_value != null && p0.volume_ref_liters != null) {
              nextProducts[key] = {
                dose_ml: Number(p0.dose_ref_ml),
                delta_value: Number(p0.delta_ref_value),
                volume_liters: Number(p0.volume_ref_liters),
                brand: p0.brand ?? null,
                name: p0.name ?? null
              };
            }
          }
        }
        if (!cancelled) setProduct(prev => ({ ...prev, ...nextProducts }));

        // Current + slope (1..7 readings)
        if (tankId) {
          const { data: plist2 } = await supabase.from("parameters").select("id, key").in("key", ["alk","ca","mg"]);
          const idByKey2 = new Map<string, number>();
          for (const p of plist2 ?? []) idByKey2.set((p as any).key, (p as any).id);

          const curr: any = {};
          const slopeMap: any = {};

          for (const key of ["alk","ca","mg"] as const) {
            const pid = idByKey2.get(key);
            if (!pid) continue;
            const { data: rows } = await supabase
              .from("results")
              .select("value, measured_at")
              .eq("user_id", user.id)
              .eq("tank_id", tankId)
              .eq("parameter_id", pid)
              .order("measured_at", { ascending: false })
              .limit(7);
            const vals = (rows ?? [])
              .map(r => ({ v: Number((r as any).value), t: new Date((r as any).measured_at).getTime() }))
              .filter(r => Number.isFinite(r.v) && Number.isFinite(r.t));

            if (vals.length) {
              curr[key] = Math.round(vals[0].v * 100) / 100;
              if (vals.length >= 2) {
                const t0 = vals[vals.length - 1].t;
                const pts = vals.map(p => ({ x: (p.t - t0) / (1000*60*60*24), y: p.v }));
                const n = pts.length;
                const sumx = pts.reduce((a,b)=>a+b.x,0);
                const sumy = pts.reduce((a,b)=>a+b.y,0);
                const sumxx = pts.reduce((a,b)=>a+b.x*b.x,0);
                const sumxy = pts.reduce((a,b)=>a+b.x*b.y,0);
                const denom = (n*sumxx - sumx*sumx);
                const slope = denom !== 0 ? (n*sumxy - sumx*sumy)/denom : 0;
                slopeMap[key] = slope;
              } else {
                slopeMap[key] = 0;
              }
            }
          }

          if (!cancelled) {
            setCurrent(prev => ({ ...prev, ...curr }));
            setSlopesPerDay(prev => ({ ...prev, ...slopeMap }));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const keys: Array<keyof Doses> = ["alk", "ca", "mg"];
    const req: Doses = {};
    const delta: Doses = {};

    const horizonDays = 7;
    const epsilon = 0.01;

    for (const k of keys) {
      const currDose = currentDose[k] ?? 0;
      const currVal = current[k];
      const targVal = target[k];
      const slope = slopesPerDay[k as 'alk'|'ca'|'mg'] ?? 0;

      const incPerMl = incPerMlTankFor(k);
      if (incPerMl && incPerMl > 0) {
        let holdAdjust = 0;
        if (slope < -epsilon) {
          holdAdjust = Math.abs(slope) / incPerMl;
        }

        let correctionAdjust = 0;
        if (targVal !== undefined && currVal !== undefined) {
          const deficit = targVal - currVal;
          if (deficit > 0 && slope <= epsilon) {
            correctionAdjust = (deficit / incPerMl) / horizonDays;
          }
        }

        const needed = currDose + holdAdjust + correctionAdjust;
        req[k] = needed;
        delta[k] = needed - currDose;
      } else {
        req[k] = undefined;
        delta[k] = undefined;
      }
    }

    setRequiredDose(req);
    setDeltaDose(delta);
  }, [tankLiters, currentDose, current, target, product, slopesPerDay]);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
      <p className="text-sm text-muted-foreground">
        Potencies are taken directly from your Products tab (e.g., "30 ml raises 2.2 in a 35 L tank").
        Targets come from your dashboard. Currents are from your latest readings; daily consumption is computed from up to the last 7 readings.
      </p>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Tank</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Tank size (litres)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={tankLiters ?? ""}
              onChange={(e) => setTankLiters(safeNum(e.target.value))}
              placeholder="e.g. 35"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Current Daily Dose (ml/day)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {["alk","ca","mg"].map((k) => (
            <div key={k}>
              <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()}</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full border rounded-lg p-2 bg-background"
                value={currentDose[k as keyof Doses] ?? ""}
                onChange={(e) => setCurrentDose({ ...currentDose, [k]: safeNum(e.target.value) })}
                placeholder="e.g. 30"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Potency of Your Products</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Pulled directly from your Products tab. The calculator scales to your tank size automatically.
        </p>
        <div className="space-y-3">
          {(["alk","ca","mg"] as const).map((k) => {
            const pr: any = product[k];
            return (
              <div key={k} className="border rounded-xl p-3">
                <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
                {pr && pr.dose_ml && pr.delta_value != null && pr.volume_liters ? (
                  <div className="text-sm">
                    {pr.brand || pr.name ? (<div className="mb-1">{pr.brand ? `${pr.brand} ` : ""}{pr.name || ""}</div>) : null}
                    <div><strong>{pr.dose_ml}</strong> ml raises <strong>{pr.delta_value}</strong> in a <strong>{pr.volume_liters}</strong> L tank.</div>
                  </div>
                ) : (
                  <div className="text-sm">No product found. Add it on the Products tab or set a preferred product.</div>
                )}
                <details className="mt-2">
                  <summary className="text-xs underline cursor-pointer">Override manually</summary>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input
                      type="number" inputMode="decimal" placeholder="dose (ml)"
                      className="w-full border rounded-lg p-2 bg-background"
                      value={pr?.dose_ml ?? ""}
                      onChange={(e) => setProduct(prev => ({ ...prev, [k]: { ...(prev as any)[k], dose_ml: safeNum(e.target.value) } }))}
                    />
                    <input
                      type="number" inputMode="decimal" placeholder="delta value"
                      className="w-full border rounded-lg p-2 bg-background"
                      value={pr?.delta_value ?? ""}
                      onChange={(e) => setProduct(prev => ({ ...prev, [k]: { ...(prev as any)[k], delta_value: safeNum(e.target.value) } }))}
                    />
                    <input
                      type="number" inputMode="decimal" placeholder="tank litres"
                      className="w-full border rounded-lg p-2 bg-background"
                      value={pr?.volume_liters ?? ""}
                      onChange={(e) => setProduct(prev => ({ ...prev, [k]: { ...(prev as any)[k], volume_liters: safeNum(e.target.value) } }))}
                    />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Alk (dKH)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={current.alk ?? ""}
              onChange={(e) => setCurrent({ ...current, alk: safeNum(e.target.value) })}
              placeholder="e.g. 6.7"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Ca (ppm)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={current.ca ?? ""}
              onChange={(e) => setCurrent({ ...current, ca: safeNum(e.target.value) })}
              placeholder="e.g. 410"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Mg (ppm)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={current.mg ?? ""}
              onChange={(e) => setCurrent({ ...current, mg: safeNum(e.target.value) })}
              placeholder="e.g. 1320"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Alk (dKH)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={target.alk ?? ""}
              onChange={(e) => setTarget({ ...target, alk: safeNum(e.target.value) })}
              placeholder="e.g. 8.0"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Ca (ppm)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={target.ca ?? ""}
              onChange={(e) => setTarget({ ...target, ca: safeNum(e.target.value) })}
              placeholder="e.g. 430"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Mg (ppm)</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-lg p-2 bg-background"
              value={target.mg ?? ""}
              onChange={(e) => setTarget({ ...target, mg: safeNum(e.target.value) })}
              placeholder="e.g. 1400"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Recommended Daily Dose</h2>
        <p className="text-xs text-muted-foreground mb-2">
          If a parameter is trending up, keep your current dose for now. If it keeps rising for 3–5 days,
          consider reducing by roughly (rise per day ÷ effect per ml) ml/day.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["alk","ca","mg"] as const).map((k) => (
            <div key={k} className="border rounded-xl p-3">
              <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
              <div className="text-2xl font-semibold">{round2(requiredDose[k]) || "-"} ml</div>
              <div className="text-xs mt-1">Change: {round2(deltaDose[k]) || "-"} ml/day</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          We compute your product's effect on your tank as: (delta ÷ dose) × (reference volume ÷ your tank litres).
          Then we add enough to offset daily drops and gently correct toward your target over ~7 days.
        </p>
      </section>
    </main>
  );
}
