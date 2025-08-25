export type ParameterKey = 'alk' | 'ca' | 'mg';

export type Parameter = {
  id: number;
  key: ParameterKey;
  unit: string;
  display_name: string;
};

export type Product = {
  id: string;
  user_id: string | null;
  brand: string;
  name: string;
  parameter_id: number;
  helper_text: string | null;
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
};

export type PreferredProduct = {
  id: string;
  user_id: string;
  tank_id: string;
  parameter_id: number;
  product_id: string;
};

export type Tank = {
  id: string;
  user_id: string;
  name: string | null;
  volume_value: number | null;
  volume_unit: string | null; // 'L' or 'gal'
  volume_liters: number | null;
};

export type TargetRow = {
  user_id: string;
  alk: number | null;
  ca: number | null;
  mg: number | null;
  po4?: number | null;
  no3?: number | null;
  salinity?: number | null;
  updated_at?: string | null;
};

export type Reading = {
  id: string;
  user_id: string;
  tank_id: string;
  parameter_id: number;
  value: number;
  measured_at: string; // ISO
};
