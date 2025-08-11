
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  brand: string | null;
  name: string;
  parameter_key: "alk"|"ca"|"mg"|"po4"|"no3";
  dose_ref_ml: number | null;
  delta_ref_value: number | null;
  volume_ref_liters: number | null;
};

export default function ProductPicker({
  parameterKey, value, onChange
}: {
  parameterKey: "alk" | "ca" | "mg" | "po4" | "no3";
  value?: string;
  onChange: (productId: string | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, brand, name, parameter_key, dose_ref_ml, delta_ref_value, volume_ref_liters")
        .eq("parameter_key", parameterKey)
        .order("name");
      if (!mounted) return;
      if (error) console.error(error);
      setItems(data || []);
    })();
    return () => { mounted = false; };
  }, [parameterKey]);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(p =>
      (p.name?.toLowerCase().includes(q) || (p.brand||"").toLowerCase().includes(q))
    );
  }, [items, query]);

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Search brand or product name"
        value={query}
        onChange={e=>setQuery(e.target.value)}
      />
      <div className="max-h-40 overflow-auto border border-gray-200 rounded-2xl">
        {results.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">No matches. Add products first.</div>
        ) : (
          results.map(p => (
            <label key={p.id} className="flex items-start gap-2 p-3 border-b last:border-0 cursor-pointer">
              <input
                type="radio"
                name={`picker-${parameterKey}`}
                checked={value === p.id}
                onChange={() => onChange(p.id)}
              />
              <div>
                <div className="text-sm font-medium">{p.brand || "Unknown"} — {p.name}</div>
                <div className="text-xs text-gray-500">
                  {p.dose_ref_ml && p.delta_ref_value && p.volume_ref_liters
                    ? `${p.dose_ref_ml} ml -> +${p.delta_ref_value} in ${p.volume_ref_liters} L`
                    : "Potency: unknown"}
                </div>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
