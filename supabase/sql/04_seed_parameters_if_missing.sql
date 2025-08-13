-- Ensure core parameters exist
INSERT INTO public.parameters(key, unit, display_name)
SELECT v.key, v.unit, v.display_name
FROM (VALUES
  ('alk','dKH','Alkalinity'),
  ('ca','ppm','Calcium'),
  ('mg','ppm','Magnesium'),
  ('po4','ppm','Phosphate'),
  ('no3','ppm','Nitrate')
) AS v(key,unit,display_name)
ON CONFLICT (key) DO NOTHING;
