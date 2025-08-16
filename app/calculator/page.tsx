// app/calculator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Doses = { alk?: number; ca?: number; mg?: number };
type Params = { alk?: number; ca?: number; mg?: number };
type Targets = Params;
type Tolerances = { alk?: number; ca?: number; mg?: number };

type ProductPotencyRaw = {
  // Preferred direct potency from Products tab (units ↑ per ml per L):
  per_liter?: number | null;
  // Fallback label fields:
  dose_ml?: number | null;
  delta_value?: number | null;
  volume_liters?: number | null;
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

// parameter key synonyms → canonical keys
const PARAM_KEYS = {
  alk: ["alk", "alkalinity", "kh", "dkh", "kh_dkh", "alk_dkh"],
  ca: ["ca", "calcium"],
  mg: ["mg", "magnesium"],
} as const;

export default function CalculatorPage() {
  // Inputs / state
  const [tankLiters, setTankLiters] = useState<number | undefined>(undefined);
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});
  const [tolerance, setTolerance] = useState<Tolerances>({ alk: 0.0, ca: 0, mg: 0 });

  // Product entries per parameter
  const [product, setProduct] = useState<{ [K in "alk" | "ca" | "mg"]?: ProductPotencyRaw }>({});

  // Derived
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});
  const [slopesPerDay, setSlopesPerDay] = useState<{ [K in "alk" | "ca" | "mg"]?: number }>({});

  // Convert to per-ml effect for THIS tank
  // Prefer per_liter (units ↑ per ml per L). If missing, fall back to label math.
  function incPerMlTankFor(param: keyof Doses): number | undefined {
    const pr = product[param as "alk" | "ca" | "mg"];
    if (!pr || !tankLiters) return undefined;
    const V = tankLiters;

    // Preferred direct potency:
    const pL = pr.per_liter ?? undefined; // units ↑ per ml per L
    if (pL && Number.isFinite(pL) && pL > 0) {
      return pL * V; // units ↑ per ml for the *whole tank*
    }

    // Fallback: label math
    const D = pr.dose_ml ?? undefined,
    d = pr.delta_value ?? undefined,
    Vref = pr.volume_liters ?? undefined;
    if (!D || !d || !Vref || !V) return undefined;
    if (!Number.isFinite(D) || !Number.isFinite(d) || !Number.isFinite(Vref) || !Number.isFinite(V) || D <= 0 || Vref <= 0 || V <= 0)
      return undefined;
    return (d / D) * (Vref / V);
  }

  // Supabase helpers
  async function trySingle(table: string, select: string, filters: (q: any) => any) {
    let q = supabase.from(table as any).select(select as any);
    q = filters(q);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) return null;
    return data ?? null;
  }
  async function tryList(table: string, select: string, filters: (q: any) => any, limit = 7) {
    let q = supabase.from(table as any).select(select as any);
    q = filters(q);
    const { data, error } = await q.limit(limit);
    if (error) return null;
    return data ?? [];
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1) Tank litres — dashboard first, then tanks
      let tankId: any = null;
      let vol: number | undefined = undefined;

      const dashCandidates = [
        { table: "user_dashboard", cols: "user_id, tank_id, tank_volume_liters, tank_volume" },
     { table: "dashboard", cols: "user_id, tank_id, tank_volume_liters, tank_volume" },
     { table: "profiles", cols: "user_id, preferred_tank_id, tank_volume_liters, tank_volume" },
     { table: "user_settings", cols: "user_id, preferred_tank_id, tank_volume_liters, tank_volume" },
      ];
      for (const c of dashCandidates) {
        const row = await trySingle(c.table, c.cols, (q: any) => q.eq("user_id", user.id));
        if (row) {
          tankId = (row as any).tank_id ?? (row as any).preferred_tank_id ?? tankId;
          const v = (row as any).tank_volume_liters ?? (row as any).tank_volume;
          if (typeof v === "number" && v > 0) {
            vol = v;
            break;
          }
        }
      }
      if (!vol) {
        const prefTank = await trySingle(
          "tanks",
          "id, volume_liters, volume_value, preferred, user_id",
          (q: any) => q.eq("user_id", user.id).eq("preferred", true)
        );
        if (prefTank) {
          tankId = (prefTank as any).id;
          vol =
          typeof (prefTank as any).volume_liters === "number"
          ? (prefTank as any).volume_liters
          : typeof (prefTank as any).volume_value === "number"
          ? (prefTank as any).volume_value
          : vol;
        }
      }
      if (!vol) {
        const latestTank = await trySingle(
          "tanks",
          "id, volume_liters, volume_value, created_at, user_id",
          (q: any) => q.eq("user_id", user.id).order("created_at", { ascending: false })
        );
        if (latestTank) {
          tankId = (latestTank as any).id;
          vol =
          typeof (latestTank as any).volume_liters === "number"
          ? (latestTank as any).volume_liters
          : typeof (latestTank as any).volume_value === "number"
          ? (latestTank as any).volume_value
          : vol;
        }
      }
      if (vol && !cancelled) setTankLiters(vol);

      // 2) Targets — dashboard tables first, then targets tables
      const targetCandidates = [
        { table: "targets", cols: "user_id, alk, ca, mg" },
     { table: "user_targets", cols: "user_id, alk, ca, mg" },
     { table: "dashboard_targets", cols: "user_id, alk, ca, mg" },
     { table: "user_dashboard", cols: "user_id, alk_target, ca_target, mg_target" },
     { table: "dashboard", cols: "user_id, alk_target, ca_target, mg_target" },
      ];
      for (const c of targetCandidates) {
        const row = await trySingle(c.table, c.cols, (q: any) => q.eq("user_id", user.id));
        if (row) {
          setTarget({
            alk:
            typeof (row as any).alk === "number"
            ? (row as any).alk
            : typeof (row as any).alk_target === "number"
            ? (row as any).alk_target
            : undefined,
            ca:
            typeof (row as any).ca === "number"
            ? (row as any).ca
            : typeof (row as any).ca_target === "number"
            ? (row as any).ca_target
            : undefined,
            mg:
            typeof (row as any).mg === "number"
            ? (row as any).mg
            : typeof (row as any).mg_target === "number"
            ? (row as any).mg_target
            : undefined,
          });
          break;
        }
      }

      // 3) Products potency — prefer per-ml-per-L from Products tab; fallback to label
      const nextProducts: any = {};
      const prefs = await tryList(
        "preferred_products",
        "user_id, parameter_key, products:product_id (brand, name, potency_per_ml_per_l, per_ml_per_l, effect_per_ml_per_l, dose_ref_ml, delta_ref_value, volume_ref_liters)",
                                  (q: any) => q.in("parameter_key", ["alk", "ca", "mg"]).eq("user_id", user.id),
                                  20
      );
      if (prefs?.length) {
        for (const row of prefs as any[]) {
          const pk = (row as any).parameter_key as "alk" | "ca" | "mg";
          const prod: any = (row as any).products ?? {};
          const perL = [prod.potency_per_ml_per_l, prod.per_ml_per_l, prod.effect_per_ml_per_l]
          .map((v: any) => (typeof v === "number" ? v : undefined))
          .find(Boolean);
          nextProducts[pk] = {
            per_liter: perL ?? null,
     dose_ml: typeof prod.dose_ref_ml === "number" ? prod.dose_ref_ml : null,
     delta_value: typeof prod.delta_ref_value === "number" ? prod.delta_ref_value : null,
     volume_liters: typeof prod.volume_ref_liters === "number" ? prod.volume_ref_liters : null,
     brand: prod.brand ?? null,
     name: prod.name ?? null,
          };
        }
      }
      const unresolved = (["alk", "ca", "mg"] as const).filter((k) => !nextProducts[k]);
      if (unresolved.length) {
        const rows = await tryList(
          "products",
          "brand, name, potency_per_ml_per_l, per_ml_per_l, effect_per_ml_per_l, dose_ref_ml, delta_ref_value, volume_ref_liters, is_preferred, created_at, parameter_id, user_id",
          (q: any) => q.eq("user_id", user.id).order("is_preferred", { ascending: false }).order("created_at", { ascending: false }),
                                   50
        );
        const pickFor = () => {
          if (!rows?.length) return null;
          return rows.find(
            (r: any) => r.potency_per_ml_per_l ?? r.per_ml_per_l ?? r.effect_per_ml_per_l ?? r.dose_ref_ml
          );
        };
        for (const key of unresolved) {
          const prod = pickFor();
          if (prod) {
            const perL = [prod.potency_per_ml_per_l, prod.per_ml_per_l, prod.effect_per_ml_per_l]
            .map((v: any) => (typeof v === "number" ? v : undefined))
            .find(Boolean);
            nextProducts[key] = {
              per_liter: perL ?? null,
     dose_ml: typeof prod.dose_ref_ml === "number" ? prod.dose_ref_ml : null,
     delta_value: typeof prod.delta_ref_value === "number" ? prod.delta_ref_value : null,
     volume_liters: typeof prod.volume_ref_liters === "number" ? prod.volume_ref_liters : null,
     brand: prod.brand ?? null,
     name: prod.name ?? null,
            };
          }
        }
      }
      if (!cancelled) setProduct((prev) => ({ ...prev, ...nextProducts }));

      // 4) Current readings + slope from last 1–7 results
      if (tankId) {
        const tableCandidates = ["results", "readings", "tests", "measurements"];
        const valueCols = ["value", "result_value", "reading", "measurement"];

        async function loadSeries() {
          for (const table of tableCandidates) {
            const rows = await tryList(
              table,
              `user_id, tank_id, ${valueCols.join(", ")}, measured_at, created_at`,
                                       (q: any) => q.eq("user_id", user.id).eq("tank_id", tankId).order("measured_at", { ascending: false }),
                                       7
            );
            if (rows?.length) {
              const series = (rows as any[])
              .map((r) => {
                const vRaw = [r.value, r.result_value, r.reading, r.measurement].find((x: any) => typeof x === "number");
                const v = Number(vRaw);
                const tIso = r.measured_at ?? r.created_at;
                const t = tIso ? new Date(tIso).getTime() : 0;
                return { v, t };
              })
              .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
              if (series.length) return series;
            }
          }
          return [] as Array<{ v: number; t: number }>;
        }

        const series = await loadSeries();
        if (series.length) {
          const curr = Math.round(series[0].v * 100) / 100;
          setCurrent((prev) => ({ ...prev, alk: prev.alk ?? curr })); // at minimum, set Alk current if blank

          if (series.length >= 2) {
            const t0 = series[series.length - 1].t;
            const pts = series.map((p) => ({ x: (p.t - t0) / (1000 * 60 * 60 * 24), y: p.v }));
            const n = pts.length;
            const sumx = pts.reduce((a, b) => a + b.x, 0);
            const sumy = pts.reduce((a, b) => a + b.y, 0);
            const sumxx = pts.reduce((a, b) => a + b.x * b.x, 0);
            const sumxy = pts.reduce((a, b) => a + b.x * b.y, 0);
            const denom = n * sumxx - sumx * sumx;
            const slope = denom !== 0 ? (n * sumxy - sumx * sumy) / denom : 0;
            setSlopesPerDay((prev) => ({ ...prev, alk: slope }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dose calc: cancel consumption, gentle 7-day correction, tolerance guard
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
      const tol = tolerance[k as "alk" | "ca" | "mg"] ?? 0;
      const slope = slopesPerDay[k as "alk" | "ca" | "mg"] ?? 0;
      const incPerMl = incPerMlTankFor(k);

      if (incPerMl && incPerMl > 0) {
        let holdAdjust = 0;
        let correctionAdjust = 0;

        if (targVal !== undefined && currVal !== undefined) {
          const deficit = targVal - currVal; // >0 means below target
          const outsideBand = Math.abs(deficit) > tol;

          if (outsideBand && deficit > 0) {
            if (slope < -epsilon) holdAdjust = Math.abs(slope) / incPerMl; // cancel daily drop
            if (slope <= epsilon) correctionAdjust = (deficit / incPerMl) / horizonDays; // gentle catch-up
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

  // Rounding rule for “Add”
  function roundedIntAdd(raw: number | undefined) {
    if (raw === undefined || !Number.isFinite(raw)) return { add: 0, note: "" };
    const x = Math.max(0, raw);
    if (x >= 1) {
      const flo = Math.floor(x);
      const note = x - flo > 0 ? `rounded down by ${round2(x - flo)} ml` : "";
      return { add: flo, note };
    } else if (x >= 0.8) {
      return { add: 1, note: `rounded up by ${round2(1 - x)} ml` };
    } else {
      return { add: 0, note: x > 0 ? `rounded down by ${round2(x)} ml` : "" };
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
    <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
    <p className="text-sm text-muted-foreground">
    Tank size & targets are read from your dashboard. Potencies are read from your Products tab (per-ml-per-L preferred).
    Currents and daily consumption use your latest 1–7 results.
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
    {["alk", "ca", "mg"].map((k) => (
      <div key={k}>
      <label className="block text-sm text-muted-foreground mb-1">{k.toUpperCase()}</label>
      <input
      type="number"
      inputMode="decimal"
      className="w-full border rounded-lg p-2 bg-background"
      value={currentDose[k as keyof Doses] ?? ""}
      onChange={(e) => setCurrentDose({ ...currentDose, [k]: safeNum(e.target.value) })}
      placeholder={k === "alk" ? "e.g. 34" : "e.g. 12"}
      />
      </div>
    ))}
    </div>
    </section>

    {/* Potencies */}
    <section className="rounded-2xl border p-4">
    <h2 className="text-lg font-semibold mb-3">Potency of Your Products</h2>
    <p className="text-sm text-muted-foreground mb-3">
    We prefer the “per ml per L” field. If it’s missing, we use your label line and scale to your tank.
    </p>
    <div className="space-y-3">
    {(["alk", "ca", "mg"] as const).map((k) => {
      const pr: any = product[k];
      const perL = pr?.per_liter;
      return (
        <div key={k} className="border rounded-xl p-3">
        <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
        {perL ? (
          <div className="text-sm">
          Per ml per L: <strong>{round2(perL)}</strong>
          </div>
        ) : pr && pr.dose_ml && pr.delta_value != null && pr.volume_liters ? (
          <div className="text-sm">
          {pr.brand || pr.name ? (
            <div className="mb-1">
            {pr.brand ? `${pr.brand} ` : ""}
            {pr.name || ""}
            </div>
          ) : null}
          <div>
          <strong>{pr.dose_ml}</strong> ml raises <strong>{pr.delta_value}</strong> in a{" "}
          <strong>{pr.volume_liters}</strong> L tank.
          </div>
          </div>
        ) : (
          <div className="text-sm">No product found. Add it on the Products tab or set a preferred product.</div>
        )}
        </div>
      );
    })}
    </div>
    </section>

    {/* Parameters + tolerance */}
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
    Only adjust if the difference from target exceeds this range. (Example: target 8.5, drop to 8.3 with range 0.4 → no increase.)
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div>
    <label className="block text-sm text-muted-foreground mb-1">Alk tolerance (dKH)</label>
    <input
    type="number"
    inputMode="decimal"
    className="w-full border rounded-lg p-2 bg-background"
    value={tolerance.alk ?? ""}
    onChange={(e) => setTolerance((prev) => ({ ...prev, alk: safeNum(e.target.value) }))}
    placeholder="e.g. 0.4"
    />
    </div>
    <div>
    <label className="block text-sm text-muted-foreground mb-1">Ca tolerance (ppm)</label>
    <input
    type="number"
    inputMode="decimal"
    className="w-full border rounded-lg p-2 bg-background"
    value={tolerance.ca ?? ""}
    onChange={(e) => setTolerance((prev) => ({ ...prev, ca: safeNum(e.target.value) }))}
    placeholder="e.g. 10"
    />
    </div>
    <div>
    <label className="block text-sm text-muted-foreground mb-1">Mg tolerance (ppm)</label>
    <input
    type="number"
    inputMode="decimal"
    className="w-full border rounded-lg p-2 bg-background"
    value={tolerance.mg ?? ""}
    onChange={(e) => setTolerance((prev) => ({ ...prev, mg: safeNum(e.target.value) }))}
    placeholder="e.g. 20"
    />
    </div>
    </div>
    </section>

    {/* Results */}
    <section className="rounded-2xl border p-4">
    <h2 className="text-lg font-semibold mb-1">Recommended Daily Dose (total ml/day)</h2>
    <p className="text-xs text-muted-foreground mb-2">
    We offset daily consumption, then gently correct toward target only when you’re outside your tolerance band.
    “Add” shows the extra ml/day on top of your current daily dose.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {(["alk", "ca", "mg"] as const).map((k) => {
      const rawAdd = deltaDose[k] ?? 0;
      // rounding rule: floor to whole ml; if <1 and ≥0.8 → round up to 1; else 0
      const x = Math.max(0, Number.isFinite(rawAdd as number) ? (rawAdd as number) : 0);
      let add = 0;
      let note = "";
      if (x >= 1) {
        add = Math.floor(x);
        if (x - add > 0) note = `rounded down by ${round2(x - add)} ml`;
      } else if (x >= 0.8) {
        add = 1;
        note = `rounded up by ${round2(1 - x)} ml`;
      } else {
        add = 0;
        if (x > 0) note = `rounded down by ${round2(x)} ml`;
      }
      const total = (currentDose[k] ?? 0) + add;
      return (
        <div key={k} className="border rounded-xl p-3">
        <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
        <div className="text-2xl font-semibold">{round2(total)} ml/day</div>
        <div className="text-xs mt-1">Add: {add} ml/day{note ? ` (${note})` : ""}</div>
        </div>
      );
    })}
    </div>
    <p className="text-xs text-muted-foreground mt-3">
    Effect per 1 ml for your tank uses Products’ per-ml-per-L when available; otherwise it’s computed from your label line.
    </p>
    </section>
    </main>
  );
}
