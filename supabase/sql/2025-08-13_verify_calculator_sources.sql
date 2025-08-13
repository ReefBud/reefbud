-- Optional: helper view to debug the calculator joins
CREATE OR REPLACE VIEW public.v_user_preferred_products AS
SELECT
  pp.user_id,
  pp.tank_id,
  pp.parameter_id,
  p.key AS parameter_key,
  pr.id AS product_id,
  pr.brand,
  pr.name,
  pr.dose_ref_ml,
  pr.delta_ref_value,
  pr.volume_ref_liters
FROM public.preferred_products pp
JOIN public.parameters p ON p.id = pp.parameter_id
JOIN public.products pr ON pr.id = pp.product_id;