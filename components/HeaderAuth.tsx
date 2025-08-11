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
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a className="px-3 py-2 rounded border" href="/login">Sign in</a>
        <a className="px-3 py-2 rounded border bg-gray-900 text-white" href="/register">Create account</a>
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
