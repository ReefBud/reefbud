// app/calculator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "perLiter" | "perTank";
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
  const [mode, setMode] = useState<Mode>("perLiter");
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [potencies, setPotencies] = useState<Potencies>({ alk: {}, ca: {}, mg: {} });
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});

  // Results
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});

  // Compute doses when inputs change
  useEffect(() => {
    const keys: Array<keyof Doses> = ["alk", "ca", "mg"];
    const req: Doses = {};
    const delta: Doses = {};
    for (const k of keys) {
      const currDose = currentDose[k] ?? 0;
      const currVal = current[k];
      const targVal = target[k];
      const perL = potencies[k].perLiter;
      const perT = potencies[k].perTank;

      let incPerMlTank: number | undefined;
      if (mode === "perLiter") {
        if (perL !== undefined && tankLiters !== undefined) incPerMlTank = perL * tankLiters;
      } else {
        if (perT !== undefined) incPerMlTank = perT;
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
  }, [tankLiters, currentDose, potencies, current, target, mode]);

  // Auto-prefill: targets, potencies, current values
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
          .select("id, name, volume_liters, volume_value")
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

        // Targets -> single row
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

        // Potencies -> preferred_products → products
        const { data: prefs } = await supabase
          .from("preferred_products")
          .select("parameter_key, products:product_id (brand, name, dose_ref_ml, delta_ref_value, volume_ref_liters)")
          .in("parameter_key", ["alk","ca","mg"])
          .limit(10);
        if (prefs && !cancelled) {
          const next: Potencies = { alk: {}, ca: {}, mg: {} };
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
          setPotencies(prev => ({ ...prev, ...next }));
        }

        // Current -> average of latest 3 Results per parameter
        if (tankId) {
          const { data: plist } = await supabase
            .from("parameters")
            .select("id, key")
            .in("key", ["alk","ca","mg"]);
          const idByKey = new Map<string, number>();
          for (const p of plist ?? []) idByKey.set((p as any).key, (p as any).id);

          const curr: any = {};
          for (const key of ["alk","ca","mg"] as const) {
            const pid = idByKey.get(key);
            if (!pid) continue;
            const { data: rows } = await supabase
              .from("results")
              .select("value, measured_at")
              .eq("user_id", user.id)
              .eq("tank_id", tankId)
              .eq("parameter_id", pid)
              .order("measured_at", { ascending: false })
              .limit(3);
            const vals = (rows ?? [])
              .map(r => Number((r as any).value))
              .filter(v => Number.isFinite(v));
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
        Enter your tank size, current daily doses, product potencies, and current vs target parameters.
        This tool suggests a daily dosing amount to reach your targets.
      </p>

      {/* Tank and mode */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Tank and Mode</h2>
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
          <div className="md:col-span-2">
            <label className="block text-sm text-muted-foreground mb-1">Potency mode</label>
            <div className="flex gap-3 flex-wrap">
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "perLiter"} onChange={() => setMode("perLiter")} />
                <span>Values are per ml per litre</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "perTank"} onChange={() => setMode("perTank")} />
                <span>Values are per ml for whole tank</span>
              </label>
            </div>
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
          Enter how much each parameter rises for 1 ml of your product.
          If you choose per litre, we multiply by your tank size.
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
          If potency mode is per litre, increase_per_ml_for_tank = potency_per_ml_per_litre × tank_litres.
        </p>
      </section>
    </main>
  );
}
