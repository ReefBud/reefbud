
/**
 * Example: safe upsert for Dashboard targets to avoid duplicate key errors.
 * Call with current user's UID and the target values.
 */
import { createClient } from '@supabase/supabase-js';

export async function saveTargets({
  userId, alk, ca, mg, po4, no3,
}: {
  userId: string;
  alk: number | null;
  ca: number | null;
  mg: number | null;
  po4: number | null;
  no3: number | null;
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const payload = { user_id: userId, alk, ca, mg, po4, no3, updated_at: new Date().toISOString() };

  // Use onConflict:'user_id' so it updates existing rows instead of inserting a duplicate.
  const { error } = await supabase
    .from('targets')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;
}
