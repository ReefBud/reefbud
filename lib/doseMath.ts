/**
 * Dose/potency helpers with careful math.
 */

export function potencyPerMlPerL(opts: {
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
}): number | null {
  const { dose_ref_ml, delta_ref_value, volume_ref_liters } = opts;
  if (dose_ref_ml == null || delta_ref_value == null || volume_ref_liters == null) return null;
  if (dose_ref_ml <= 0 || volume_ref_liters <= 0) return null;
  return delta_ref_value / (dose_ref_ml * volume_ref_liters);
}

/**
 * ml needed to change by deltaUnits in a tank, given unitsPerMlPerL.
 */
export function doseMlForDelta(deltaUnits: number, unitsPerMlPerL: number, tankLiters: number): number {
  if (!isFinite(deltaUnits) || !isFinite(unitsPerMlPerL) || !isFinite(tankLiters)) return 0;
  if (unitsPerMlPerL <= 0 || tankLiters <= 0) return 0;
  return deltaUnits / (unitsPerMlPerL * tankLiters);
}

/**
 * Linear regression slope (units per day).
 */
export function slopePerDay(readings: { value: number; measured_at: string }[]): { slopePerDay: number, n: number } {
  if (!readings || readings.length < 2) return { slopePerDay: 0, n: readings ? readings.length : 0 };
  const rows = readings.slice().sort((a,b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  const t0 = new Date(rows[0].measured_at).getTime();
  const xs = rows.map(r => (new Date(r.measured_at).getTime() - t0) / (1000*60*60*24));
  const ys = rows.map(r => r.value);
  const n = xs.length;
  const sumx = xs.reduce((a,b)=>a+b,0);
  const sumy = ys.reduce((a,b)=>a+b,0);
  const sumxy = xs.reduce((acc,x,i)=>acc + x*ys[i], 0);
  const sumxx = xs.reduce((acc,x)=>acc + x*x, 0);
  const denom = (n*sumxx - sumx*sumx);
  if (Math.abs(denom) < 1e-9) return { slopePerDay: 0, n };
  const slope = (n*sumxy - sumx*sumy) / denom;
  return { slopePerDay: slope, n };
}

/**
 * Estimate consumption using user's current daily dose.
 * doseEffectPerDay = currentDailyMl * unitsPerMlPerL * tankLiters
 * observed slope = doseEffectPerDay - consumption  -> consumption = doseEffectPerDay - slope
 * Clamp to >= 0
 */
export function estimateConsumptionPerDay(observedSlope: number, currentDailyMl: number, unitsPerMlPerL: number, tankLiters: number): number {
  const doseEffectPerDay = (currentDailyMl || 0) * (unitsPerMlPerL || 0) * (tankLiters || 0);
  const est = doseEffectPerDay - observedSlope;
  return est > 0 ? est : 0;
}

/** Near-target thresholds */
export const nearThreshold = { alk: 0.2, ca: 10, mg: 20 };

/** Max safe spikes per day */
export const maxSpikePerDay = { alk: 1.0, ca: 20, mg: 50 };
