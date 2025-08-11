"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HeaderAuth() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback` },
    });
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded border" onClick={signInWithGoogle}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Signed in</span>
      <button className="px-3 py-2 rounded border" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
