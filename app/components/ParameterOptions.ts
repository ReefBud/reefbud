export type ParameterOption = {
  key: string;
  label: string;
};

// If your UI pulls parameters from the DB, you may not need this.
// Provided for UIs that render from a constant list.
export const PARAMETER_OPTIONS: ParameterOption[] = [
  { key: 'alk',  label: 'Alkalinity (dKH)' },
  { key: 'ca',   label: 'Calcium (ppm)' },
  { key: 'mg',   label: 'Magnesium (ppm)' },
  { key: 'po4',  label: 'Phosphate (ppm)' },
  { key: 'no3',  label: 'Nitrate (ppm)' },
  { key: 'trace_anions',  label: 'Trace Elements A-' },
  { key: 'trace_cations', label: 'Trace Elements K+' },
];