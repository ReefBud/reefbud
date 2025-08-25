// app/auth/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send link");
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-gray-600">Enter your email. We'll send you a magic link to sign in.</p>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          required
          className="w-full rounded border px-3 py-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="rounded bg-blue-600 text-white px-4 py-2">Send magic link</button>
      </form>
      {sent && (
        <div className="text-sm text-green-700 border border-green-300 rounded p-2 bg-green-50">
          Check your email for the magic link. After opening it, come back to the Calculator.
        </div>
      )}
      {err && <div className="text-sm text-red-700 border border-red-300 rounded p-2 bg-red-50">{err}</div>}
      <div className="text-sm">
        After signing in, visit <code>/api/whoami</code>. It should show your user object. Then return to <code>/calculator</code>.
      </div>
    </main>
  );
}
