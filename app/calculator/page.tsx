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

type PreferredPotency = {
  parameter_key: "alk" | "ca" | "mg";
  perLiter: number | null;
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

  useEffect(() => {
    const compute = () => {
      const keys: Array<keyof Doses> = ["alk", "ca", "mg"];
      const req: Doses = {};
      const delta: Doses = {};

      for (const k of keys) {
        const currDose = currentDose[k] ?? 0;
        const currVal = current[k];
        const targVal = target[k];
        const perL = potencies[k].perLiter;
        const perT = potencies[k].perTank;

        let incPerMlTank: number | undefined = undefined;
        if (mode === "perLiter") {
          if (perL !== undefined && tankLiters !== undefined) incPerMlTank = perL * tankLiters;
        } else {
          if (perT !== undefined) incPerMlTank = perT;
        }

        if (
          incPerMlTank !== undefined &&
          incPerMlTank !== 0 &&
          currVal !== undefined &&
          targVal !== undefined
        ) {
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
    };

    compute();
  }, [tankLiters, currentDose, potencies, current, target, mode]);

  async function autofillFromPreferred() {
    try {
      setLoadingPref(true);

      // Prefill tank size from latest tank
      const { data: tanks, error: tErr } = await supabase
      .from("tanks")
      .select("id, name, volume_liters, volume_value")
      .order("created_at", { ascending: false })
      .limit(1);
      if (tErr) throw tErr;

      const tank = tanks?.[0] ?? null;
      if (tank) {
        const vol =
        typeof tank.volume_liters === "number"
        ? tank.volume_liters
        : typeof tank.volume_value === "number"
        ? tank.volume_value
        : undefined;
        if (vol && !tankLiters) setTankLiters(vol);
      }

      // Pull preferred products and compute per-liter potency
      const { data: prefs, error: pErr } = await supabase
      .from("preferred_products")
      .select(
        "parameter_key, products:product_id (brand, name, dose_ref_ml, delta_ref_value, volume_ref_liters)"
      )
      .in("parameter_key", ["alk", "ca", "mg"])
      .limit(10);
      if (pErr) throw pErr;

      const next: Potencies = { alk: {}, ca: {}, mg: {} };
      for (const row of prefs || []) {
        const pk = (row as any).parameter_key as "alk" | "ca" | "mg";
        const prod: any = (row as any).products ?? {};
        const doseRef = Number(prod?.dose_ref_ml);
        const deltaRef = Number(prod?.delta_ref_value);
        const volRef = Number(prod?.volume_ref_liters);
        if (
          Number.isFinite(doseRef) &&
          doseRef > 0 &&
          Number.isFinite(deltaRef) &&
          Number.isFinite(volRef) &&
          volRef > 0
        ) {
          const perLiter = (deltaRef / doseRef) / volRef;
          next[pk].perLiter = perLiter;
        }
      }
      setPotencies((old) => ({ ...old, ...next }));
    } catch (e) {
      console.error(e);
      alert("Could not autofill from preferred products. Please enter potencies manually.");
    } finally {
      setLoadingPref(false);
    }
  }

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
    <input
    type="radio"
    name="mode"
    checked={mode === "perLiter"}
    onChange={() => setMode("perLiter")}
    />
    <span>Values are per ml per litre</span>
    </label>
    <label className="flex items-center gap-2">
    <input
    type="radio"
    name="mode"
    checked={mode === "perTank"}
    onChange={() => setMode("perTank")}
    />
    <span>Values are per ml for whole tank</span>
    </label>
    </div>
    <button
    type="button"
    className="mt-3 inline-flex items-center border rounded-lg px-3 py-2 text-sm"
    onClick={autofillFromPreferred}
    disabled={loadingPref}
    >
    {loadingPref ? "Loading..." : "Use preferred product potencies"}
    </button>
    </div>
    </div>
    </section>

    {/* Current dose */}
    <section className="rounded-2xl border p-4">
    <h2 className="text-lg font-semibold mb-3">Current Daily Dose (ml/day)</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {(["alk", "ca", "mg"] as const).map((k) => (
      <div key={k}>
      <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()}</label>
      <input
      type="number"
      inputMode="decimal"
      className="w-full border rounded-lg p-2 bg-background"
      value={currentDose[k] ?? ""}
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
    {(["alk", "ca", "mg"] as const).map((k) => (
      <div key={k} className="space-y-2">
      <div>
      <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()} per ml per litre</label>
      <input
      type="number"
      inputMode="decimal"
      className="w-full border rounded-lg p-2 bg-background"
      value={potencies[k].perLiter ?? ""}
      onChange={(e) =>
        setPotencies({ ...potencies, [k]: { ...potencies[k], perLiter: safeNum(e.target.value) } })
      }
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
      onChange={(e) =>
        setPotencies({ ...potencies, [k]: { ...potencies[k], perTank: safeNum(e.target.value) } })
      }
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
    {(["alk", "ca", "mg"] as const).map((k) => (
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
