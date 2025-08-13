'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Chemist (Products tab) — filtered to only Alkalinity, Calcium, Magnesium.
 * This page lets a user pick a preferred product per parameter for their tank.
 * Filters parameters to keys: ['alk','ca','mg'] so NO nitrates/phosphate/traces/salinity appear.
 */

type Param = { id: number; key: 'alk'|'ca'|'mg'; display_name?: string | null };
type Tank = { id: string };
type Product = {
  id: string;
  brand: string;
  name: string;
  parameter_id: number;
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
};

const ALLOWED_KEYS = new Set(['alk','ca','mg']);

export default function ChemistPage() {
  const [tank, setTank] = useState<Tank | null>(null);
  const [params, setParams] = useState<Param[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<number, string | null>>({}); // parameter_id -> product_id
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setErr(null);
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Please sign in.'); return; }

    // 1) Tank (create if missing)
    let { data: t, error: tErr } = await supabase
      .from('tanks')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (tErr) { setErr(tErr.message); return; }
    if (!t) {
      const ins = await supabase.from('tanks')
        .insert([{ user_id: user.id, name: 'My Tank' }])
        .select('id')
        .limit(1);
      if (ins.error) { setErr(ins.error.message); return; }
      t = ins.data?.[0] ?? null;
    }
    if (!t) { setErr('No tank available.'); return; }
    setTank({ id: t.id });

    // 2) Parameters — FILTERED to only alk/ca/mg
    const { data: paramsData, error: pErr } = await supabase
      .from('parameters')
      .select('id, key, display_name')
      .in('key', ['alk','ca','mg'])
      .order('id', { ascending: true });
    if (pErr) { setErr(pErr.message); return; }
    const filtered = (paramsData ?? []).filter((p: any) => ALLOWED_KEYS.has(p.key));
    setParams(filtered as Param[]);

    // 3) Products for those parameters (global + user-owned, RLS handles visibility)
    const paramIds = filtered.map(p => p.id);
    let prods: Product[] = [];
    if (paramIds.length > 0) {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters');
      if (prodErr) { setErr(prodErr.message); return; }
      prods = (prodData ?? []).filter((p: any) => paramIds.includes(p.parameter_id));
    }
    setProducts(prods);

    // 4) Existing preferred selections
    const { data: pref, error: prefErr } = await supabase
      .from('preferred_products')
      .select('parameter_id, product_id')
      .eq('user_id', user.id)
      .eq('tank_id', t.id);
    if (prefErr) { setErr(prefErr.message); return; }
    const map: Record<number, string | null> = {};
    (pref ?? []).forEach((r: any) => { map[r.parameter_id] = r.product_id; });
    setSelected(map);
  }

  async function onPick(parameter_id: number, product_id: string) {
    setErr(null);
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tank) return;

    // Upsert on (user_id, tank_id, parameter_id)
    const { error } = await supabase
      .from('preferred_products')
      .upsert([{ user_id: user.id, tank_id: tank.id, parameter_id, product_id }], {
        onConflict: 'user_id,tank_id,parameter_id',
      });
    if (error) { setErr(error.message); return; }
    setSelected(prev => ({ ...prev, [parameter_id]: product_id }));
    setMsg('Saved selection.');
  }

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Chemist — Products</h1>
      <p className="text-sm opacity-70">Only Alkalinity, Calcium, Magnesium are shown here.</p>

      {err && <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">Error: {err}</div>}
      {msg && <div className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-700">{msg}</div>}

      <section className="rounded-md border p-4 space-y-4">
        {params.map((p) => {
          const options = products.filter(pr => pr.parameter_id === p.id);
          const value = selected[p.id] ?? '';
          return (
            <div key={p.id} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
              <div className="sm:col-span-1 font-medium">{prettyName(p.key, p.display_name)}</div>
              <div className="sm:col-span-3">
                <select
                  className="w-full rounded-md border px-2 py-1.5 text-sm"
                  value={value}
                  onChange={e => onPick(p.id, e.target.value)}
                >
                  <option value="">Select a product…</option>
                  {options.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.brand} — {opt.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs opacity-70 mt-1">
                  {value
                    ? potencyLine(products.find(x => x.id === value) || options.find(x => x.id === value))
                    : 'No product selected'}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function prettyName(key: string, display?: string | null) {
  if (display) return display;
  if (key === 'alk') return 'Alkalinity';
  if (key === 'ca') return 'Calcium';
  if (key === 'mg') return 'Magnesium';
  return key;
}

function potencyLine(p?: Product) {
  if (!p) return '';
  const parts: string[] = [];
  if (p.dose_ref_ml) parts.push(`${p.dose_ref_ml} ml`);
  if (p.volume_ref_liters) parts.push(`in ${p.volume_ref_liters} L`);
  if (p.delta_ref_value) parts.push(`→ raises by ${p.delta_ref_value}`);
  return parts.length ? parts.join(' ') : 'Potency not set';
}
