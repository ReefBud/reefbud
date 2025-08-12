'use client';

import { useMemo, useState } from 'react';

type Units = 'L' | 'gal';

type Trio = {
  current: string; // text for inputs
  target: string;
  dose:   string;  // ml/day
};

const GAL_TO_L = 3.78541;

// Defaults (you can tweak later)
const DEFAULTS = {
  refVolL: 110,   // reference volume for factors
  alkFactor: 22,  // ml per +1.0 dKH @ refVol
  caFactor10: 12, // ml per +10 ppm Ca @ refVol
  mgFactor10: 50, // ml per +10 ppm Mg @ refVol
  alkSafe: 0.25,  // dKH/day
  caSafe: 20,     // ppm/day
  mgSafe: 50,     // ppm/day
  roundTo: 0.1,   // ml rounding
};

function toLiters(v: number, units: Units) {
  return units === 'gal' ? v * GAL_TO_L : v;
}
function num(x: string, fallback = NaN) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}
function roundTo(v: number, step = DEFAULTS.roundTo) {
  return Math.round(v / step) * step;
}
function mlPerUnitAtTank(baseMlAtRef: number, refVolL: number, tankVolL: number, perUnits: number) {
  const scale = (tankVolL || 0) / (refVolL || 1);
  return (baseMlAtRef || 0) * scale / (perUnits || 1);
}
function safeDailyDoseChange(delta: number, safePerDay: number, mlPerUnit: number) {
  if (!Number.isFinite(delta) || !Number.isFinite(safePerDay) || !Number.isFinite(mlPerUnit)) return 0;
  const step = Math.min(Math.abs(delta), Math.abs(safePerDay));
  const sign = delta >= 0 ? 1 : -1;
  return sign * step * mlPerUnit;
}
function expectedDays(delta: number, safePerDay: number) {
  const d = Math.abs(delta || 0);
  const s = Math.abs(safePerDay || 1e-6);
  return Math.ceil(d / s);
}

export default function CalculatorPage() {
  // Volume
  const [volUnits, setVolUnits] = useState<Units>('L');
  const [volValue, setVolValue] = useState<string>('110');

  // Inputs
  const [alk, setAlk] = useState<Trio>({ current: '', target: '', dose: '' });
  const [ca,  setCa ] = useState<Trio>({ current: '', target: '', dose: '' });
  const [mg,  setMg ] = useState<Trio>({ current: '', target: '', dose: '' });

  // Advanced config
  const [refVolL,     setRefVolL]     = useState<string>(String(DEFAULTS.refVolL));
  const [alkFactor,   setAlkFactor]   = useState<string>(String(DEFAULTS.alkFactor));
  const [caFactor10,  setCaFactor10]  = useState<string>(String(DEFAULTS.caFactor10));
  const [mgFactor10,  setMgFactor10]  = useState<string>(String(DEFAULTS.mgFactor10));
  const [alkSafe,     setAlkSafe]     = useState<string>(String(DEFAULTS.alkSafe));
  const [caSafe,      setCaSafe]      = useState<string>(String(DEFAULTS.caSafe));
  const [mgSafe,      setMgSafe]      = useState<string>(String(DEFAULTS.mgSafe));
  const [round,       setRound]       = useState<string>(String(DEFAULTS.roundTo));

  const liters = useMemo(() => {
    const v = Number(volValue);
    return Number.isFinite(v) ? Number(toLiters(v, volUnits).toFixed(2)) : NaN;
  }, [volValue, volUnits]);

  const results = useMemo(() => {
    const tankL = Number.isFinite(liters) ? liters : 0;
    const rVol = num(refVolL, DEFAULTS.refVolL);

    const mlPer_dKH   = mlPerUnitAtTank(num(alkFactor,  DEFAULTS.alkFactor),  rVol, tankL, 1);
    const mlPer_ppmCa = mlPerUnitAtTank(num(caFactor10, DEFAULTS.caFactor10), rVol, tankL, 10);
    const mlPer_ppmMg = mlPerUnitAtTank(num(mgFactor10, DEFAULTS.mgFactor10), rVol, tankL, 10);

    const rows = [
      {
        label: 'Alkalinity', unit: 'dKH',
        current: num(alk.current), target: num(alk.target),
                          currentDose: num(alk.dose, 0),
                          delta: num(alk.target) - num(alk.current),
                          safePerDay: num(alkSafe, DEFAULTS.alkSafe),
                          mlPerUnit: mlPer_dKH,
      },
      {
        label: 'Calcium', unit: 'ppm',
        current: num(ca.current), target: num(ca.target),
                          currentDose: num(ca.dose, 0),
                          delta: num(ca.target) - num(ca.current),
                          safePerDay: num(caSafe, DEFAULTS.caSafe),
                          mlPerUnit: mlPer_ppmCa,
      },
      {
        label: 'Magnesium', unit: 'ppm',
        current: num(mg.current), target: num(mg.target),
                          currentDose: num(mg.dose, 0),
                          delta: num(mg.target) - num(mg.current),
                          safePerDay: num(mgSafe, DEFAULTS.mgSafe),
                          mlPerUnit: mlPer_ppmMg,
      },
    ] as const;

    const step = num(round, DEFAULTS.roundTo);

    return rows.map(r => {
      const doseChange = safeDailyDoseChange(r.delta, r.safePerDay, r.mlPerUnit);
      const newDose    = Math.max(0, r.currentDose + doseChange);
      const days       = expectedDays(r.delta, r.safePerDay);
      const trend      = doseChange > 0 ? 'up' : (doseChange < 0 ? 'down' : 'muted');
      return {
        ...r,
        doseChangeAbs: roundTo(Math.abs(doseChange), step),
                    newDose: roundTo(newDose, step),
                    days: Number.isFinite(days) && r.delta !== 0 ? days : null,
                    trend,
      };
    });
  }, [liters, refVolL, alkFactor, caFactor10, mgFactor10, alkSafe, caSafe, mgSafe, round, alk, ca, mg]);

  function resetAll() {
    setVolUnits('L'); setVolValue('');
    setAlk({ current: '', target: '', dose: '' });
    setCa ({ current: '', target: '', dose: '' });
    setMg ({ current: '', target: '', dose: '' });
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
    <div>
    <h1 className="text-xl font-semibold">Dosing Calculator</h1>
    <p className="text-sm text-gray-500">
    Calculate safe daily dose changes for Alkalinity, Calcium, and Magnesium.
    </p>
    </div>

    {/* Tank volume */}
    <div className="grid gap-3 md:grid-cols-3">
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Tank volume</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input
    className="w-full bg-transparent outline-none"
    type="number" step="any"
    value={volValue}
    onChange={e => setVolValue(e.target.value)}
    placeholder="e.g., 110"
    />
    <span className="text-gray-500 text-xs">{volUnits}</span>
    </div>
    <div className="text-xs text-gray-500 mt-1">
    Enter liters or select gallons — liters auto-calculated.
    </div>
    </label>

    <label className="text-sm">
    <span className="mb-1 block opacity-80">Volume units</span>
    <select
    className="w-full rounded-md border px-2 py-1.5"
    value={volUnits}
    onChange={e => setVolUnits(e.target.value as Units)}
    >
    <option value="L">Liters (L)</option>
    <option value="gal">Gallons (US)</option>
    </select>
    </label>

    <label className="text-sm">
    <span className="mb-1 block opacity-80">Effective liters (auto)</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input
    className="w-full bg-transparent outline-none"
    value={Number.isFinite(liters) ? liters : ''}
    readOnly
    />
    <span className="text-gray-500 text-xs">L</span>
    </div>
    </label>
    </div>

    {/* Inputs */}
    <div className="grid gap-3 md:grid-cols-3">
    {/* Alk */}
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current Alkalinity</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="e.g., 8.5" value={alk.current}
    onChange={e => setAlk(s => ({ ...s, current: e.target.value }))} />
    <span className="text-gray-500 text-xs">dKH</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Target Alkalinity</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="7–12" value={alk.target}
    onChange={e => setAlk(s => ({ ...s, target: e.target.value }))} />
    <span className="text-gray-500 text-xs">dKH</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current daily Alk dose</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="ml/day" value={alk.dose}
    onChange={e => setAlk(s => ({ ...s, dose: e.target.value }))} />
    <span className="text-gray-500 text-xs">ml/day</span>
    </div>
    </label>

    {/* Ca */}
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current Calcium</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="e.g., 420" value={ca.current}
    onChange={e => setCa(s => ({ ...s, current: e.target.value }))} />
    <span className="text-gray-500 text-xs">ppm</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Target Calcium</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="400–450" value={ca.target}
    onChange={e => setCa(s => ({ ...s, target: e.target.value }))} />
    <span className="text-gray-500 text-xs">ppm</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current daily Ca dose</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="ml/day" value={ca.dose}
    onChange={e => setCa(s => ({ ...s, dose: e.target.value }))} />
    <span className="text-gray-500 text-xs">ml/day</span>
    </div>
    </label>

    {/* Mg */}
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current Magnesium</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="e.g., 1380" value={mg.current}
    onChange={e => setMg(s => ({ ...s, current: e.target.value }))} />
    <span className="text-gray-500 text-xs">ppm</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Target Magnesium</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="1350–1450" value={mg.target}
    onChange={e => setMg(s => ({ ...s, target: e.target.value }))} />
    <span className="text-gray-500 text-xs">ppm</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Current daily Mg dose</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    placeholder="ml/day" value={mg.dose}
    onChange={e => setMg(s => ({ ...s, dose: e.target.value }))} />
    <span className="text-gray-500 text-xs">ml/day</span>
    </div>
    </label>
    </div>

    {/* Advanced */}
    <details className="rounded-md border p-3">
    <summary className="cursor-pointer text-sm font-semibold">Advanced: correction factors & safe daily limits</summary>
    <div className="grid gap-3 md:grid-cols-4 mt-3">
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Reference volume</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    value={refVolL} onChange={e => setRefVolL(e.target.value)} />
    <span className="text-gray-500 text-xs">L</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Alk factor (ml / +1 dKH @ ref)</span>
    <input className="w-full rounded-md border px-2 py-1.5" type="number" step="any"
    value={alkFactor} onChange={e => setAlkFactor(e.target.value)} />
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Ca factor (ml / +10 ppm @ ref)</span>
    <input className="w-full rounded-md border px-2 py-1.5" type="number" step="any"
    value={caFactor10} onChange={e => setCaFactor10(e.target.value)} />
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Mg factor (ml / +10 ppm @ ref)</span>
    <input className="w-full rounded-md border px-2 py-1.5" type="number" step="any"
    value={mgFactor10} onChange={e => setMgFactor10(e.target.value)} />
    </label>
    </div>
    <div className="grid gap-3 md:grid-cols-4 mt-3">
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Alk max change/day</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    value={alkSafe} onChange={e => setAlkSafe(e.target.value)} />
    <span className="text-gray-500 text-xs">dKH/day</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Ca max change/day</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    value={caSafe} onChange={e => setCaSafe(e.target.value)} />
    <span className="text-gray-500 text-xs">ppm/day</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Mg max change/day</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    value={mgSafe} onChange={e => setMgSafe(e.target.value)} />
    <span className="text-gray-500 text-xs">ppm/day</span>
    </div>
    </label>
    <label className="text-sm">
    <span className="mb-1 block opacity-80">Rounding</span>
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
    <input className="w-full bg-transparent outline-none" type="number" step="any"
    value={round} onChange={e => setRound(e.target.value)} />
    <span className="text-gray-500 text-xs">ml</span>
    </div>
    </label>
    </div>
    </details>

    {/* Actions */}
    <div className="flex gap-2">
    <button
    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
    onClick={resetAll}
    >
    Reset
    </button>
    </div>

    {/* Results */}
    <div className="overflow-x-auto rounded-md border">
    <table className="min-w-[720px] w-full">
    <thead>
    <tr className="border-b bg-gray-50 text-xs text-gray-600">
    <th className="text-left p-2">Parameter</th>
    <th className="text-left p-2">Current dose</th>
    <th className="text-left p-2">Dose increase (ml/day)</th>
    <th className="text-left p-2">New dose (ml/day)</th>
    <th className="text-left p-2">Expected time to target</th>
    </tr>
    </thead>
    <tbody className="[&>tr:last-child>td]:border-b-0">
    {results.map((r) => {
      const verb = (r as any).trend === 'up' ? 'Increase' : (r as any).trend === 'down' ? 'Decrease' : 'No change';
      const days = (r as any).days;
      return (
        <tr key={(r as any).label}>
        <td className="p-2 border-b">
        <strong>{(r as any).label}</strong>{' '}
        <span className="text-xs text-gray-500">
        ({Number.isFinite((r as any).current) ? (r as any).current : '—'}
        {' '}→{' '}
        {Number.isFinite((r as any).target) ? (r as any).target : '—'} {(r as any).unit})
        </span>
        </td>
        <td className="p-2 border-b">
        {Number.isFinite((r as any).currentDose) ? (r as any).currentDose : 0}
        <span className="text-xs text-gray-500"> ml/day</span>
        </td>
        <td className="p-2 border-b">
        <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold"
        style={{ background: 'rgba(0,0,0,0.05)' }}>
        {verb} {(r as any).doseChangeAbs} ml/day
        </span>
        </td>
        <td className="p-2 border-b">
        <strong>{(r as any).newDose}</strong>
        <span className="text-xs text-gray-500"> ml/day</span>
        </td>
        <td className="p-2 border-b">
        {days ? `${days} day${days > 1 ? 's' : ''}` : '—'}
        </td>
        </tr>
      );
    })}
    </tbody>
    </table>
    </div>

    <p className="text-xs text-gray-500">
    Assumes linear response; monitor with tests and adjust as needed.
    </p>
    </div>
  );
}
