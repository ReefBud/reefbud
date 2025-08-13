'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import DeleteProductButton from '@/app/components/DeleteProductButton';
import { PARAMETER_OPTIONS } from '@/app/components/ParameterOptions';

type DbParameter = { id: number; key: string; display_name?: string | null };
type DbProduct = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number | null;
  helper_text?: string | null;
  dose_ref_ml?: number | null;
  delta_ref_value?: number | null;
  volume_ref_liters?: number | null;
};

export default function ProductsPage() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [paramsDb, setParamsDb] = useState<DbParameter[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state (manual entry only)
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [parameterId, setParameterId] = useState<number | null>(null);
  const [doseRefMl, setDoseRefMl] = useState<string>('');
  const [deltaRefValue, setDeltaRefValue] = useState<string>('');
  const [volumeRefLiters, setVolumeRefLiters] = useState<string>('');
  const [helperText, setHelperText] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      setUserId(user?.id ?? null);

      // Pull parameters from DB if available; fall back to constant list
      const { data: pData } = await supabase
        .from('parameters')
        .select('id, key, display_name')
        .order('id');

      if (mounted) {
        if (pData) setParamsDb(pData);
      }

      // Only show the current user's products (manual entries)
      if (user?.id) {
        const { data: prodData, error } = await supabase
          .from('products')
          .select('id, brand, name, parameter_id, helper_text, dose_ref_ml, delta_ref_value, volume_ref_liters')
          .eq('user_id', user.id)
          .order('name');

        if (mounted) {
          if (!error && prodData) setProducts(prodData as DbProduct[]);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const saveProduct = async () => {
    if (!userId) {
      alert('Please sign in first.');
      return;
    }
    if (!brand.trim() || !name.trim() || !parameterId) {
      alert('Please enter brand, name, and parameter.');
      return;
    }

    const payload: any = {
      user_id: userId,
      brand: brand.trim(),
      name: name.trim(),
      parameter_id: parameterId,
      helper_text: helperText || null,
    };

    // Optional potency fields
    const nDose = doseRefMl ? Number(doseRefMl) : null;
    const nDelta = deltaRefValue ? Number(deltaRefValue) : null;
    const nVol  = volumeRefLiters ? Number(volumeRefLiters) : null;
    if (nDose && nDose > 0) payload.dose_ref_ml = nDose;
    if (nDelta && nDelta > 0) payload.delta_ref_value = nDelta;
    if (nVol && nVol > 0) payload.volume_ref_liters = nVol;

    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select('id, brand, name, parameter_id, helper_text, dose_ref_ml, delta_ref_value, volume_ref_liters')
      .single();

    if (error) {
      alert(error.message);
      return;
    }
    setProducts(prev => [data as DbProduct, ...prev]);
    // Reset form
    setBrand('');
    setName('');
    setParameterId(null);
    setDoseRefMl('');
    setDeltaRefValue('');
    setVolumeRefLiters('');
    setHelperText('');
  };

  const onDeleted = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const parameterOptions = (paramsDb?.length ? paramsDb.map(p => ({
    value: p.id,
    label: p.display_name || p.key
  })) : PARAMETER_OPTIONS.map(p => ({
    // when DB rows are not available, we cannot map to parameter_id;
    // in that case, show names but require DB sync to save.
    value: -1,
    label: p.label
  })));

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="text-sm text-gray-600">
        Manual entry only. Tropic Marin catalog has been removed. All products are private to your account.
      </p>

      <section className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-3">Add a product</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Brand</label>
            <input className="w-full rounded-lg border px-3 py-2" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Your brand" />
          </div>
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input className="w-full rounded-lg border px-3 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="Product name" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1">Parameter</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={parameterId ?? ''}
              onChange={e => setParameterId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select parameter…</option>
              {parameterOptions.map(opt => (
                <option key={opt.label + String(opt.value)} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {(!paramsDb || paramsDb.length === 0) && (
              <p className="text-xs text-amber-700 mt-1">
                Your database does not expose a parameters table; the above list is a static fallback. Run the provided SQL to add parameters and reload.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Test dose (ml)</label>
            <input className="w-full rounded-lg border px-3 py-2" inputMode="decimal" value={doseRefMl} onChange={e => setDoseRefMl(e.target.value)} placeholder="e.g. 30" />
          </div>
          <div>
            <label className="block text-sm mb-1">Change in reading (units)</label>
            <input className="w-full rounded-lg border px-3 py-2" inputMode="decimal" value={deltaRefValue} onChange={e => setDeltaRefValue(e.target.value)} placeholder="e.g. 2.2 (dKH) or 15 (ppm)" />
          </div>
          <div>
            <label className="block text-sm mb-1">Reference tank volume (L)</label>
            <input className="w-full rounded-lg border px-3 py-2" inputMode="decimal" value={volumeRefLiters} onChange={e => setVolumeRefLiters(e.target.value)} placeholder="e.g. 35" />
          </div>
          <div>
            <label className="block text-sm mb-1">Helper text (optional)</label>
            <input className="w-full rounded-lg border px-3 py-2" value={helperText} onChange={e => setHelperText(e.target.value)} placeholder="Any usage note to show in Chemist" />
          </div>
        </div>
        <button onClick={saveProduct} className="mt-4 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700">
          Save product
        </button>
      </section>

      <section className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-3">All visible products</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-500">No products yet.</p>
        ) : (
          <ul className="divide-y">
            {products.map(p => (
              <li key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.brand} — {p.name}</div>
                  <div className="text-xs text-gray-600">
                    {p.parameter_id ? `parameter_id: ${p.parameter_id}` : 'no parameter set'}
                    {p.helper_text ? ` — ${p.helper_text}` : ''}
                  </div>
                </div>
                <DeleteProductButton id={p.id} onDeleted={onDeleted} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}