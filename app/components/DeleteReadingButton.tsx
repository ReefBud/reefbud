// app/components/DeleteReadingButton.tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DeleteReadingButton({ id, onDeleted }: { id: string; onDeleted?: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm('Delete this reading?')) return;
        setBusy(true);
        const { error } = await supabase.from('readings').delete().eq('id', id);
        setBusy(false);
        if (error) { alert(error.message); return; }
        onDeleted?.(id);
      }}
      className="rounded-md border px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
