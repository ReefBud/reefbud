
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductPicker from "@/components/ProductPicker";

type Tank = { id: string; volume_value: number };
type Product = { id:string; dose_ref_ml:number|null; delta_ref_value:number|null; volume_ref_liters:number|null; };

export default function CalculatorPage() {
  const [userId, setUserId] = useState<string|undefined>();
  const [tank, setTank] = useState<Tank|undefined>();
  const [param, setParam] = useState<"alk"|"ca"|"mg"|"po4"|"no3">("alk");
  const [currentValue, setCurrentValue] = useState<number>(8);
  const [targetValue, setTargetValue] = useState<number>(8.3);
  const [productId, setProductId] = useState<string|undefined>();
  const [currentDaily, setCurrentDaily] = useState<number>(0);
  const [rampDays, setRampDays] = useState<number>(3);
  const [product, setProduct] = useState<Product|undefined>();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: tanks } = await supabase.from("tanks").select("id, volume_value").eq("user_id", user.id).limit(1);
      if (tanks && tanks.length > 0) setTank(tanks[0] as any);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!productId) { setProduct(undefined); return; }
      const { data } = await supabase.from("products")
        .select("id, dose_ref_ml, delta_ref_value, volume_ref_liters")
        .eq("id", productId).single();
      setProduct(data as any);
    })();
  }, [productId]);

  const [result, setResult] = useState<null | { correctionMl:number; newDailyMl:number; math:Record<string,number>; warnings:string[] }>(null);

  function calculate() {
    const warnings: string[] = [];
    if (!tank) { setResult(null); return; }
    const V_tank = tank.volume_value;
    const delta_target = targetValue - currentValue;
    if (!product || !product.dose_ref_ml || !product.delta_ref_value || !product.volume_ref_liters) {
      setResult({ correctionMl: 0, newDailyMl: currentDaily, math: { V_tank, delta_target }, warnings: ["Select a product with potency data."] });
      return;
    }
    if (delta_target <= 0) {
      setResult({ correctionMl: 0, newDailyMl: currentDaily, math: { V_tank, delta_target }, warnings: ["At or above target. No increase recommended."] });
      return;
    }
    const u_per_ml_ref = product.delta_ref_value / product.dose_ref_ml;
    const u_per_ml_tank = u_per_ml_ref * (product.volume_ref_liters / V_tank);
    const correction_ml = delta_target / u_per_ml_tank;
    const newDailyMl = currentDaily + (rampDays > 0 ? correction_ml / rampDays : correction_ml);
    setResult({
      correctionMl: Number(correction_ml.toFixed(2)),
      newDailyMl: Number(newDailyMl.toFixed(2)),
      math: {
        V_tank,
        delta_target: Number(delta_target.toFixed(4)),
        u_per_ml_ref: Number(u_per_ml_ref.toFixed(6)),
        u_per_ml_tank: Number(u_per_ml_tank.toFixed(6))
      },
      warnings
    });
  }

  return (
    <main className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold">Calculator</h2>
        {!userId && <p className="text-sm text-gray-600">Sign in to use DB-backed products and tank volume.</p>}
      </div>

      {userId && (
        <section className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="block text-sm">Parameter</label>
              <select className="input" value={param} onChange={e=>setParam(e.target.value as any)}>
                <option value="alk">Alkalinity (dKH)</option>
                <option value="ca">Calcium (ppm)</option>
                <option value="mg">Magnesium (ppm)</option>
                <option value="po4">Phosphates (ppm)</option>
                <option value="no3">Nitrates (ppm)</option>
              </select></div>
            <div><label className="block text-sm">Current value</label>
              <input className="input" type="number" step="0.001" value={currentValue} onChange={e=>setCurrentValue(Number(e.target.value))} /></div>
            <div><label className="block text-sm">Target value</label>
              <input className="input" type="number" step="0.001" value={targetValue} onChange={e=>setTargetValue(Number(e.target.value))} /></div>
            <div><label className="block text-sm">Tank volume (L)</label>
              <input className="input" type="number" value={tank?.volume_value ?? ""} readOnly /><p className="text-xs text-gray-500">Change on Dashboard</p></div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Product</label>
              <ProductPicker parameterKey={param} value={productId} onChange={setProductId} />
              <p className="text-xs text-gray-500 mt-1">Pick a product with potency data.</p>
            </div>
            <div><label className="block text-sm">Current daily dose (ml/day)</label>
              <input className="input" type="number" step="0.1" value={currentDaily} onChange={e=>setCurrentDaily(Number(e.target.value))} /></div>
            <div><label className="block text-sm">Ramp days</label>
              <input className="input" type="number" min="1" value={rampDays} onChange={e=>setRampDays(Number(e.target.value))} />
              <p className="text-xs text-gray-500">We spread the correction over this many days.</p></div>
          </div>
          <button className="btn" onClick={calculate}>Calculate new dose</button>
        </section>
      )}

      {result && (
        <section className="card">
          <h3 className="font-medium mb-2">Result</h3>
          <p className="text-sm">Correction (one-time): <strong>{result.correctionMl} ml</strong></p>
          <p className="text-sm">Suggested new daily dose: <strong>{result.newDailyMl} ml/day</strong></p>
          <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-auto">{JSON.stringify(result.math, null, 2)}</pre>
          {result.warnings.length > 0 && (<ul className="mt-2 text-sm text-amber-600 list-disc ml-5">
            {result.warnings.map((w,i)=>(<li key={i}>{w}</li>))}
          </ul>)}
        </section>
      )}
    </main>
  );
}
