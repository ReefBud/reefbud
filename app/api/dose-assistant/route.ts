import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

type Msg = { role: "system"|"user"|"assistant"; content: string };
type Facts = { currentDose?: Record<string, number> };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages ?? [];
    const facts: Facts = body?.facts ?? {};

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: (name: string, value: string, options: any) => {
            cookieStore.set({ name, value, ...options });
          },
          remove: (name: string, options: any) => {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Fetch context for this user
    const [tanksRes, targetsRes, resultsRes, prefsRes] = await Promise.all([
      supabase.from("tanks").select("id,name,volume_liters").eq("user_id", user.id).limit(1),
      supabase.from("targets").select("alk,ca,mg,po4,no3,salinity").eq("user_id", user.id).maybeSingle(),
      supabase.from("readings").select("parameter_id,value,measured_at").eq("user_id", user.id).gte("measured_at", new Date(Date.now()-7*864e5).toISOString()),
      supabase.from("preferred_products").select(`
        parameter_id,
        products:product_id (
          brand, name,
          dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text
        )
      `).eq("user_id", user.id),
    ]);

    const ctx = {
      tank: (tanksRes.data ?? [])[0] ?? null,
      targets: targetsRes.data ?? null,
      results: resultsRes.data ?? [],
      prefs: prefsRes.data ?? [],
      facts,
    };

    // Ask for missing critical info
    const followups: string[] = [];
    if (!ctx.tank?.volume_liters) followups.push("What is your tank volume in liters?");
    for (const k of ["alk","ca","mg"]) {
      if ((facts.currentDose ?? {})[k] == null) followups.push(`How many ml/day are you currently dosing for ${k.toUpperCase()}?`);
    }
    // Ask for potency if missing
    const missingPotency: string[] = [];
    for (const p of ctx.prefs as any[]) {
      const pr = p.products;
      if (!pr?.dose_ref_ml || !pr?.delta_ref_value || !pr?.volume_ref_liters) {
        missingPotency.push(`For ${pr?.brand ?? "your"} ${pr?.name ?? "product"} (param id ${p.parameter_id}), provide a potency test like: "X ml raises Y units in Z liters".`);
      }
    }
    if (followups.length || missingPotency.length) {
      return NextResponse.json({
        follow_up: "I need a bit more info:\n" + [...followups, ...missingPotency].map(s => "• " + s).join("\n")
      });
    }

    // Build system prompt
    const t: any = (ctx.targets as any) ?? {};
    const sys = [
      "You are a reef dosing assistant. Be precise and conservative.",
      "Use the user's targets, recent results (last 7 days), product potencies, and tank volume.",
      "If results trend upward/downward, infer consumption per day. Show the math briefly.",
      "Potency math:",
      "u_per_ml_ref = delta_ref_value / dose_ref_ml",
      "u_per_ml_tank = u_per_ml_ref * (volume_ref_liters / tank_volume_L)",
      "dose_ml_needed = desired_change / u_per_ml_tank",
      "",
      `Tank volume (L): ${ctx.tank?.volume_liters}`,
      `Targets: alk=${t?.alk ?? "?"} dKH, ca=${t?.ca ?? "?"} ppm, mg=${t?.mg ?? "?"} ppm, po4=${t?.po4 ?? "?"} ppm, no3=${t?.no3 ?? "?"} ppm, salinity=${t?.salinity ?? "?"} ppt`,
      "Preferred products with potency (if available):"
    ].join("\n");

    const productLines = (ctx.prefs as any[]).map((p: any) => {
      const pr = p.products ?? {};
      return `param_id=${p.parameter_id}: ${pr.brand ?? "?"} ${pr.name ?? "?"} — dose_ref_ml=${pr.dose_ref_ml ?? "?"}, delta_ref_value=${pr.delta_ref_value ?? "?"}, volume_ref_liters=${pr.volume_ref_liters ?? "?"}`;
    });

    const contextBlob = [
      sys,
      ...productLines,
      "",
      "Current daily doses provided by user (ml/day): " + JSON.stringify(facts.currentDose ?? {}),
      "Recent results (last 7 days): " + JSON.stringify(ctx.results ?? [])
    ].join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: contextBlob },
        ...messages,
        { role: "user", content: "Using the above, propose safe one-time corrections (if needed) and a daily dosing plan for Alk, Ca, Mg. Show inputs, math, and final ml/day. If above targets, suggest staged reductions or partial water-change options (e.g., 20%)." }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content ?? "No reply";
    const used = {
      tank_liters: ctx.tank?.volume_liters,
      targets: ctx.targets,
      prefs: (ctx.prefs as any[])?.map((p:any) => ({ parameter_id: p.parameter_id, brand: p.products?.brand, name: p.products?.name, dose_ref_ml: p.products?.dose_ref_ml, delta_ref_value: p.products?.delta_ref_value, volume_ref_liters: p.products?.volume_ref_liters })),
      facts: ctx.facts,
    };

    return NextResponse.json({ reply, used });
  } catch (e:any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
