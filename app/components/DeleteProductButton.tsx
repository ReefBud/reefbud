'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function DeleteProductButton({
  id,
  onDeleted,
  className,
}: {
  id: string;
  onDeleted?: (id: string) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return (
    <button
      disabled={busy}
      className={className ?? 'text-red-600 hover:opacity-70'}
      onClick={async () => {
        if (!confirm('Remove this product?')) return;
        setBusy(true);
        const { error } = await supabase.from('products').delete().eq('id', id);
        setBusy(false);
        if (error) {
          alert(error.message);
          return;
        }
        onDeleted?.(id);
      }}
      title="Remove product"
      aria-label="Remove product"
    >
      {busy ? 'Removing…' : 'Remove'}
    </button>
  );
}