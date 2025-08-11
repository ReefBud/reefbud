"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Tank = {
    id: string;
    name: string;
    volume_value: number;
    volume_unit: "L" | "gal";
};

type Reading = {
    alk?: number;
    ca?: number;
    mg?: number;
    po4?: number;
    no3?: number;
};

export default function Dashboard() {
    const [userId, setUserId] = useState<string>();
    const [tank, setTank] = useState<Tank | null>(null);
    const [loading, setLoading] = useState(true);
    const [current, setCurrent] = useState<Reading>({});

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }
            setUserId(user.id);

            // ensure profile exists
            await supabase.from("profiles").upsert({ id: user.id, email: user.email }).select();

            // fetch or create tank
            const { data: tanks, error } = await supabase
            .from("tanks")
            .select("*")
            .eq("user_id", user.id)
            .limit(1);

            if (error) console.error(error);

            let tk: Tank | null = (tanks && (tanks[0] as Tank)) ?? null;

            if (!tk) {
                const { data: created, error: createErr } = await supabase
                .from("tanks")
                .insert({ user_id: user.id, name: "My Tank", volume_value: 200, volume_unit: "L" })
                .select()
                .single();
                if (createErr) {
                    console.error(createErr);
                } else {
                    tk = created as Tank;
                }
            }

            setTank(tk);

            // prefill from latest reading (if any)
            const { data: latest } = await supabase
            .from("readings")
            .select("alk, ca, mg, po4, no3")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

            if (latest && latest.length > 0) setCurrent(latest[0] as Reading);

            setLoading(false);
        })();
    }, []);

    async function saveVolume() {
        if (!tank) return;
        await supabase
        .from("tanks")
        .update({ volume_value: tank.volume_value, volume_unit: tank.volume_unit })
        .eq("id", tank.id);
    }

    async function saveCurrent() {
        if (!userId) return;
        const now = new Date();
        const date_iso = now.toISOString().slice(0, 10);
        const time_str = now.toTimeString().slice(0, 5);
        await supabase
        .from("readings")
        .insert({ user_id: userId, tank_id: tank?.id, date_iso, time_str, ...current });
    }

    // Signed-out state
    if (!userId && !loading) {
        return (
            <main className="card">
            Sign in (top right) to load your tank.
            </main>
        );
    }

    // Loading state
    if (loading || !tank) {
        return (
            <main className="card">
            Loading tank…
            </main>
        );
    }

    return (
        <main className="space-y-4">
        <div className="card">
        <h2 className="text-lg font-semibold mb-3">Tank</h2>
        <div className="grid grid-cols-2 gap-3">
        <div>
        <label className="block text-sm">Tank Volume (L)</label>
        <input
        className="input"
        type="number"
        value={tank.volume_value}
        onChange={(e) =>
            setTank((t) =>
            t ? { ...t, volume_value: Number(e.target.value) } : t
            )
        }
        />
        </div>
        <div>
        <label className="block text-sm">Unit</label>
        <select
        className="input"
        value={tank.volume_unit}
        onChange={(e) =>
            setTank((t) =>
            t ? { ...t, volume_unit: e.target.value as "L" | "gal" } : t
            )
        }
        >
        <option value="L">Liters</option>
        <option value="gal">Gallons</option>
        </select>
        </div>
        </div>
        <button className="btn mt-3" onClick={saveVolume}>
        Save volume
        </button>
        </div>

        <div className="card">
        <h3 className="font-medium mb-3">Current Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
        <label className="block text-sm">Alkalinity (dKH)</label>
        <input
        className="input"
        type="number"
        step="0.01"
        value={current.alk ?? ""}
        onChange={(e) =>
            setCurrent((s) => ({
                ...s,
                alk: e.target.value === "" ? undefined : Number(e.target.value),
            }))
        }
        />
        </div>
        <div>
        <label className="block text-sm">Calcium (ppm)</label>
        <input
        className="input"
        type="number"
        step="1"
        value={current.ca ?? ""}
        onChange={(e) =>
            setCurrent((s) => ({
                ...s,
                ca: e.target.value === "" ? undefined : Number(e.target.value),
            }))
        }
        />
        </div>
        <div>
        <label className="block text-sm">Magnesium (ppm)</label>
        <input
        className="input"
        type="number"
        step="1"
        value={current.mg ?? ""}
        onChange={(e) =>
            setCurrent((s) => ({
                ...s,
                mg: e.target.value === "" ? undefined : Number(e.target.value),
            }))
        }
        />
        </div>
        <div>
        <label className="block text-sm">Phosphates (ppm)</label>
        <input
        className="input"
        type="number"
        step="0.001"
        value={current.po4 ?? ""}
        onChange={(e) =>
            setCurrent((s) => ({
                ...s,
                po4: e.target.value === "" ? undefined : Number(e.target.value),
            }))
        }
        />
        </div>
        <div>
        <label className="block text-sm">Nitrates (ppm)</label>
        <input
        className="input"
        type="number"
        step="0.1"
        value={current.no3 ?? ""}
        onChange={(e) =>
            setCurrent((s) => ({
                ...s,
                no3: e.target.value === "" ? undefined : Number(e.target.value),
            }))
        }
        />
        </div>
        </div>
        <button className="btn mt-3" onClick={saveCurrent}>
        Save current as reading
        </button>
        </div>
        </main>
    );
}
