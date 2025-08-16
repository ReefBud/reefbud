// app/calculator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Doses = { alk?: number; ca?: number; mg?: number };
type Params = { alk?: number; ca?: number; mg?: number };
type Targets = Params;
type Tolerances = { alk?: number; ca?: number; mg?: number };

type ProductPotencyRaw = {
  dose_ml?: number;        // e.g., 30 ml
  delta_value?: number;    // e.g., raises 2.2 (dKH/ppm)
  volume_liters?: number;  // e.g., in 35 L tank
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
  const [tolerance, setTolerance] = useState<Tolerances>({ alk: 0.0, ca: 0, mg: 0 }); // user-set adjustment band

  // Product raw entries by parameter (pulled from Products tab)
  const [product, setProduct] = useState<{[K in 'alk'|'ca'|'mg']?: ProductPotencyRaw}>({});

  // Derived
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});
  const [slopesPerDay, setSlopesPerDay] = useState<{[K in 'alk'|'ca'|'mg']?: number}>({});
  const [loading, setLoading] = useState(false);

  // Helper: compute increase per 1 ml for the user's tank using exact product fields
  // incPerMlTank = (delta_ref_value / dose_ref_ml) * (reference_volume / tank_liters)
  function incPerMlTankFor(param: keyof Doses): number | undefined {
    const pr = product[param as 'alk'|'ca'|'mg'];
    if (!pr || !tankLiters) return undefined;
    const D = pr.dose_ml, d = pr.delta_value, Vref = pr.volume_liters, V = tankLiters;
    if (!D || !d || !Vref || !V) return undefined;
    if (!Number.isFinite(D) || !Number.isFinite(d) || !Number.isFinite(Vref) || !Number.isFinite(V) || D <= 0 || Vref <= 0 || V <= 0) return undefined;
    return (d / D) * (Vref / V);
  }

  // Auto-load: tank, targets, products, current readings + consumption slope
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Latest tank (prefill volume)
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

        // Targets (dashboard)
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

        // Products: preferred first
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
        // Fallback: most recent user product per parameter
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

        // Current reading (latest) and consumption slope using up to last 7 readings
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
              // current = latest reading
              curr[key] = Math.round(vals[0].v * 100) / 100;
              // slope even with 2 points
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

  // Compute recommended dose (TOTAL ml/day):
  // - Hold adjustment offsets any daily drop (negative slope) using incPerMlTank
  // - Gentle correction toward target over ~7 days if not trending upward
  // - Apply tolerance band: only act if |target - current| > tolerance
  // - Never add when current > target or within tolerance band
  useEffect(() => {
    const keys: Array<keyof Doses> = ["alk", "ca", "mg"];
    const req: Doses = {};
    const delta: Doses = {};

    const horizonDays = 7;
    const epsilon = 0.01; // ~flat if |slope| < 0.01 per day

    for (const k of keys) {
      const currDose = currentDose[k] ?? 0;
      const currVal = current[k];
      const targVal = target[k];
      const tol = tolerance[k as 'alk'|'ca'|'mg'] ?? 0;
      const slope = slopesPerDay[k as 'alk'|'ca'|'mg'] ?? 0; // +rising, -dropping

      const incPerMl = incPerMlTankFor(k);
      if (incPerMl && incPerMl > 0) {
        let holdAdjust = 0;
        let correctionAdjust = 0;

        if (targVal !== undefined && currVal !== undefined) {
          const deficit = targVal - currVal;           // >0 means below target
          const absDef = Math.abs(deficit);
          const outsideBand = absDef > tol;

          // Only hold if we're below target beyond tolerance (don't add if above target or within band)
          if (outsideBand && deficit > 0 && slope < -epsilon) {
            holdAdjust = Math.abs(slope) / incPerMl;
          }

          // Gentle correction only if below target beyond tolerance and not rising
          if (outsideBand && deficit > 0 && slope <= epsilon) {
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
  }, [tankLiters, currentDose, current, target, product, slopesPerDay, tolerance]);

  // Rounding helper for "Add" display (integer ml with rule: always floor; if <1 and >=0.8 -> 1)
  function roundedAddInfo(raw: number | undefined) {
    if (raw === undefined || !Number.isFinite(raw)) return { shown: "", note: "" };
    const x = Math.max(0, raw);
    let shown = 0;
    let note = "";
    if (x >= 1) {
      shown = Math.floor(x);
      const diff = x - shown;
      if (diff > 0) note = `rounded down by ${round2(diff)} ml`;
    } else {
      if (x >= 0.8) {
        shown = 1;
        const up = 1 - x;
        note = `rounded up by ${round2(up)} ml`;
      } else {
        shown = 0;
        if (x > 0) note = `rounded down by ${round2(x)} ml`;
      }
    }
    return { shown: `${shown}`, note };
  }

  // UI
  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
      <p className="text-sm text-muted-foreground">
        Potencies come from your Products tab (e.g., "30 ml raises 2.2 in a 35 L tank").
        Targets come from your dashboard. Currents and daily consumption are computed from your latest 1–7 readings.
      </p>

      {/* Tank */}
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
              placeholder="e.g. 110"
            />
          </div>
        </div>
      </section>

      {/* Current dose */}
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
                placeholder={k==="alk"?"e.g. 34":"e.g. 12"}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Potencies from Products */}
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
              </div>
            );
          })}
        </div>
      </section>

      {/* Parameters + Tolerance */}
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
              placeholder="e.g. 8.4"
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
              placeholder="e.g. 435"
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
              placeholder="e.g. 1400"
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
              placeholder="e.g. 8.5"
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
              placeholder="e.g. 1420"
            />
          </div>
        </div>

        <h3 className="text-base font-semibold mt-4">Adjustment Range (tolerance)</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Only adjust if the difference from target exceeds this range. Example: target 8.5, drop to 8.3 with range 0.4 → no increase suggested.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Alk tolerance (dKH)</label>
            <input
              type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.alk ?? ""}
              onChange={(e)=>setTolerance(prev=>({ ...prev, alk: safeNum(e.target.value) }))}
              placeholder="e.g. 0.4"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Ca tolerance (ppm)</label>
            <input
              type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.ca ?? ""}
              onChange={(e)=>setTolerance(prev=>({ ...prev, ca: safeNum(e.target.value) }))}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Mg tolerance (ppm)</label>
            <input
              type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.mg ?? ""}
              onChange={(e)=>setTolerance(prev=>({ ...prev, mg: safeNum(e.target.value) }))}
              placeholder="e.g. 20"
            />
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-1">Recommended Daily Dose (total ml/day)</h2>
        <p className="text-xs text-muted-foreground mb-2">
          We first offset daily consumption, then gently correct toward target only when outside your tolerance range.
          "Add" shows the extra ml/day to add on top of your current daily dose.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["alk","ca","mg"] as const).map((k) => {
            const rawAdd = (deltaDose[k] ?? 0);
            const x = Math.max(0, Number.isFinite(rawAdd as number) ? (rawAdd as number) : 0);
            let shownInt = 0;
            let note = "";
            if (x >= 1) {
              shownInt = Math.floor(x);
              const diff = x - shownInt;
              if (diff > 0) note = `rounded down by ${round2(diff)} ml`;
            } else if (x >= 0.8) {
              shownInt = 1;
              const up = 1 - x;
              note = `rounded up by ${round2(up)} ml`;
            } else {
              shownInt = 0;
              if (x > 0) note = `rounded down by ${round2(x)} ml`;
            }
            const total = (currentDose[k] ?? 0) + shownInt;
            return (
              <div key={k} className="border rounded-xl p-3">
                <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
                <div className="text-2xl font-semibold">{round2(total)} ml/day</div>
                <div className="text-xs mt-1">Add: {shownInt} ml/day{note ? ` (${note})` : ""}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Effect per 1 ml for your tank is computed from your product line: (delta ÷ dose) × (reference volume ÷ your tank litres).
        </p>
      </section>
    </main>
  );
}
