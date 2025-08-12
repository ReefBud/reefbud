// app/results/InjectDeleteIntoRechartsTooltip.tsx
'use client';
import DeleteReadingButton from '@/app/components/DeleteReadingButton';
import type { TooltipProps } from 'recharts';

type Datum = {
  id?: string;
  measured_at?: string;
  date?: string;
  value?: number;
  y?: number;
  v?: number;
};

export default function InjectDeleteIntoRechartsTooltip(
  props: TooltipProps<number, string> & { onLocalDelete?: (id: string) => void }
) {
  if (!props.active || !props.payload?.length) return null;
  const p = (props.payload?.[0]?.payload || {}) as Datum;
  const id = p.id as string | undefined;
  const when = p.measured_at || p.date;
  const value = p.value ?? p.y ?? p.v;

  return (
    <div className="rounded-md border bg-white p-2 text-xs shadow">
      {when ? <div className="mb-1 font-medium">{new Date(when).toLocaleString()}</div> : null}
      {value !== undefined ? <div className="mb-2">Value: {value}</div> : null}
      {id ? (
        <DeleteReadingButton
          id={id}
          label="Delete point"
          onDeleted={(deletedId) => props.onLocalDelete?.(deletedId)}
          tableName="results"
        />
      ) : (
        <div className="italic opacity-70">No id available</div>
      )}
    </div>
  );
}
