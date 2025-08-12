// app/results/InjectDeleteIntoRechartsTooltip.tsx
'use client';
import DeleteReadingButton from '@/app/components/DeleteReadingButton';
import type { TooltipProps } from 'recharts';

type Datum = {
  id: string;
  date?: string;
  measured_at?: string;
  value?: number;
  v?: number;
  y?: number;
};

export default function InjectDeleteIntoRechartsTooltip(
  props: TooltipProps<number, string> & { onLocalDelete?: (id: string) => void }
) {
  const { active, payload, label, onLocalDelete } = props;
  if (!active || !payload?.length) return null;

  const p = payload[0]?.payload as Datum | undefined;
  if (!p?.id) return null;

  const when = p.measured_at || p.date || (typeof label === 'string' ? label : undefined);
  const value = p.value ?? p.y ?? p.v;

  return (
    <div className="rounded-md border bg-white p-2 text-xs shadow">
      {when ? <div className="mb-1 font-medium">{new Date(when).toLocaleString()}</div> : null}
      <div className="mb-2">Value: {value}</div>
      <DeleteReadingButton
        id={p.id}
        label="Delete point"
        onDeleted={(deletedId) => onLocalDelete?.(deletedId)}
      />
    </div>
  );
}
