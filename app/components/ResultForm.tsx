'use client';

import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

type ParamKey = 'alk' | 'ca' | 'mg' | 'po4' | 'no3' | 'salinity';

const PARAMS = [
    { key: 'alk',      label: 'Alkalinity (dKH)', example: '7–12' },
    { key: 'ca',       label: 'Calcium (ppm)',    example: '400–450' },
    { key: 'mg',       label: 'Magnesium (ppm)',  example: '1350–1450' },
    { key: 'po4',      label: 'Phosphate (ppm)',  example: '0.03–0.1' },
    { key: 'no3',      label: 'Nitrate (ppm)',    example: '5–15' },
    { key: 'salinity', label: 'Salinity (ppt)',   example: '30–40' },
] as const;

type InsertedRow = {
    id: string;
    measured_at: string;
    value: number;
    parameter_key?: string | null;
    parameter?: string | null;
};

export default function ResultForm({
    defaultParam = 'alk',
    tankId,
    onSaved,
}: {
    defaultParam?: ParamKey;
    tankId: string;
    onSaved?: (r: InsertedRow) => void;
}) {
    const [param, setParam] = useState<ParamKey>(defaultParam);
    const [value, setValue] = useState('');
    const [measuredAt, setMeasuredAt] = useState(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const placeholder = useMemo(
        () => PARAMS.find(p => p.key === param)?.example || '',
                                [param]
    );

    async function save() {
        setError(null);
        if (busy) return;
        setBusy(true);
        try {
            const n = Number(value);
            if (!isFinite(n)) throw new Error('Enter a numeric value');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Please sign in');

            // 1) Resolve parameter_id by key (your parameters table has no tank_id column)
            const { data: paramRows, error: paramErr } = await supabase
            .from('parameters')
            .select('id')
            .eq('key', param)
            .limit(1);

            if (paramErr) throw paramErr;
            if (!paramRows?.length) {
                throw new Error(`Parameter definition not found for key "${param}". Please add it in "parameters".`);
            }

            const parameterId = paramRows[0].id;

            // 2) Insert result and return the inserted row (so we can show it instantly)
            const row = {
                user_id: user.id,
                tank_id: tankId,
                parameter_id: parameterId,
                measured_at: new Date(measuredAt).toISOString(),
                value: n,
                parameter_key: param,
            };

            const { data: inserted, error } = await supabase
            .from('results')
            .insert(row)
            .select('id, measured_at, value, parameter_key, parameter')
            .single();

            if (error) throw error;

            // Clear input and optimistically update parent
            setValue('');
            if (inserted) {
                onSaved?.({
                    id: String(inserted.id),
                          measured_at: inserted.measured_at,
                          value: Number(inserted.value ?? 0),
                          parameter_key: inserted.parameter_key ?? inserted.parameter ?? null,
                          parameter: inserted.parameter ?? null,
                });
            }
        } catch (e: any) {
            setError(e?.message || 'Could not save reading');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-lg border p-3">
        <div className="mb-2 text-sm font-medium">Add a reading</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm">
        <span className="mb-1 block opacity-80">Parameter</span>
        <select
        className="w-full rounded-md border px-2 py-1.5"
        value={param}
        onChange={e => setParam(e.target.value as ParamKey)}
        >
        {PARAMS.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
        ))}
        </select>
        </label>

        <label className="text-sm">
        <span className="mb-1 block opacity-80">Value</span>
        <input
        type="number"
        step="any"
        className="w-full rounded-md border px-2 py-1.5"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        />
        </label>

        <label className="text-sm">
        <span className="mb-1 block opacity-80">Date & Time</span>
        <input
        type="datetime-local"
        className="w-full rounded-md border px-2 py-1.5"
        value={measuredAt}
        onChange={e => setMeasuredAt(e.target.value)}
        />
        </label>
        </div>

        {error && <div className="mt-2 text-sm text-red-600">Error: {error}</div>}

        <div className="mt-3 flex justify-end">
        <button
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        onClick={save}
        disabled={busy}
        >
        {busy ? 'Saving…' : 'Save reading'}
        </button>
        </div>
        </div>
    );
}
