// app/calculator/page.tsx
"use client";

import AssistantPanel from "./AssistantPanel";

export default function CalculatorPage() {
  const [loadingPref, setLoadingPref] = useState(false);

  // Inputs
  const [tankLiters, setTankLiters] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("perLiter");
  const [currentDose, setCurrentDose] = useState<Doses>({});
  const [potencies, setPotencies] = useState<Potencies>({ alk: {}, ca: {}, mg: {} });
  const [current, setCurrent] = useState<Params>({});
  const [target, setTarget] = useState<Targets>({});

  // Results
  const [requiredDose, setRequiredDose] = useState<Doses>({});
  const [deltaDose, setDeltaDose] = useState<Doses>({});

  // NEW: auto-prefill from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPref(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1) Find latest tank and prefill volume
        const { data: tanks } = await supabase
          .from('tanks')
          .select('id, name, volume_liters, volume_value')
          .order('created_at', { ascending: false })
          .limit(1);

        const tank = (tanks ?? [])[0] ?? null;
        const tankId = tank?.id ?? null;
        if (tank) {
          const vol =
            typeof tank.volume_liters === "number"
              ? tank.volume_liters
              : typeof tank.volume_value === "number"
              ? tank.volume_value
              : undefined;
          if (vol && !cancelled) setTankLiters(vol);
        }

        // 2) Prefill target params from dashboard targets
        const { data: tgt } = await supabase
          .from('targets')
          .select('alk, ca, mg')
          .eq('user_id', user.id)
          .maybeSingle();
        if (tgt && !cancelled) {
          setTarget({
            alk: typeof tgt.alk === 'number' ? tgt.alk : undefined,
            ca:  typeof tgt.ca  === 'number' ? tgt.ca  : undefined,
            mg:  typeof tgt.mg  === 'number' ? tgt.mg  : undefined,
          });
        }

        // 3) Prefill potencies per parameter from preferred_products -> products
        const { data: prefs } = await supabase
          .from('preferred_products')
          .select('parameter_key, products:product_id (brand, name, dose_ref_ml, delta_ref_value, volume_ref_liters)')
          .in('parameter_key', ['alk','ca','mg'])
          .limit(10);
        if (prefs && !cancelled) {
          const next: Potencies = { alk: {}, ca: {}, mg: {} };
          for (const row of prefs) {
            const pk = (row as any).parameter_key as 'alk'|'ca'|'mg';
            const prod: any = (row as any).products ?? {};
            const doseRef = Number(prod?.dose_ref_ml);
            const deltaRef = Number(prod?.delta_ref_value);
            const volRef = Number(prod?.volume_ref_liters);
            if (Number.isFinite(doseRef) && doseRef > 0 && Number.isFinite(deltaRef) && Number.isFinite(volRef) && volRef > 0) {
              next[pk].perLiter = (deltaRef / doseRef) / volRef;
            }
          }
          setPotencies(prev => ({ ...prev, ...next }));
        }

        // 4) Prefill current params from latest 3 results per parameter (average)
        if (tankId) {
          // map keys -> ids
          const { data: plist } = await supabase
            .from('parameters')
            .select('id, key')
            .in('key', ['alk','ca','mg']);
          const idByKey = new Map<string, number>();
          for (const p of plist ?? []) idByKey.set((p as any).key, (p as any).id);

          const curr: any = {};
          for (const key of ['alk','ca','mg'] as const) {
            const pid = idByKey.get(key);
            if (!pid) continue;
            const { data: rows } = await supabase
              .from('results')
              .select('value, measured_at')
              .eq('user_id', user.id)
              .eq('tank_id', tankId)
              .eq('parameter_id', pid)
              .order('measured_at', { ascending: false })
              .limit(3);
            const vals = (rows ?? [])
              .map(r => Number((r as any).value))
              .filter(v => Number.isFinite(v));
            if (vals.length) {
              const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
              curr[key] = Math.round(avg * 100) / 100;
            }
          }
          if (!cancelled) setCurrent((prev) => ({ ...prev, ...curr }));
        }
      } finally {
        if (!cancelled) setLoadingPref(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <div style={{border:'2px solid #3b82f6', padding: 8, background: '#f0f6ff'}}>
        <p className="mb-2">ChatGPT dosing calculator</p>
        <AssistantPanel />
      </div>
    </main>
  );
}
