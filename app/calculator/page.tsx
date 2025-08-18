/* app/calculator/page.tsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Doses = { alk?: number; ca?: number; mg?: number };
type Params = { alk?: number; ca?: number; mg?: number };
type Targets = Params;
type Tolerances = { alk?: number; ca?: number; mg?: number };

type ProductPotencyRaw = {
  per_liter?: number | null;   // preferred: units ↑ per ml per L
  dose_ml?: number | null;     // fallback label fields
  delta_value?: number | null;
  volume_liters?: number | null;
  brand?: string | null;
  name?: string | null;
};

function safeNum(n: unknown): number | undefined {
  if (n === null || n === undefined) return undefined;
  if (typeof n === "number") return Number.isFinite(n) ? n : undefined;
  if (typeof n === "string") {
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}
function round2(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "";
  return (Math.round(n * 100) / 100).toString();
}
function getNum(obj: any, key: string): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as any)[key];
  return safeNum(v);
}

// explicit record to satisfy TS
const PARAM_KEYS: Record<"alk"|"ca"|"mg", readonly string[]> = {
  alk: ["alk","alkalinity","kh","dkh","kh_dkh","alk_dkh"] as const,
  ca:  ["ca","calcium"] as const,
  mg:  ["mg","magnesium"] as const
} as const;

const PARAM_DISPLAY: Record<'alk'|'ca'|'mg', string> = {
  alk: 'Alkalinity',
  ca: 'Calcium',
  mg: 'Magnesium',
};

function potencyFor(pr: ProductPotencyRaw | undefined): number | undefined {
  if (!pr) return undefined;
  if (pr.per_liter !== null && pr.per_liter !== undefined) return pr.per_liter;
  if (
    pr.dose_ml && pr.delta_value != null && pr.volume_liters &&
    Number.isFinite(pr.dose_ml) && Number.isFinite(pr.delta_value) && Number.isFinite(pr.volume_liters) &&
    pr.dose_ml > 0 && pr.volume_liters > 0
  ) {
    return pr.delta_value / (pr.dose_ml * pr.volume_liters);
  }
  return undefined;
}
type SeriesPoint = { v: number; t: number };

async function trySelect(table: string, select: string, build: (q:any)=>any, limit=100) {
  try {
    let q = supabase.from(table as any).select(select as any);
    q = build(q);
    const { data, error } = await q.limit(limit);
    if (error || !data) return [];
    return data as any[];
  } catch (_e) { return []; }
}
async function trySingle(table: string, select: string, build: (q:any)=>any) {
  const rows = await trySelect(table, select, build, 1);
  return rows[0] ?? null;
}

// Try multiple filter patterns safely (avoid errors when a column doesn't exist)
async function fetchRowsFlexible(table: string, select: string, uid: string, tankId: any, limit=200) {
  const patterns: Array<(q:any)=>any> = [];
  patterns.push((q:any)=> q.eq("user_id", uid).eq("tank_id", tankId));
  patterns.push((q:any)=> q.eq("user_id", uid));
  patterns.push((q:any)=> q.eq("tank_id", tankId));
  patterns.push((q:any)=> q);
  for (const build of patterns) {
    const rows = await trySelect(table, select, build, limit);
    if (rows && rows.length) return rows;
  }
  return [];
}

export default function CalculatorPage() {
  const [tankLiters, setTankLiters] = useState<number | undefined>(undefined);
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});
  const [tolerance, setTolerance] = useState<Tolerances>({ alk: 0.0, ca: 0, mg: 0 });

  const [product, setProduct] = useState<{[K in 'alk'|'ca'|'mg']?: ProductPotencyRaw}>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});
  const [slopesPerDay, setSlopesPerDay] = useState<{[K in 'alk'|'ca'|'mg']?: number}>({});

  const [seriesByParam, setSeriesByParam] = useState<{[K in 'alk'|'ca'|'mg']?: SeriesPoint[]}>({});
  const hydratedRef = useRef(false);
  const [lookback, setLookback] = useState<3|5|7|10>(3);

  function incPerMlTankFor(param: keyof Doses): number | undefined {
    const pr = product[param as 'alk'|'ca'|'mg'];
    if (!pr || !tankLiters) return undefined;
    const V = tankLiters;
    const pL = pr.per_liter ?? undefined;
    if (pL && Number.isFinite(pL) && pL > 0) return pL * V;
    const D = pr.dose_ml ?? undefined, d = pr.delta_value ?? undefined, Vref = pr.volume_liters ?? undefined;
    if (!D || !d || !Vref || !V) return undefined;
    if (!Number.isFinite(D) || !Number.isFinite(d) || !Number.isFinite(Vref) || !Number.isFinite(V) || D <= 0 || Vref <= 0 || V <= 0) return undefined;
    return (d / D) * (Vref / V);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const uid: string = user.id;

      // 1) Tank volume (from Dashboard's tanks table)
      let tankId: any = null;
      let vol: number | undefined = undefined;
      try {
        const { data } = await supabase
          .from('tanks')
          .select('id, volume_liters, volume_value, preferred')
          .eq('user_id', uid)
          .order('preferred', { ascending: false })
          .order('created_at', { ascending: true });
        const rows = data || [];
        for (const r of rows) {
          const v = safeNum(r.volume_liters) ?? safeNum(r.volume_value);
          if (tankId === null) tankId = r.id;
          if (!vol && v && v > 0) { vol = v; tankId = r.id; }
        }
      } catch (_e) {
        // ignore
      }
      if (!cancelled && vol !== undefined && vol > 0) setTankLiters(vol);

      // 2) Targets
      const trows = await Promise.all([
        trySingle("targets", "user_id, alk, ca, mg", (q:any)=> q.eq("user_id", uid)),
        trySingle("user_targets", "user_id, alk, ca, mg", (q:any)=> q.eq("user_id", uid)),
        trySingle("dashboard_targets", "user_id, alk, ca, mg", (q:any)=> q.eq("user_id", uid)),
        trySingle("user_dashboard", "user_id, alk_target, ca_target, mg_target", (q:any)=> q.eq("user_id", uid)),
        trySingle("dashboard", "user_id, alk_target, ca_target, mg_target", (q:any)=> q.eq("user_id", uid)),
      ]);
      for (const row of trows) {
        if (!row) continue;
        const targ: any = {
          alk: safeNum((row as any).alk) ?? safeNum((row as any).alk_target),
          ca:  safeNum((row as any).ca)  ?? safeNum((row as any).ca_target),
          mg:  safeNum((row as any).mg)  ?? safeNum((row as any).mg_target),
        };
        if (targ.alk || targ.ca || targ.mg) { if (!cancelled) setTarget(targ); break; }
      }

      // 3) Parameter ID map (for numeric parameter_id columns)
      const paramRows = await trySelect("parameters", "id, key", (q:any)=> q.in("key", ["alk","ca","mg"]));
      const paramIdMap: {[K in 'alk'|'ca'|'mg']?: number} = {};
      for (const r of paramRows) {
        const k = typeof r?.key === "string" ? String(r.key).toLowerCase() : "";
        if (k === "alk" || k === "ca" || k === "mg") paramIdMap[k as 'alk'|'ca'|'mg'] = r.id;
      }

      // 4) Products potency (robust)
      async function loadProductFor(param: "alk"|"ca"|"mg"): Promise<ProductPotencyRaw | null> {
        const syns = new Set<string>(PARAM_KEYS[param].map(s=>s.toLowerCase()));
        const paramId = paramIdMap[param];
        const extract = (obj:any): ProductPotencyRaw | null => {
          if (!obj) return null;
          const potencyKeys = ["potency_per_ml_per_l","per_ml_per_l","effect_per_ml_per_l","ml_per_l_increase","increase_per_ml_per_l","ml_per_l_effect"];
          const labelDoseKeys = ["dose_ref_ml","dose_ml","reference_dose_ml"];
          const labelDeltaKeys = ["delta_ref_value","delta_increase","increase_value"];
          const labelVolKeys   = ["volume_ref_liters","reference_volume_liters","ref_volume_liters","tank_volume_liters"];
          const perL = potencyKeys.map(k => getNum(obj, k)).find(v=>v!==undefined);
          const doseMl = labelDoseKeys.map(k => getNum(obj, k)).find(v=>v!==undefined);
          const deltaV = labelDeltaKeys.map(k => getNum(obj, k)).find(v=>v!==undefined);
          const volL   = labelVolKeys.map(k => getNum(obj, k)).find(v=>v!==undefined);
          if (perL !== undefined || (doseMl && deltaV && volL)) {
            const derived = perL ?? (doseMl && deltaV && volL ? (deltaV / (doseMl * volL)) : undefined);
            return {
              per_liter: derived ?? null,
              dose_ml: doseMl ?? null,
              delta_value: deltaV ?? null,
              volume_liters: volL ?? null,
              brand: obj.brand ?? null,
              name: obj.name ?? null
            };
          }
          return null;
        };

        // A) preferred_products join (if present)
        const pref = await trySingle(
          "preferred_products",
          "user_id, parameter_key, products:product_id (brand, name, potency_per_ml_per_l, per_ml_per_l, effect_per_ml_per_l, ml_per_l_increase, increase_per_ml_per_l, ml_per_l_effect, dose_ref_ml, dose_ml, reference_dose_ml, delta_ref_value, delta_increase, increase_value, volume_ref_liters, reference_volume_liters, ref_volume_liters, tank_volume_liters)",
          (q:any)=> q.eq("user_id", uid).eq("parameter_key", param)
        );
        const p1 = extract(pref?.products) || extract(pref);
        if (p1) return p1;

        // B) products table (preferred first, then best text match)
        const products = await fetchRowsFlexible(
          "products",
          "brand, name, parameter_id, parameter_key, parameter, key, potency_per_ml_per_l, per_ml_per_l, effect_per_ml_per_l, ml_per_l_increase, increase_per_ml_per_l, ml_per_l_effect, dose_ref_ml, dose_ml, reference_dose_ml, delta_ref_value, delta_increase, increase_value, volume_ref_liters, reference_volume_liters, ref_volume_liters, tank_volume_liters, is_preferred, created_at, user_id",
          uid, tankId, 200
        );
        const scored = (products || []).map((r:any) => {
          const keys = [r.parameter_key, r.parameter, r.key, r.name].filter(Boolean).map((x:any)=> String(x).toLowerCase());
          const hit = keys.some((k:string)=> syns.has(k));
          const matchId = paramId !== undefined && r.parameter_id === paramId;
          const score = (r.is_preferred ? 3 : 0) + (matchId ? 2 : 0) + (hit ? 1 : 0);
          return { row:r, score };
        }).filter(s=> s.score > 0).sort((a,b)=> b.score - a.score);
        for (const s of scored) {
          const p = extract(s.row);
          if (p) return p;
        }

        // C) alternates
        for (const t of ["user_products","products_user","my_products"]) {
          const rows = await fetchRowsFlexible(t, "*", uid, tankId, 200);
          for (const r of rows) {
            if (paramId && r.parameter_id !== paramId) continue;
            const keys = [r.parameter_key, r.parameter, r.key, r.name].filter(Boolean).map((x:any)=> String(x).toLowerCase());
            if (keys.some((k:string)=> syns.has(k))) {
              const p = extract(r);
              if (p) return p;
            }
          }
        }
        return null;
      }
      const nextProductsEntries = await Promise.all(([
        "alk","ca","mg"
      ] as const).map(async (k) => [k, await loadProductFor(k)] as const));
      const nextProducts = Object.fromEntries(nextProductsEntries.filter(([,v])=>v !== null));
      if (!cancelled) setProduct((prev)=> ({...prev, ...nextProducts as any}));

      // 5) Series (no server-side ordering; sort client-side; robust key/time extraction)
      async function loadSeriesFor(pkey: "alk"|"ca"|"mg"): Promise<SeriesPoint[]> {
        const syns = new Set<string>(PARAM_KEYS[pkey].map(s=>s.toLowerCase()));
        const tables = ["results","readings","tests","measurements","water_tests","test_results","reef_results"];
        const valueCols = ["value","result_value","reading","measurement","value_dkh","value_ppm","val"];
        const timeCols  = ["measured_at","taken_at","tested_at","created_at","inserted_at","date","timestamp"];
        const keyCols   = ["parameter_id","parameter_key","parameter","param","key","name","type"];

        const extractValue = (r:any): number | undefined => {
          for (const k of valueCols) {
            const n = getNum(r, k);
            if (n !== undefined) return n;
            if (typeof r?.[k] === "string") {
              const f = parseFloat(r[k]); if (Number.isFinite(f)) return f;
            }
          }
          return undefined;
        };
        const extractTime = (r:any): number => {
          for (const k of timeCols) {
            const ts = r?.[k];
            if (ts) {
              const t = new Date(ts).getTime();
              if (Number.isFinite(t)) return t;
            }
          }
          return 0;
        };
        const keyMatch = (r:any): boolean => {
          if (paramIdMap[pkey] !== undefined && r?.parameter_id === paramIdMap[pkey]) return true;
          const txt = keyCols.map(k => r?.[k]).find(x => typeof x === "string");
          const s = txt ? String(txt).toLowerCase() : "";
          if (syns.has(s)) return true;
          if (pkey==="alk" && (s.includes("alk") || s.includes("kh") || s.includes("dkh"))) return true;
          if (pkey==="ca" && (s.includes("calcium") || s === "ca")) return true;
          if (pkey==="mg" && (s.includes("magnesium") || s === "mg")) return true;
          return false;
        };

        const rowsList = await Promise.all(tables.map(t => fetchRowsFlexible(t, "*", uid, tankId, 200)));
        for (let i = 0; i < tables.length; i++) {
          const rows = rowsList[i];
          if (!rows?.length) continue;
          const pts = rows
            .filter(keyMatch)
            .map((r:any)=> {
              const v = extractValue(r);
              const t = extractTime(r);
              return (v !== undefined && t > 0) ? { v, t } : null;
            })
            .filter(Boolean) as SeriesPoint[];
          if (pts.length) {
            pts.sort((a,b)=> b.t - a.t);
            return pts.slice(0, 10);
          }
        }
        return [];
      }
      const seriesEntries = await Promise.all(([
        "alk","ca","mg"
      ] as const).map(async (k) => [k, await loadSeriesFor(k)] as const));
      const map: any = Object.fromEntries(seriesEntries);
      if (!cancelled) {
        setSeriesByParam(map);
        if (!hydratedRef.current) {
          setCurrent({ alk: map.alk?.[0]?.v, ca: map.ca?.[0]?.v, mg: map.mg?.[0]?.v });
          const slopeOf = (pts: SeriesPoint[]) => {
            if (pts.length < 2) return 0;
            const t0 = pts[pts.length - 1].t;
            const ps = pts.map(p => ({ x: (p.t - t0)/(1000*60*60*24), y: p.v }));
            const n = ps.length;
            const sumx = ps.reduce((a,b)=>a+b.x,0);
            const sumy = ps.reduce((a,b)=>a+b.y,0);
            const sumxx = ps.reduce((a,b)=>a+b.x*b.x,0);
            const sumxy = ps.reduce((a,b)=>a+b.x*b.y,0);
            const denom = (n*sumxx - sumx*sumx);
            return denom !== 0 ? (n*sumxy - sumx*sumy)/denom : 0;
          };
          setSlopesPerDay({ alk: slopeOf(map.alk ?? []), ca: slopeOf(map.ca ?? []), mg: slopeOf(map.mg ?? []) });
          hydratedRef.current = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Dose compute (consumption cancel + gentle correction + tolerance)
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
      const tol = tolerance[k as 'alk'|'ca'|'mg'] ?? 0;
      const slope = slopesPerDay[k as 'alk'|'ca'|'mg'] ?? 0;
      const incPerMl = incPerMlTankFor(k);

      if (incPerMl && incPerMl > 0) {
        let holdAdjust = 0;
        let correctionAdjust = 0;

        if (targVal !== undefined && currVal !== undefined) {
          const deficit = targVal - currVal;
          const outsideBand = Math.abs(deficit) > tol;
          if (outsideBand && deficit > 0) {
            if (slope < -epsilon) holdAdjust = Math.abs(slope) / incPerMl;           // cancel daily drop
            if (slope <=  epsilon) correctionAdjust = (deficit / incPerMl) / horizonDays; // gentle catch-up
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
    setDeltaDose(delta);
  }, [tankLiters, currentDose, current, target, product, slopesPerDay, tolerance]);

  // Change over last N readings (latest minus Nth)
  const changeOverLookback = useMemo(() => {
    const out: {[K in 'alk'|'ca'|'mg']?: number} = {};
    (["alk","ca","mg"] as const).forEach(k => {
      const s = seriesByParam[k] ?? [];
      if (s.length >= lookback) {
        const latest = s[0].v;
        const nth = s[lookback-1].v;
        const diff = latest - nth;
        out[k] = Math.round(diff * 10) / 10;
      } else {
        out[k] = undefined;
      }
    });
    return out;
  }, [seriesByParam, lookback]);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
      <p className="text-sm text-muted-foreground">
        Tank size & targets: dashboard. Potencies: Products tab (per‑ml‑per‑L preferred; label fallback). Readings/consumption: latest 1–10 results.
      </p>

      {/* Tank */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Tank</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Tank size (litres)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tankLiters ?? ""} onChange={(e)=>setTankLiters(safeNum(e.target.value))} placeholder="e.g. 110"/>
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
              <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
                value={currentDose[k as keyof Doses] ?? ""} onChange={(e)=>setCurrentDose({ ...currentDose, [k]: safeNum(e.target.value) })} />
            </div>
          ))}
        </div>
      </section>

      {/* Potencies */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">Potency of Your Products</h2>
        <p className="text-sm text-muted-foreground mb-3">Per ml per L is preferred; otherwise we use your product label.</p>
        <div className="space-y-3">
          {(["alk","ca","mg"] as const).map((k) => {
            const pr = product[k];
            const pot = potencyFor(pr);
            return (
              <div key={k} className="border rounded-xl p-3">
                {pr ? (
                  <>
                    <div className="font-medium">
                      {pr.brand ? `${pr.brand} ${pr.name ? '— ' : ''}` : ''}{pr.name || (!pr.brand ? k.toUpperCase() : '')}
                    </div>
                    {pot !== undefined ? (
                      <div className="text-sm text-muted-foreground">{PARAM_DISPLAY[k]} • potency ≈ {pot.toFixed(6)} units/ml/L</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{PARAM_DISPLAY[k]} • no potency set</div>
                    )}
                  </>
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
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={current.alk ?? ""} onChange={(e)=>setCurrent({ ...current, alk: safeNum(e.target.value) })} placeholder="e.g. 8.4" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Ca (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={current.ca ?? ""} onChange={(e)=>setCurrent({ ...current, ca: safeNum(e.target.value) })} placeholder="e.g. 435" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Mg (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={current.mg ?? ""} onChange={(e)=>setCurrent({ ...current, mg: safeNum(e.target.value) })} placeholder="e.g. 1400" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Alk (dKH)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={target.alk ?? ""} onChange={(e)=>setTarget({ ...target, alk: safeNum(e.target.value) })} placeholder="e.g. 8.5" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Ca (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={target.ca ?? ""} onChange={(e)=>setTarget({ ...target, ca: safeNum(e.target.value) })} placeholder="e.g. 430" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Target Mg (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={target.mg ?? ""} onChange={(e)=>setTarget({ ...target, mg: safeNum(e.target.value) })} placeholder="e.g. 1420" />
          </div>
        </div>

        {/* Change over last N readings selector */}
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-semibold">Change over last</h3>
            <select
              className="border rounded-lg px-2 py-1 bg-background"
              value={lookback}
              onChange={(e)=>setLookback(Number(e.target.value) as 3|5|7|10)}
            >
              <option value={3}>3 readings</option>
              <option value={5}>5 readings</option>
              <option value={7}>7 readings</option>
              <option value={10}>10 readings</option>
            </select>
            <span className="text-sm text-muted-foreground">Δ = reading #1 − reading #{String(lookback)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["alk","ca","mg"] as const).map((k)=>{
              const delta = changeOverLookback[k];
              return (
                <div key={k} className="border rounded-xl p-3">
                  <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
                  <div className="text-lg">
                    {delta === undefined ? "—" : `${delta > 0 ? "+" : ""}${round2(delta)}`}
                    <span className="text-sm text-muted-foreground ml-1">{k==="alk"?" dKH": k==="ca"?" ppm":" ppm"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <h3 className="text-base font-semibold mt-4">Adjustment Range (tolerance)</h3>
        <p className="text-xs text-muted-foreground mb-2">Only adjust if the difference from target exceeds this range.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Alk tolerance (dKH)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.alk ?? ""} onChange={(e)=>setTolerance(prev=>({ ...prev, alk: safeNum(e.target.value) }))} placeholder="e.g. 0.4" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Ca tolerance (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.ca ?? ""} onChange={(e)=>setTolerance(prev=>({ ...prev, ca: safeNum(e.target.value) }))} placeholder="e.g. 10" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Mg tolerance (ppm)</label>
            <input type="number" inputMode="decimal" className="w-full border rounded-lg p-2 bg-background"
              value={tolerance.mg ?? ""} onChange={(e)=>setTolerance(prev=>({ ...prev, mg: safeNum(e.target.value) }))} placeholder="e.g. 20" />
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-1">Recommended Daily Dose (total ml/day)</h2>
        <p className="text-xs text-muted-foreground mb-2">
          We offset daily consumption, then gently correct toward target only when outside your tolerance band.
          “Add” shows extra ml/day on top of your current daily dose.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["alk", "ca", "mg"] as const).map((k) => {
            const currDose = currentDose[k] ?? 0;
            const inc = deltaDose[k] ?? 0;
            const x = Math.max(0, Number.isFinite(inc as number) ? (inc as number) : 0);
            const add = x >= 1 ? Math.floor(x) : (x >= 0.8 ? 1 : 0);
            const total = Math.round((currDose + add) * 100) / 100;
            return (
              <div key={k} className="border rounded-xl p-3">
                <div className="text-sm text-muted-foreground">{k.toUpperCase()}</div>
                <div className="text-2xl font-semibold">{round2(total)} ml/day</div>
                <div className="text-xs mt-1">Add: {add} ml/day{ x>=1 && x-add>0 ? ` (rounded down by ${round2(x-add)} ml)` : (x>0 && x<0.8 ? ` (rounded down by ${round2(x)} ml)` : (x>=0.8 && x<1 ? ` (rounded up by ${round2(1-x)} ml)` : "")) }</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Effect per 1 ml for your tank uses per‑ml‑per‑L from Products when available; otherwise computed from your label line.
        </p>
      </section>
    </main>
  );
}
