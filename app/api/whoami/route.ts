// app/api/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies }) as any;
  const { data: { user } = { user: null } } = await supabase.auth.getUser();
  return NextResponse.json({ user });
}
