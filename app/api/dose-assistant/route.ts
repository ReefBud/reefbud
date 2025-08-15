// app/api/dose-assistant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Facts = { currentDose?: Partial<Record<"alk" | "ca" | "mg", number>> };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
    const facts: Facts = (body?.facts ?? {}) as Facts;

    const supabase = createRouteHandlerClient({ cookies }) as any;
    const { data: { user } = { user: null } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        follow_up:
          "You’re not signed in. I can still help — please tell me: tank volume (L), your current ml/day for Alk, Ca, Mg, and the potency for your product(s): X ml raises Y units in Z liters.",
      });
    }

    const sinceISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tanks } = await supabase
      .from("tanks")
      .select("id,name,volume_liters,volume_value")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    const tank = (tanks ?? [])[0] ?? null;

    const [targetsRes, prefsRes, resultsRes] = await Promise.all([
      supabase.from("targets")
        .select("alk,ca,mg,po4,no3,salinity")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("preferred_products").select(`
        parameter_id,
        product_id,
        products:product_id (
          brand,
          name,
          dose_ref_ml,
          delta_ref_value,
          volume_ref_liters,
          helper_text
        )
      `).eq("user_id", user.id).eq("tank_id", tank?.id ?? -1),
      tank
        ? supabase.from("results")
            .select("parameter_id,value,measured_at")
            .eq("tank_id", tank.id)
            .gte("measured_at", sinceISO)
            .order("measured_at", { ascending: true })
        : supabase.from("results")
            .select("parameter_id,value,measured_at")
            .eq("user_id", user.id)
            .gte("measured_at", sinceISO)
            .order("measured_at", { ascending: true }),
    ]);

    const targets = targetsRes?.data ?? null;
    const prefs = prefsRes?.data ?? [];
    const results = resultsRes?.data ?? [];

    const followups: string[] = [];
    const tank_liters = tank?.volume_liters ?? tank?.volume_value ?? null;
    if (!tank_liters) followups.push("What is your tank volume in liters?");
    for (const k of ["alk", "ca", "mg"] as const) {
      if (facts?.currentDose?.[k] == null) {
        followups.push(`How many ml/day are you currently dosing for ${k.toUpperCase()}?`);
      }
    }
    for (const p of prefs as any[]) {
      const pr = p?.products ?? {};
      if (!pr?.dose_ref_ml || !pr?.delta_ref_value || !pr?.volume_ref_liters) {
        followups.push(
          `For ${pr?.brand ?? "your"} ${pr?.name ?? "product"} (param id ${p?.parameter_id}), provide potency like: "X ml raises Y units in Z liters".`
        );
      }
    }
    if (followups.length) {
      return NextResponse.json({
        follow_up: "I need a bit more info:\n" + followups.map((s) => "• " + s).join("\n"),
      });
    }

    const t: any = targets ?? {};
    const header = [
      "You are a reef dosing assistant. Be precise and conservative.",
      "Use the user's targets, recent results (last 7 days), product potencies, and tank volume.",
      "If results trend up/down, infer daily consumption. Show the math briefly.",
      "Potency math:",
      "u_per_ml_ref = delta_ref_value / dose_ref_ml",
      "u_per_ml_tank = u_per_ml_ref * (volume_ref_liters / tank_volume_L)",
      "dose_ml_needed = desired_change / u_per_ml_tank",
      "",
      `Tank volume (L): ${tank_liters}`,
      `Targets: alk=${t?.alk ?? "?"} dKH, ca=${t?.ca ?? "?"} ppm, mg=${t?.mg ?? "?"} ppm, po4=${t?.po4 ?? "?"} ppm, no3=${t?.no3 ?? "?"} ppm, salinity=${t?.salinity ?? "?"} ppt`,
      "Preferred products with potency (if available):",
    ].join("\n");

    const productLines = (prefs as any[]).map((p: any) => {
      const pr = p?.products ?? {};
      return `param_id=${p?.parameter_id}: ${pr?.brand ?? "?"} ${pr?.name ?? "?"} — dose_ref_ml=${pr?.dose_ref_ml ?? "?"}, delta_ref_value=${pr?.delta_ref_value ?? "?"}, volume_ref_liters=${pr?.volume_ref_liters ?? "?"}`;
    });

    const contextBlob = [
      header,
      ...productLines,
      "",
      "Current daily doses provided by user (ml/day): " + JSON.stringify(facts?.currentDose ?? {}),
      "Recent results (last 7 days): " + JSON.stringify(results ?? []),
    ].join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: contextBlob },
        ...messages,
        {
          role: "user",
          content:
            "Using the above, propose safe one-time corrections (if needed) and a daily dosing plan for Alk, Ca, Mg. Show inputs, math, and final ml/day. If above targets, suggest staged reductions or partial water-change options (e.g., 20%).",
        },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content ?? "No reply";
    const used = {
      tank_liters,
      targets,
      prefs: (prefs as any[])?.map((p: any) => ({
        parameter_id: p?.parameter_id,
        brand: p?.products?.brand,
        name: p?.products?.name,
        dose_ref_ml: p?.products?.dose_ref_ml,
        delta_ref_value: p?.products?.delta_ref_value,
        volume_ref_liters: p?.products?.volume_ref_liters,
      })),
      facts,
    };

    return NextResponse.json({ reply, used });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
