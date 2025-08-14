/**
 * Spec math helpers for OroBit Reef Alkalinity Dosing Calculator
 */

export function potencyPerMlPerL(opts: {
  dose_ref_ml: number | null;
  delta_ref_value: number | null; // dKH or ppm
  volume_ref_liters: number | null;
}): number | null {
  const { dose_ref_ml, delta_ref_value, volume_ref_liters } = opts;
  if (dose_ref_ml == null || delta_ref_value == null || volume_ref_liters == null) return null;
  if (dose_ref_ml <= 0 || volume_ref_liters <= 0) return null;
  return delta_ref_value / (dose_ref_ml * volume_ref_liters);
}

export function slopePerDay(readings: { value: number; measured_at: string }[]): { slopePerDay: number, n: number } {
  if (!readings || readings.length < 2) return { slopePerDay: 0, n: readings ? readings.length : 0 };
  const rows = readings.slice().sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  const t0 = new Date(rows[0].measured_at).getTime();
  const xs = rows.map(r => (new Date(r.measured_at).getTime() - t0) / (1000 * 60 * 60 * 24)); // days
  const ys = rows.map(r => r.value);
  const n = xs.length;
  const sumx = xs.reduce((a, b) => a + b, 0);
  const sumy = ys.reduce((a, b) => a + b, 0);
  const sumxy = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumxx = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = (n * sumxx - sumx * sumx);
  if (Math.abs(denom) < 1e-9) return { slopePerDay: 0, n };
  const slope = (n * sumxy - sumx * sumy) / denom;
  return { slopePerDay: slope, n };
}

export function dosingCalculator({
  tank_L,
  current_value,
  target_value,
  avg_daily_slope_units_per_day,
  dose_ref_ml,
  volume_ref_L,
  delta_ref_units,
  strength_factor = 1.0,
}: {
  tank_L: number,
  current_value: number,
  target_value: number,
  avg_daily_slope_units_per_day: number, // negative => falling
  dose_ref_ml: number,
  volume_ref_L: number,
  delta_ref_units: number,
  strength_factor?: number,
}) {
  // 1) Potency per ml per L
  const potency_per_ml_per_L =
    (delta_ref_units / (dose_ref_ml * volume_ref_L));

  // 2) Per-ml in tank at label
  const delta_per_ml_in_tank_at_label = potency_per_ml_per_L * tank_L;

  // 3) Adjusted for stock strength
  const sf = isFinite(strength_factor) && strength_factor > 0 ? strength_factor : 1.0;
  const delta_per_ml_in_tank = delta_per_ml_in_tank_at_label * sf;

  // 4) One-time correction (only raise)
  const correction_needed_units = Math.max(0, target_value - current_value);
  const correction_ml = delta_per_ml_in_tank > 0
    ? correction_needed_units / delta_per_ml_in_tank
    : 0;

  // 5) Daily maintenance (consumption is positive)
  const consumption_units_per_day = Math.max(0, -avg_daily_slope_units_per_day);
  const maintenance_ml_per_day = delta_per_ml_in_tank > 0
    ? consumption_units_per_day / delta_per_ml_in_tank
    : 0;

  // 6) Convenience total for today
  const today_total_ml = correction_ml + maintenance_ml_per_day;

  return {
    potency_per_ml_per_L,
    delta_per_ml_in_tank_at_label,
    delta_per_ml_in_tank,
    correction_needed_units,
    correction_ml,
    consumption_units_per_day,
    maintenance_ml_per_day,
    today_total_ml,
  };
}
