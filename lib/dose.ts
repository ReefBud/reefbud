export type Potency = {
  dose_ref_ml: number;          // ml
  delta_ref_value: number;      // units
  volume_ref_liters: number;    // liters
};

export function computeDoseMl(deltaTarget: number, Vtank: number, potency: Potency): number | null {
  const { dose_ref_ml, delta_ref_value, volume_ref_liters } = potency;
  if (Vtank <= 0 || dose_ref_ml <= 0 || delta_ref_value <= 0 || volume_ref_liters <= 0) return null;
  const unitsPerMlPerL = delta_ref_value / (dose_ref_ml * volume_ref_liters);
  const unitsPerMlTank = unitsPerMlPerL * Vtank;
  if (unitsPerMlTank <= 0) return null;
  return deltaTarget / unitsPerMlTank;
}