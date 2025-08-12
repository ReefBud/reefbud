'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  id: string;
  onDeleted?: (id: string) => void;
  className?: string;
  label?: string;
  tableName?: string; // default 'results'
};

export default function DeleteReadingButton({
  id,
  onDeleted,
  className,
  label = 'Delete',
  tableName = 'results',
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (busy) return;
    if (!confirm('Delete this result?')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      onDeleted?.(id);
    } catch (e: any) {
      alert(e?.message || 'Could not delete result.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      disabled={busy}
      className={
        className ??
        'inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60'
      }
      onClick={handleDelete}
      title="Delete result"
      aria-label="Delete result"
    >
      {busy ? 'Deleting…' : label}
    </button>
  );
}
