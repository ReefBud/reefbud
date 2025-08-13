export type Potency = {
  dose_ref_ml: number;          // ml
  delta_ref_value: number;      // units: dKH or ppm etc
  volume_ref_liters: number;    // liters
};

/**
 * Compute required ml to change a parameter by deltaTarget in a tank of Vtank liters,
 * given potency defined as: dose_ref_ml ml raises delta_ref_value units in volume_ref_liters liters.
 *
 * Math (double-checked):
 *   units per ml per liter = delta_ref_value / (dose_ref_ml * volume_ref_liters)
 *   units per ml in user's tank = units_per_ml_per_L * Vtank
 *   dose_ml_needed = deltaTarget / (units_per_ml_in_tank)
 */
export function computeDoseMl(deltaTarget: number, Vtank: number, potency: Potency): number | null {
  const { dose_ref_ml, delta_ref_value, volume_ref_liters } = potency;
  if (Vtank <= 0 || dose_ref_ml <= 0 || delta_ref_value <= 0 || volume_ref_liters <= 0) return null;
  const unitsPerMlPerL = delta_ref_value / (dose_ref_ml * volume_ref_liters);
  const unitsPerMlTank = unitsPerMlPerL * Vtank;
  if (unitsPerMlTank <= 0) return null;
  const ml = deltaTarget / unitsPerMlTank;
  return ml;
}