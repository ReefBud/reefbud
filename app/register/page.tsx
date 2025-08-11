"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizePhone, phoneToAliasEmail } from "@/lib/phoneAuth";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const digits = normalizePhone(phone);
    if (!digits || pin.length !== 4) {
      setErr("Enter your phone and a 4-digit PIN.");
      return;
    }
    setBusy(true);
    const email = phoneToAliasEmail(digits);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pin,
      options: { emailRedirectTo: undefined },
    });
    if (error) {
      setBusy(false);
      setErr(error.message || "Could not create account.");
      return;
    }
    const user = data.user;
    try {
      if (user?.id) {
        await supabase.from("profiles").upsert({ id: user.id, phone: digits }).select();
      }
    } catch {}
    setBusy(false);
    router.replace("/dashboard");
  }

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Create account</h1>
      <form onSubmit={onRegister} className="space-y-3">
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
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account? <a className="underline" href="/login">Sign in</a>
      </p>
    </main>
  );
}
