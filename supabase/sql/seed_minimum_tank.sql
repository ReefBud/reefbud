-- Replace YOUR_USER_UUID as needed
INSERT INTO public.tanks (user_id, name, volume_liters)
VALUES ('YOUR_USER_UUID', 'My Tank', 200)
RETURNING id, name, volume_liters;