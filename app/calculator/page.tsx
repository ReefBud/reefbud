'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PARAM_KEYS = ['alk', 'ca', 'mg'] as const;
type ParamKey = typeof PARAM_KEYS[number];

type ParamIdMap = Partial<Record<ParamKey, string>>;
type LatestMap = Partial<Record<ParamKey, number>>;
type TargetMap = Partial<Record<ParamKey, number>>;

export default function CalculatorPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function waitForIframe(): Promise<void> {
      const start = Date.now();
      return new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (cancelled) return reject(new Error('cancelled'));
          const i = iframeRef.current;
          if (i && i.contentWindow) return resolve();
          if (Date.now() - start > 8000) return reject(new Error('Calculator frame not ready'));
          setTimeout(tick, 60);
        };
        tick();
      });
    }

    async function waitForDC(): Promise<void> {
      const start = Date.now();
      return new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (cancelled) return reject(new Error('cancelled'));
          const i = iframeRef.current;
          const w: any = i?.contentWindow;
          if (w && w.DosingCalculator) return resolve();
          if (Date.now() - start > 8000) return reject(new Error('DosingCalculator API not ready'));
          setTimeout(tick, 60);
        };
        tick();
      });
    }

    async function run() {
      try {
        setError(null);
        setLoading(true);

        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) throw new Error('Please sign in');

        // First tank
        const { data: tanks, error: tanksErr } = await supabase
          .from('tanks')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        if (tanksErr) throw tanksErr;
        if (!tanks?.length) throw new Error('No tanks found');
        const tankId = (tanks[0] as any).id as string;

        // Parameter IDs for alk/ca/mg
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

        // Latest results per parameter
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
            if (!error && data?.length) latest[k] = Number((data[0] as any).value ?? NaN);
          })
        );

        // Targets (adjust this table/columns if yours differ)
        let targets: TargetMap = {};
        try {
          const { data: tgt, error: tgtErr } = await supabase
            .from('parameter_targets') // change if you store targets elsewhere
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
        } catch { /* no targets table yet is fine */ }

        // Ensure iframe + calculator API are ready
        await waitForIframe();
        await waitForDC();

        const w: any = iframeRef.current!.contentWindow;

        // Optionally prefill tank volume if you store it (uncomment & adjust):
        // try {
        //   const { data: trow } = await supabase.from('tanks').select('volume_l').eq('id', tankId).single();
        //   if (trow?.volume_l) w.DosingCalculator.setTankVolume(Number(trow.volume_l), 'L');
        // } catch {}

        // Prefill latest CURRENT test values
        w.DosingCalculator.setCurrentParams({
          alk: latest.alk,
          ca:  latest.ca,
          mg:  latest.mg,
        });

        // Prefill TARGETS if present
        if (Object.keys(targets).length) {
          w.DosingCalculator.setTargetParams({
            alk: targets.alk,
            ca:  targets.ca,
            mg:  targets.mg,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load dosing data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Kick it off immediately (don’t rely on iframe onLoad)
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dosing Calculator</h1>
          <p className="text-sm text-gray-500">
            Auto-prefilled from your latest results and (optionally) your dashboard targets.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
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
