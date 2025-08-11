"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    // Wait briefly to ensure session is set, then route to dashboard
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      router.replace("/dashboard");
    }, 300);
    return () => clearTimeout(t);
  }, [router]);
  return <main className="p-6">Signing you in…</main>;
}
