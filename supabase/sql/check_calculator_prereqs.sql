-- Replace with your actual UUIDs as needed
-- List tanks and volumes for a user
SELECT id, name, volume_liters FROM public.tanks WHERE user_id = 'YOUR_USER_UUID';

-- Check Dashboard targets for the user
SELECT alk, ca, mg, po4, no3 FROM public.targets WHERE user_id = 'YOUR_USER_UUID';

-- Show preferred products for a tank
SELECT pp.parameter_id, p.key, pr.brand, pr.name, pr.dose_ref_ml, pr.delta_ref_value, pr.volume_ref_liters
FROM public.preferred_products pp
JOIN public.parameters p ON p.id = pp.parameter_id
JOIN public.products pr ON pr.id = pp.product_id
WHERE pp.user_id = 'YOUR_USER_UUID' AND pp.tank_id = 'YOUR_TANK_UUID';

-- Latest readings per parameter for a tank
SELECT DISTINCT ON (parameter_id) parameter_id, value, measured_at
FROM public.readings
WHERE tank_id = 'YOUR_TANK_UUID'
ORDER BY parameter_id, measured_at DESC;