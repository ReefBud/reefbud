"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Potencies = {
  alk: { perLiter?: number; perTank?: number };
  ca:  { perLiter?: number; perTank?: number };
  mg:  { perLiter?: number; perTank?: number };
};
type Doses = { alk?: number; ca?: number; mg?: number };
type Params = { alk?: number; ca?: number; mg?: number };
type Targets = Params;

function safeNum(n: unknown): number | undefined {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  return Number.isFinite(v) ? v : undefined;
}
function round2(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "";
  return (Math.round(n * 100) / 100).toString();
}

export default function CalculatorPage() {
  const [loadingPref, setLoadingPref] = useState(false);

  // Inputs
  const [tankLiters, setTankLiters] = useState<number | undefined>(undefined);
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [potencies, setPotencies] = useState<Potencies>({ alk: {}, ca: {}, mg: {} });
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});

  // Results
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});

  // Compute doses when inputs change - prefer perLiter*tankLiters else perTank
  useEffect(() => {
    const keys: Array<keyof Doses> = ["alk", "ca", "mg"];
    const req: Doses = {};
    const delta: Doses = {};
    for (const k of keys) {
      const currDose = currentDose[k] ?? 0;
      const currVal = current[k];
      const targVal = target[k];

      let incPerMlTank: number | undefined;
      if (potencies[k].perLiter !== undefined && tankLiters !== undefined) {
        incPerMlTank = potencies[k].perLiter! * tankLiters;
      } else if (potencies[k].perTank !== undefined) {
        incPerMlTank = potencies[k].perTank!;
      }

      if (incPerMlTank !== undefined && incPerMlTank !== 0 && currVal !== undefined && targVal !== undefined) {
        const needed = currDose + (targVal - currVal) / incPerMlTank;
        req[k] = needed;
        delta[k] = needed - currDose;
      } else {
        req[k] = undefined;
        delta[k] = undefined;
      }
    }
    setRequiredDose(req);
    setDeltaDose(delta);
  }, [tankLiters, currentDose, potencies, current, target]);

  // Auto-fill: targets from dashboard, potencies from preferred products (fallback to latest user product),
  // current from average of last 3 results for latest tank.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPref(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Latest tank -> tankLiters
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

        // Potencies - preferred first
        const next: Potencies = { alk: {}, ca: {}, mg: {} };
        const { data: prefs } = await supabase
          .from("preferred_products")
          .select("parameter_key, products:product_id (dose_ref_ml, delta_ref_value, volume_ref_liters)")
          .in("parameter_key", ["alk","ca","mg"])
          .limit(10);
        if (prefs) {
          for (const row of prefs) {
            const pk = (row as any).parameter_key as "alk"|"ca"|"mg";
            const prod: any = (row as any).products ?? {};
            const doseRef = Number(prod?.dose_ref_ml);
            const deltaRef = Number(prod?.delta_ref_value);
            const volRef = Number(prod?.volume_ref_liters);
            if (Number.isFinite(doseRef) && doseRef > 0 && Number.isFinite(deltaRef) && Number.isFinite(volRef) && volRef > 0) {
              next[pk].perLiter = (deltaRef / doseRef) / volRef;
            }
          }
        }

        // Fallback - latest user product for any unresolved parameter
        const unresolved = (["alk","ca","mg"] as const).filter(k => next[k].perLiter == null);
        if (unresolved.length) {
          const { data: plist } = await supabase.from("parameters").select("id, key").in("key", unresolved as any);
          const idByKey = new Map<string, number>();
          for (const p of plist ?? []) idByKey.set((p as any).key, (p as any).id);
          const add: any = {};
          for (const key of unresolved) {
            const pid = idByKey.get(key);
            if (!pid) continue;
            const { data: prows } = await supabase
              .from("products")
              .select("dose_ref_ml, delta_ref_value, volume_ref_liters")
              .eq("user_id", user.id)
              .eq("parameter_id", pid)
              .order("created_at", { ascending: false })
              .limit(1);
            const p0: any = (prows ?? [])[0];
            if (p0) {
              const doseRef = Number(p0.dose_ref_ml);
              const deltaRef = Number(p0.delta_ref_value);
              const volRef = Number(p0.volume_ref_liters);
              if (Number.isFinite(doseRef) && doseRef > 0 && Number.isFinite(deltaRef) && Number.isFinite(volRef) && volRef > 0) {
                add[key] = { perLiter: (deltaRef / doseRef) / volRef };
              }
            }
          }
          if (Object.keys(add).length) {
            setPotencies(prev => ({ ...prev, ...next, ...add }));
          } else {
            setPotencies(prev => ({ ...prev, ...next }));
          }
        } else {
          setPotencies(prev => ({ ...prev, ...next }));
        }

        // Current - average of last 3 results for the latest tank
        if (tankId) {
          const { data: plist2 } = await supabase.from("parameters").select("id, key").in("key", ["alk","ca","mg"]);
          const idByKey2 = new Map<string, number>();
          for (const p of plist2 ?? []) idByKey2.set((p as any).key, (p as any).id);
          const curr: any = {};
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
              .limit(3);
            const vals = (rows ?? []).map(r => Number((r as any).value)).filter(v => Number.isFinite(v));
            if (vals.length) {
              const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
              curr[key] = Math.round(avg * 100) / 100;
            }
          }
          if (!cancelled) setCurrent(prev => ({ ...prev, ...curr }));
        }
      } finally {
        if (!cancelled) setLoadingPref(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
      <p className="text-sm text-muted-foreground">
        Potencies auto-fill from your preferred or latest products. Targets come from your dashboard.
        Currents are the average of your last 3 results.
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
              placeholder="e.g. 35"
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
                placeholder="e.g. 30"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Potencies */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Potency of Your Products</h2>
        <p className="text-sm text-muted-foreground mb-3">
          These values auto-fill from your preferred products, or your latest product per parameter if no preference is set.
          Ensure product entries use Alk in dKH, Ca & Mg in ppm.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["alk","ca","mg"] as const).map((k) => (
            <div key={k} className="space-y-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()} per ml per litre</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full border rounded-lg p-2 bg-background"
                  value={potencies[k].perLiter ?? ""}
                  onChange={(e) => setPotencies({ ...potencies, [k]: { ...potencies[k], perLiter: safeNum(e.target.value) } })}
                  placeholder={k === "alk" ? "dKH/L per ml" : "ppm/L per ml"}
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()} per ml for whole tank</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full border rounded-lg p-2 bg-background"
                  value={potencies[k].perTank ?? ""}
                  onChange={(e) => setPotencies({ ...potencies, [k]: { ...potencies[k], perTank: safeNum(e.target.value) } })}
                  placeholder={k === "alk" ? "dKH per ml" : "ppm per ml"}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Parameters */}
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

      {/* Results */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Recommended Daily Dose</h2>
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
          Formula: required = current_dose + (target - current) ÷ increase_per_ml_for_tank.
          If potency per litre is known, increase_per_ml_for_tank = potency_per_ml_per_litre × tank_litres.
          Otherwise we use potency per ml for the whole tank.
        </p>
      </section>
    </main>
  );
}
