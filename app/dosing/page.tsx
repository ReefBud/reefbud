'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PARAM_KEYS = ['alk', 'ca', 'mg'] as const;
type ParamKey = typeof PARAM_KEYS[number];

type ParamIdMap = Partial<Record<ParamKey, string>>;
type LatestMap = Partial<Record<ParamKey, number>>;
type TargetMap = Partial<Record<ParamKey, number>>;

export default function DosingPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError(null);
        setLoading(true);

        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error('Please sign in');

        const { data: tanks, error: tanksErr } = await supabase
          .from('tanks')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        if (tanksErr) throw tanksErr;
        if (!tanks || tanks.length === 0) throw new Error('No tanks found');
        const tankId = (tanks[0] as any).id as string;

        const { data: params, error: paramsErr } = await supabase
          .from('parameters')
          .select('id,key')
          .in('key', PARAM_KEYS as unknown as string[]);
        if (paramsErr) throw paramsErr;

        const paramIds: ParamIdMap = {};
        for (const p of params ?? []) {
          const k = (p as any).key as ParamKey;
          if ((PARAM_KEYS as readonly string[]).includes(k)) paramIds[k] = (p as any).id;
        }

        const latest: LatestMap = {};
        await Promise.all(
          (PARAM_KEYS as readonly ParamKey[]).map(async (k) => {
            const pid = paramIds[k];
            if (!pid) return;
            const { data, error } = await supabase
              .from('results')
              .select('value')
              .eq('user_id', user.id)
              .eq('tank_id', tankId)
              .eq('parameter_id', pid)
              .order('measured_at', { ascending: false })
              .limit(1);
            if (!error && data && data.length) latest[k] = Number((data[0] as any).value ?? NaN);
          })
        );

        let targets: TargetMap = {};
        try {
          const { data: tgt, error: tgtErr } = await supabase
            .from('parameter_targets') // adjust if different
            .select('key,target_value')
            .eq('tank_id', tankId)
            .in('key', PARAM_KEYS as unknown as string[]);
          if (!tgtErr && tgt?.length) {
            targets = (tgt as any[]).reduce((acc: TargetMap, row: any) => {
              const k = row.key as ParamKey;
              if ((PARAM_KEYS as readonly string[]).includes(k)) acc[k] = Number(row.target_value ?? NaN);
              return acc;
            }, {});
          }
        } catch {}

        if (cancelled) return;
        const i = iframeRef.current;
        if (!i || !i.contentWindow) throw new Error('Calculator not loaded');

        const waitForDC = () =>
          new Promise<void>((resolve, reject) => {
            const start = Date.now();
            const tick = () => {
              const w: any = i.contentWindow;
              if (w && w.DosingCalculator) return resolve();
              if (Date.now() - start > 6000) return reject(new Error('DosingCalculator API not ready'));
              setTimeout(tick, 60);
            };
            tick();
          });
        await waitForDC();
        const w: any = i.contentWindow;

        // Optional: prefill tank volume if stored on tanks.volume_l
        // try {
        //   const { data: trow } = await supabase.from('tanks').select('volume_l').eq('id', tankId).single();
        //   if (trow?.volume_l) w.DosingCalculator.setTankVolume(Number(trow.volume_l), 'L');
        // } catch {}

        w.DosingCalculator.setCurrentParams({ alk: latest.alk, ca: latest.ca, mg: latest.mg });
        if (Object.keys(targets).length) {
          w.DosingCalculator.setTargetParams({ alk: targets.alk, ca: targets.ca, mg: targets.mg });
        }

      } catch (e: any) {
        setError(e?.message || 'Failed to load dosing data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function onLoad() { run(); }
    const node = iframeRef.current;
    if (node) node.addEventListener('load', onLoad);
    return () => {
      cancelled = true;
      if (node) node.removeEventListener('load', onLoad);
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dosing Calculator</h1>
          <p className="text-sm text-gray-500">Auto-prefilled from your latest results and (optionally) your dashboard targets.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-lg border shadow overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/dosing-calculator.html"
          title="Dosing Calculator"
          style={{ width: '100%', height: '1160px', border: 0 }}
        />
      </div>

      {loading && <div className="text-sm text-gray-500">Loading your tank data…</div>}
    </div>
  );
}
