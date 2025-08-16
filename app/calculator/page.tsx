// app/calculator/page.tsx
'use client';

import { useState } from 'react';
import { computeDoses, type DoseInputs, type DoseResult } from '@/lib/doseMath';

export default function CalculatorPage() {
  const [inputs, setInputs] = useState<DoseInputs>({
    tankLiters: 35,
    currentAlkMl: 30,
    currentCaMl:  10,
    currentMgMl:  10,
    alkPerMlPerL: 0.073,
    caPerMlPerL:  0.0,
    mgPerMlPerL:  0.0,
    currentAlk: 6.7,
    currentCa: 420,
    currentMg: 1280,
    targetAlk: 8.0,
    targetCa:  440,
    targetMg:  1350,
    tolerance: { alk: 0.05, ca: 2, mg: 5 },
    roundMl: 0.1
  });

  const [result, setResult] = useState<DoseResult | null>(null);

  const handleNumber = (key: keyof DoseInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value || '0');
    setInputs(prev => ({ ...prev, [key]: isNaN(v) ? 0 : v }));
  };

  const calc = () => {
    const r = computeDoses(inputs);
    setResult(r);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
      <p className="text-sm opacity-80">
        Potencies are specified as increase per 1 ml per 1 liter of tank. The math scales these to your full tank size.
      </p>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border">
          <h2 className="font-medium mb-2">Tank</h2>
          <label className="block text-sm mb-1">Tank size (L)</label>
          <input className="w-full border rounded px-3 py-2" type="number" value={inputs.tankLiters} onChange={handleNumber('tankLiters')} />
        </div>

        <div className="p-4 rounded-xl border">
          <h2 className="font-medium mb-2">Tolerance and Rounding</h2>
          <label className="block text-sm mb-1">Round dose to (ml)</label>
          <input className="w-full border rounded px-3 py-2" type="number" value={inputs.roundMl ?? 0.1} onChange={handleNumber('roundMl')} />
          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
            <div>
              <label className="block mb-1">Alk tol (dKH)</label>
              <input className="w-full border rounded px-2 py-1" type="number" value={inputs.tolerance?.alk ?? 0} onChange={(e)=>setInputs(p => ({...p, tolerance:{...p.tolerance, alk: parseFloat(e.target.value||'0')}}))} />
            </div>
            <div>
              <label className="block mb-1">Ca tol (ppm)</label>
              <input className="w-full border rounded px-2 py-1" type="number" value={inputs.tolerance?.ca ?? 0} onChange={(e)=>setInputs(p => ({...p, tolerance:{...p.tolerance, ca: parseFloat(e.target.value||'0')}}))} />
            </div>
            <div>
              <label className="block mb-1">Mg tol (ppm)</label>
              <input className="w-full border rounded px-2 py-1" type="number" value={inputs.tolerance?.mg ?? 0} onChange={(e)=>setInputs(p => ({...p, tolerance:{...p.tolerance, mg: parseFloat(e.target.value||'0')}}))} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['Alk','Ca','Mg'] as const).map((k, idx) => {
          const key = k.toLowerCase();
          const fields = {
            currentDose: ('current' + k + 'Ml') as keyof DoseInputs,
            potency: (key + 'PerMlPerL') as keyof DoseInputs,
            current: ('current' + k) as keyof DoseInputs,
            target: ('target' + k) as keyof DoseInputs,
          };
          const labels:any = {
            Alk: { dose:'Current Alk dose (ml/day)', pot:'Potency dKH per ml per L', cur:'Current Alk (dKH)', tgt:'Target Alk (dKH)' },
            Ca:  { dose:'Current Ca dose (ml/day)',  pot:'Potency ppm per ml per L', cur:'Current Ca (ppm)',  tgt:'Target Ca (ppm)' },
            Mg:  { dose:'Current Mg dose (ml/day)',  pot:'Potency ppm per ml per L', cur:'Current Mg (ppm)',  tgt:'Target Mg (ppm)' },
          };
          return (
            <div key={k} className="p-4 rounded-xl border">
              <h2 className="font-medium mb-2">{k}</h2>
              <label className="block text-sm mb-1">{labels[k].dose}</label>
              <input className="w-full border rounded px-3 py-2 mb-2" type="number" value={inputs[fields.currentDose] as number} onChange={handleNumber(fields.currentDose)} />
              <label className="block text-sm mb-1">{labels[k].pot}</label>
              <input className="w-full border rounded px-3 py-2 mb-2" type="number" step="0.0001" value={inputs[fields.potency] as number} onChange={handleNumber(fields.potency)} />
              <label className="block text-sm mb-1">{labels[k].cur}</label>
              <input className="w-full border rounded px-3 py-2 mb-2" type="number" value={inputs[fields.current] as number} onChange={handleNumber(fields.current)} />
              <label className="block text-sm mb-1">{labels[k].tgt}</label>
              <input className="w-full border rounded px-3 py-2" type="number" value={inputs[fields.target] as number} onChange={handleNumber(fields.target)} />
            </div>
          );
        })}
      </section>

      <button onClick={calc} className="px-4 py-2 rounded-xl border shadow">Calculate</button>

      {result && (
        <section className="p-4 rounded-xl border">
          <h2 className="font-medium mb-2">New Daily Doses</h2>
          <ul className="space-y-1">
            <li>Alk: <strong>{result.newAlkMl}</strong> ml/day</li>
            <li>Ca: <strong>{result.newCaMl}</strong> ml/day</li>
            <li>Mg: <strong>{result.newMgMl}</strong> ml/day</li>
          </ul>
          <div className="mt-3 text-sm opacity-80">
            <div>Per-ml increases for your tank: Alk {result.details.incPerMl.alk.toFixed(4)} dKH/ml, Ca {result.details.incPerMl.ca.toFixed(4)} ppm/ml, Mg {result.details.incPerMl.mg.toFixed(4)} ppm/ml.</div>
            <div>Deltas to target: Alk {result.details.deltas.alk.toFixed(3)}, Ca {result.details.deltas.ca.toFixed(1)}, Mg {result.details.deltas.mg.toFixed(1)}.</div>
          </div>
        </section>
      )}
    </div>
  );
}
