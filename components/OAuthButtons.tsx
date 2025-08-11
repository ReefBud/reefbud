"use client";
import { supabase } from "@/lib/supabaseClient";

export default function OAuthButtons() {
  async function signInWith(provider: "google") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="space-y-2">
      <button className="px-3 py-2 rounded border w-full" onClick={() => signInWith("google")}>
        Continue with Google
      </button>
    </div>
  );
}
