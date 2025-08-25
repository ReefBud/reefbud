"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });
      }
      router.replace("/");
    })();
  }, [router]);
  return <p className="p-6">Signing you in…</p>;
}
