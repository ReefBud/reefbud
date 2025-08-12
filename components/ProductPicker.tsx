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
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      setUserId(uid);

      // fetch global (user_id is null) + user-scoped products for this parameter
      // NOTE: RLS allows reading global rows and your own rows
      const { data, error } = await supabase
      .from("products")
      .select("id, brand, name, helper_text, dose_ref_ml, delta_ref_value, volume_ref_liters, user_id, parameter_id")
      .eq("parameter_id", parameterId);
      if (error) return;

      // keep global rows (user_id null) + user’s rows only
      const filtered = (data || []).filter((r: any) => !r.user_id || r.user_id === uid);
      filtered.sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
      setItems(filtered);
    })();
  }, [parameterId]);

  return (
    <div>
    <select
    className="input w-full"
    value={value || ""}
    onChange={(e) => onChange(e.target.value || undefined)}
    >
    <option value="">Select a product…</option>
    {items.map(it => (
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
