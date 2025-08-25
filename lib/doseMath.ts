// lib/doseMath.ts
// Deterministic dosing math with tank-scaled potency and symmetric adjust up/down.
// This module avoids external dependencies and can be dropped in as-is.

export type DoseInputs = {
  tankLiters: number;

  // Current daily doses in ml
  currentAlkMl: number;
  currentCaMl: number;
  currentMgMl: number;

  // Potencies expressed as "increase per 1 ml per 1 liter of tank"
  // Example: 1 ml raises 0.073 dKH per liter -> alkPerMlPerL = 0.073
  alkPerMlPerL: number;     // dKH increase per ml per liter
  caPerMlPerL: number;      // ppm increase per ml per liter
  mgPerMlPerL: number;      // ppm increase per ml per liter

  // Latest readings
  currentAlk: number;       // dKH
  currentCa: number;        // ppm
  currentMg: number;        // ppm

  // Targets
  targetAlk: number;        // dKH
  targetCa: number;         // ppm
  targetMg: number;         // ppm

  // Optional tolerance band around target where we do not change the dose
  tolerance?: {
    alk?: number;   // dKH
    ca?: number;    // ppm
    mg?: number;    // ppm
  };

  // Optional rounding for the output dose in ml
  roundMl?: number; // default 0.1 ml
};

export type DoseResult = {
  newAlkMl: number;
  newCaMl: number;
  newMgMl: number;
  details: {
    incPerMl: { alk: number; ca: number; mg: number };
    deltas:   { alk: number; ca: number; mg: number };
    adjustMl: { alk: number; ca: number; mg: number };
  };
};

function roundTo(value: number, step: number = 0.1): number {
  const factor = 1 / step;
  return Math.round(value * factor) / factor;
}

function computeRequiredDose(currentDoseMl: number, incPerMl: number, currentValue: number, targetValue: number, tol: number, roundMl: number): { newDose: number, delta: number, adjustMl: number } {
  const delta = targetValue - currentValue;

  // If within tolerance, keep current dose
  if (Math.abs(delta) <= tol) {
    return { newDose: roundTo(currentDoseMl, roundMl), delta, adjustMl: 0 };
  }

  // Symmetric formula: add or remove dose proportional to error
  // required_dose_ml = current_dose_ml + ((target - current) / inc_per_ml)
  const adjustMl = incPerMl !== 0 ? (delta / incPerMl) : 0;
  const newDoseUnbounded = currentDoseMl + adjustMl;
  const newDose = Math.max(0, roundTo(newDoseUnbounded, roundMl));
  return { newDose, delta, adjustMl };
}

export function computeDoses(inputs: DoseInputs): DoseResult {
  const roundMl = inputs.roundMl ?? 0.1;

  const tolAlk = inputs.tolerance?.alk ?? 0;
  const tolCa  = inputs.tolerance?.ca  ?? 0;
  const tolMg  = inputs.tolerance?.mg  ?? 0;

  // Scale per-ml potency to the full tank
  const incPerMlAlk = inputs.alkPerMlPerL * inputs.tankLiters;
  const incPerMlCa  = inputs.caPerMlPerL  * inputs.tankLiters;
  const incPerMlMg  = inputs.mgPerMlPerL  * inputs.tankLiters;

  const alk = computeRequiredDose(inputs.currentAlkMl, incPerMlAlk, inputs.currentAlk, inputs.targetAlk, tolAlk, roundMl);
  const ca  = computeRequiredDose(inputs.currentCaMl,  incPerMlCa,  inputs.currentCa,  inputs.targetCa,  tolCa,  roundMl);
  const mg  = computeRequiredDose(inputs.currentMgMl,  incPerMlMg,  inputs.currentMg,  inputs.targetMg,  tolMg,  roundMl);

  return {
    newAlkMl: alk.newDose,
    newCaMl:  ca.newDose,
    newMgMl:  mg.newDose,
    details: {
      incPerMl: { alk: incPerMlAlk, ca: incPerMlCa, mg: incPerMlMg },
      deltas:   { alk: alk.delta,   ca: ca.delta,   mg: mg.delta },
      adjustMl: { alk: alk.adjustMl, ca: ca.adjustMl, mg: mg.adjustMl },
    }
  };
}

// Quick self-check using the provided example:
// Tank: 35 L, Alk potency 0.073 dKH per ml per L => incPerMl = 2.555 dKH per ml for the whole tank
// Current dose 30 ml, Current Alk 6.7 dKH, Target 8.0
// extra = (8.0 - 6.7) / 2.555 = ~0.51 ml; new dose = 30.51 ml
// This aligns with the "add proportional to error" rule in the requirements.
