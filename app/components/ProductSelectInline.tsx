'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Product, Parameter, Tank } from '@/lib/types';

type Props = {
  tank: Tank;
  parameter: Parameter;
  value: string | null;
  onChange: (productId: string | null, product?: Product | null) => void;
};

export default function ProductSelectInline({ tank, parameter, value, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErr('Not signed in');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('parameter_id', parameter.id)
        .order('brand', { ascending: true })
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) setErr(error.message);
      else setProducts(data || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [parameter.id]);

  const selected = useMemo(
    () => products.find(p => p.id === value) || null,
    [products, value]
  );

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {parameter.display_name} product
      </label>
      <select
        className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
        disabled={loading}
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value || null;
          const prod = products.find(p => p.id === id) || null;
          onChange(id, prod || undefined);
        }}
      >
        <option value="">-- Select a product --</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>
            {p.brand} — {p.name}
          </option>
        ))}
      </select>
      {selected?.helper_text && (
        <p className="text-xs text-gray-600">{selected.helper_text}</p>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
