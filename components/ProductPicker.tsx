"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  brand: string;
  name: string;
  helper_text?: string | null;
  dose_ref_ml?: number | null;
  delta_ref_value?: number | null;
  volume_ref_liters?: number | null;
  user_id?: string | null;
  parameter_id: number;
};

export default function ProductPicker({
  parameterId,
  value,
  onChange,
}: {
  parameterId: number;
  value?: string;
  onChange: (id?: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // get current user (for filtering user-owned rows)
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      // fetch GLOBAL rows (user_id is null) + USER rows (user_id = uid) for this parameter
      // using a single or() filter (works even if uid is undefined; it will just return global rows)
      const orClause = uid
      ? `user_id.is.null,user_id.eq.${uid}`
      : `user_id.is.null`;

      const { data, error } = await supabase
      .from("products")
      .select("id,brand,name,helper_text,dose_ref_ml,delta_ref_value,volume_ref_liters,user_id,parameter_id")
      .eq("parameter_id", parameterId)
      .or(orClause);

      if (cancelled) return;

      if (error) {
        console.error("products query error", error);
        setItems([]);
        setLoading(false);
        return;
      }

      const rows = (data || []) as Item[];
      rows.sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
      setItems(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [parameterId]);

  return (
    <div>
    <select
    className="input w-full"
    value={value || ""}
    onChange={(e) => onChange(e.target.value || undefined)}
    disabled={loading}
    >
    <option value="">{loading ? "Loading…" : "Select a product…"}</option>
    {!loading && items.map(it => (
      <option key={it.id} value={it.id}>
      {it.brand} — {it.name}
      </option>
    ))}
    </select>

    {value && (
      <div className="mt-2 text-xs text-gray-600">
      {(() => {
        const it = items.find(x => x.id === value);
        if (!it) return null;
        const potency = (it.dose_ref_ml && it.delta_ref_value && it.volume_ref_liters)
        ? `${it.dose_ref_ml} ml → +${it.delta_ref_value} in ${it.volume_ref_liters} L`
        : null;
        return (
          <div>
          {potency && <div>Potency: {potency}</div>}
          {it.helper_text && <div className="mt-1 italic">{it.helper_text}</div>}
          </div>
        );
      })()}
      </div>
    )}
    </div>
  );
}
