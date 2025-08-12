// app/components/DeleteReadingButton.tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type DeleteReadingButtonProps = {
  id: string;
  onDeleted?: (id: string) => void;
  className?: string;
  label?: string;
};

export default function DeleteReadingButton({
  id,
  onDeleted,
  className,
  label = 'Delete'
}: DeleteReadingButtonProps) {
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
      className={className ?? "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"}
      onClick={handleDelete}
      title="Delete reading"
      aria-label="Delete reading"
    >
      {busy ? 'Deleting…' : label}
    </button>
  );
}
