'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Product, Parameter } from '@/lib/types';

type FormState = {
  brand: string;
  name: string;
  parameter_id: number | null;
  helper_text: string;
  dose_ref_ml: string;
  delta_ref_value: string;
  volume_ref_liters: string;
};

export default function ProductsPage() {
  const [params, setParams] = useState<Parameter[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    brand: '',
    name: '',
    parameter_id: null,
    helper_text: '',
    dose_ref_ml: '',
    delta_ref_value: '',
    volume_ref_liters: '',
  });

  const allowedKeys = useMemo(() => ['alk','ca','mg'] as const, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      // restrict parameters to Alk, Ca, Mg
      const { data: plist, error: perr } = await supabase
        .from('parameters')
        .select('*')
        .in('key', ['alk','ca','mg'])
        .order('id', { ascending: true });
      if (perr) { setErr(perr.message); setLoading(false); return; }
      if (!mounted) return;
      setParams(plist || []);
      // list products (global + user)
      const { data: prods, error: perr2 } = await supabase
        .from('products')
        .select('*')
        .in('parameter_id', (plist || []).map(p => p.id))
        .order('brand', { ascending: true })
        .order('name', { ascending: true });
      if (perr2) setErr(perr2.message);
      setItems(prods || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const paramById = useMemo(() => {
    const map = new Map<number, Parameter>();
    for (const p of params) map.set(p.id, p);
    return map;
  }, [params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!form.parameter_id) { setErr('Please choose a parameter (Alk, Ca, or Mg).'); return; }
    const dose_ref_ml = form.dose_ref_ml ? Number(form.dose_ref_ml) : null;
    const delta_ref_value = form.delta_ref_value ? Number(form.delta_ref_value) : null;
    const volume_ref_liters = form.volume_ref_liters ? Number(form.volume_ref_liters) : null;
    const payload = {
      brand: form.brand.trim(),
      name: form.name.trim(),
      parameter_id: form.parameter_id,
      helper_text: form.helper_text.trim() || null,
      dose_ref_ml,
      delta_ref_value,
      volume_ref_liters,
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Not signed in'); return; }

    const { error } = await supabase
      .from('products')
      .insert({ ...payload, user_id: user.id });

    if (error) { setErr(error.message); return; }

    // refresh list
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .in('parameter_id', params.map(p => p.id))
      .order('brand', { ascending: true })
      .order('name', { ascending: true });
    setItems(prods || []);
    setForm({
      brand: '', name: '', parameter_id: null, helper_text: '',
      dose_ref_ml: '', delta_ref_value: '', volume_ref_liters: ''
    });
  };

  const onDelete = async (id: string) => {
    setErr(null);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    setItems(prev => prev.filter(x => x.id !== id));
  };

  if (loading) return <main className="p-4"><h1 className="text-2xl font-semibold">Products</h1><p>Loading…</p></main>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="text-sm text-gray-600">Only Alkalinity, Calcium, and Magnesium are supported here.</p>

      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4">
        <div className="sm:col-span-2">
          <label className="block text-sm">Brand</label>
          <input className="w-full rounded-md border px-3 py-2" value={form.brand}
                 onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Tropic Marin" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm">Name</label>
          <input className="w-full rounded-md border px-3 py-2" value={form.name}
                 onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Balling A (Calcium)" />
        </div>
        <div>
          <label className="block text-sm">Parameter</label>
          <select className="w-full rounded-md border px-3 py-2"
                  value={form.parameter_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, parameter_id: Number(e.target.value) || null }))}>
            <option value="">-- Choose --</option>
            {params.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm">Helper text (optional)</label>
          <input className="w-full rounded-md border px-3 py-2" value={form.helper_text}
                 onChange={e => setForm(f => ({ ...f, helper_text: e.target.value }))}
                 placeholder="30 ml raises Ca ~15 ppm in 35 L" />
        </div>
        <div>
          <label className="block text-sm">Test dose (ml)</label>
          <input className="w-full rounded-md border px-3 py-2" inputMode="numeric" value={form.dose_ref_ml}
                 onChange={e => setForm(f => ({ ...f, dose_ref_ml: e.target.value.replace(/[^\d.]/g,'') }))}
                 placeholder="30" />
        </div>
        <div>
          <label className="block text-sm">Change in reading</label>
          <input className="w-full rounded-md border px-3 py-2" inputMode="numeric" value={form.delta_ref_value}
                 onChange={e => setForm(f => ({ ...f, delta_ref_value: e.target.value.replace(/[^\d.]/g,'') }))}
                 placeholder="15 (ppm Ca) / 2.2 (dKH Alk)" />
        </div>
        <div>
          <label className="block text-sm">Tank size used for test (L)</label>
          <input className="w-full rounded-md border px-3 py-2" inputMode="numeric" value={form.volume_ref_liters}
                 onChange={e => setForm(f => ({ ...f, volume_ref_liters: e.target.value.replace(/[^\d.]/g,'') }))}
                 placeholder="35" />
        </div>
        <div className="sm:col-span-2">
          <button className="rounded-md bg-blue-600 text-white px-4 py-2">Save product</button>
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your products</h2>
        <ul className="divide-y rounded-lg border">
          {items.map(p => (
            <li key={p.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.brand} — {p.name}</div>
                <div className="text-xs text-gray-600">
                  {paramById.get(p.parameter_id)?.display_name ?? 'Parameter'} •
                  {p.dose_ref_ml && p.delta_ref_value && p.volume_ref_liters
                    ? ` potency ≈ ${(p.delta_ref_value / (p.dose_ref_ml * p.volume_ref_liters)).toFixed(6)} units/ml/L`
                    : ' no potency set'}
                </div>
                {p.helper_text && <div className="text-xs text-gray-500">{p.helper_text}</div>}
              </div>
              <button onClick={() => onDelete(p.id)} className="text-red-600 hover:underline">Delete</button>
            </li>
          ))}
          {items.length === 0 && <li className="p-3 text-sm text-gray-600">No products yet.</li>}
        </ul>
      </section>
    </main>
  );
}
