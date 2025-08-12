'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type ParamKey = 'alk' | 'ca' | 'mg' | 'po4' | 'no3' | 'salinity';

const PARAMS = [
    { key: 'alk', label: 'Alkalinity (dKH)' },
    { key: 'ca', label: 'Calcium (ppm)' },
    { key: 'mg', label: 'Magnesium (ppm)' },
    { key: 'po4', label: 'Phosphate (ppm)' },
    { key: 'no3', label: 'Nitrate (ppm)' },
    { key: 'salinity', label: 'Salinity (ppt)' },
] as const;

export default function ResultForm({
    defaultParam = 'alk',
    onSaved,
}: {
    defaultParam?: ParamKey;
    onSaved?: () => void;
}) {
    const [param, setParam] = useState<ParamKey>(defaultParam);
    const [value, setValue] = useState('');
    const [measuredAt, setMeasuredAt] = useState(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });
    const [increasedBy, setIncreasedBy] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save() {
        setError(null);
        if (busy) return;
        setBusy(true);
        try {
            const n = Number(value);
            if (!isFinite(n)) throw new Error('Enter a numeric value');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Please sign in');

            const baseRow: any = {
                user_id: user.id,
                measured_at: new Date(measuredAt).toISOString(),
                value: n,
                parameter_key: param,
            };
            if (increasedBy.trim()) {
                const inc = Number(increasedBy);
                if (!isFinite(inc)) throw new Error('Increased by must be a number');
                baseRow.increased_by = inc;
            }

            let { error } = await supabase.from('results').insert(baseRow);
            if (error && /increased_by/.test(error.message)) {
                delete baseRow.increased_by;
                const { error: e2 } = await supabase.from('results').insert(baseRow);
                if (e2) throw e2;
            } else if (error) throw error;

            setValue('');
            setIncreasedBy('');
            onSaved?.();
        } catch (e: any) {
            setError(e?.message || 'Could not save reading');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-lg border p-3">
        <div className="mb-2 text-sm font-medium">Add a reading</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-sm">
        <span className="mb-1 block opacity-80">Parameter</span>
        <select
        className="w-full rounded-md border px-2 py-1.5"
        value={param}
        onChange={e => setParam(e.target.value as ParamKey)}
        >
        {PARAMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
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
        placeholder="e.g., 8.3"
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
        <label className="text-sm">
        <span className="mb-1 block opacity-80">Increased by (optional)</span>
        <input
        type="number"
        step="any"
        className="w-full rounded-md border px-2 py-1.5"
        value={increasedBy}
        onChange={e => setIncreasedBy(e.target.value)}
        placeholder="e.g., 0.2"
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
