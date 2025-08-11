
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthBar() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setStatus("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined }
    });
    if (error) setStatus(error.message); else setStatus("Check your email.");
  }

  async function signOut() { await supabase.auth.signOut(); }

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <span className="text-sm text-gray-600">{user.email}</span>
          <button className="btn" onClick={signOut}>Sign out</button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <input className="input" placeholder="email@domain.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <button className="btn" onClick={signIn}>Sign in</button>
          {status && <span className="text-xs text-gray-500">{status}</span>}
        </div>
      )}
    </div>
  );
}
