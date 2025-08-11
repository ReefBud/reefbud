
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const param = searchParams.get("param") || "";
  return new Response(JSON.stringify({ q, param, results: [] }), { status: 200 });
}
