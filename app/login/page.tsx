"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizePhone, phoneToAliasEmail } from "@/lib/phoneAuth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const digits = normalizePhone(phone);
    if (!digits || pin.length !== 4) {
      setErr("Enter your phone and 4-digit PIN.");
      return;
    }
    setBusy(true);
    const email = phoneToAliasEmail(digits);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
    setBusy(false);
    if (error) {
      setErr("Incorrect phone or PIN.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form onSubmit={onLogin} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Phone number</label>
          <input
            className="w-full border rounded px-3 py-2"
            inputMode="tel"
            placeholder="e.g. 083 123 4567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">PIN (4 digits)</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0,4))}
          />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="w-full border rounded px-3 py-2 bg-gray-900 text-white disabled:opacity-60" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        First time here? <a className="underline" href="/register">Create account</a>
      </p>
    </main>
  );
}
