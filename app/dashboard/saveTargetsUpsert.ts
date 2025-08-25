// Single-row targets upsert keyed by user_id.
// This matches what Calculator reads: one row with alk, ca, mg, po4, no3, salinity.
import { supabase } from '@/lib/supabaseClient';

export type TargetsPayload = {
  userId: string;
  alk: number | null;
  ca: number | null;
  mg: number | null;
  po4: number | null;
  no3: number | null;
  salinity?: number | null;
};

export async function saveTargetsUpsert({
  userId,
  alk,
  ca,
  mg,
  po4,
  no3,
  salinity = null,
}: TargetsPayload) {
  const { error } = await supabase
    .from('targets')
    .upsert(
      [{ user_id: userId, alk, ca, mg, po4, no3, salinity }],
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}
