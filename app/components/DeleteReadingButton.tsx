// app/components/DeleteReadingButton.tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export function DeleteReadingButton({
  id,
  onDeleted,
  className,
}: { id: string; onDeleted?: (id: string) => void; className?: string }) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function handleDelete() {
    if (!confirm('Delete this reading?')) return;
    setBusy(true);
    const { error } = await supabase.from('readings').delete().eq('id', id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onDeleted?.(id);
  }

  return (
    <button
      disabled={busy}
      className={className}
      onClick={handleDelete}
      title="Delete reading"
      aria-label="Delete reading"
    >
      {busy ? 'Deleting…' : '🗑'}
    </button>
  );
}

export default DeleteReadingButton;
