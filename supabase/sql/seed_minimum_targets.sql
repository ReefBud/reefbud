-- Replace YOUR_USER_UUID with your user id from Auth
INSERT INTO public.targets (user_id, alk, ca, mg, po4, no3, updated_at)
VALUES ('YOUR_USER_UUID', 8.2, 430, 1400, 0.03, 5, now())
ON CONFLICT (user_id) DO UPDATE SET
  alk = EXCLUDED.alk,
  ca = EXCLUDED.ca,
  mg = EXCLUDED.mg,
  po4 = EXCLUDED.po4,
  no3 = EXCLUDED.no3,
  updated_at = now();