// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Targets = {
  alk?: number | null;
  ca?: number | null;
  mg?: number | null;
  po4?: number | null;
  no3?: number | null;
  salinity?: number | null; // ppt
};

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Targets>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
      .from("targets")
      .select("alk, ca, mg, po4, no3, salinity")
      .eq("user_id", user.id)
      .maybeSingle();

      if (!mounted) return;
      if (!error && data) setTargets(data as Targets);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const saveTargets = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const payload = {
      user_id: user.id,
      alk: targets.alk ?? null,
      ca: targets.ca ?? null,
      mg: targets.mg ?? null,
      po4: targets.po4 ?? null,
      no3: targets.no3 ?? null,
      salinity: targets.salinity ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
    .from("targets")
    .upsert(payload, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      alert(`Could not save targets: ${error.message}`);
    } else {
      alert("Targets saved");
    }
  };

  const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 shadow-sm " +
  "bg-gradient-to-b from-gray-50 to-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400";

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold">Target Parameters</h1>
      <p className="text-sm text-gray-500 mt-2">Loading...</p>
      </main>
    );
  }

  const setNum =
  (key: keyof Targets, step = "0.1") =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTargets((s) => ({ ...s, [key]: v === "" ? null : Number(v) }));
  };

  return (
    <main className="max-w-3xl mx-auto p-4">
    <h1 className="text-2xl font-semibold">Target Parameters</h1>
    <p className="text-sm text-gray-600 mt-1">
    Set your desired targets. These are used by the Calculator and visualized in Results.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
    <div>
    <label className="block text-sm mb-1">Alkalinity (dKH)</label>
    <input
    className={inputClass}
    type="number"
    step="0.1"
    value={targets.alk ?? ""}
    onChange={setNum("alk", "0.1")}
    placeholder="8.2"
    />
    </div>

    <div>
    <label className="block text-sm mb-1">Calcium (ppm)</label>
    <input
    className={inputClass}
    type="number"
    step="1"
    value={targets.ca ?? ""}
    onChange={setNum("ca", "1")}
    placeholder="430"
    />
    </div>

    <div>
    <label className="block text-sm mb-1">Magnesium (ppm)</label>
    <input
    className={inputClass}
    type="number"
    step="1"
    value={targets.mg ?? ""}
    onChange={setNum("mg", "1")}
    placeholder="1400"
    />
    </div>

    <div>
    <label className="block text-sm mb-1">Phosphate (ppm)</label>
    <input
    className={inputClass}
    type="number"
    step="0.001"
    value={targets.po4 ?? ""}
    onChange={setNum("po4", "0.001")}
    placeholder="0.03"
    />
    </div>

    <div>
    <label className="block text-sm mb-1">Nitrate (ppm)</label>
    <input
    className={inputClass}
    type="number"
    step="0.1"
    value={targets.no3 ?? ""}
    onChange={setNum("no3", "0.1")}
    placeholder="5"
    />
    </div>

    <div>
    <label className="block text-sm mb-1">Salinity (ppt)</label>
    <input
    className={inputClass}
    type="number"
    step="0.1"
    value={targets.salinity ?? ""}
    onChange={setNum("salinity", "0.1")}
    placeholder="35.0"
    />
    </div>
    </div>

    <button
    className="mt-6 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
    onClick={saveTargets}
    disabled={saving}
    >
    {saving ? "Saving..." : "Save targets"}
    </button>
    </main>
  );
}
