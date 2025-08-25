"use client";
import { supabase } from "@/lib/supabaseClient";

export default function OAuthButtons() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      },
    });
  }
  return (
    <button className="px-3 py-2 rounded border bg-gray-900 text-white w-full" onClick={signInWithGoogle}>
      Continue with Google
    </button>
  );
}
