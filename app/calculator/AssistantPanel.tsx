// app/calculator/AssistantPanel.tsx
"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

type ApiReply = {
  reply?: string;
  used?: any;
  follow_up?: string;
  error?: string;
};

type Facts = { currentDose: Partial<Record<"alk" | "ca" | "mg", number>> };

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState<any>(null);
  const [facts, setFacts] = useState<Facts>({ currentDose: {} });

  async function send() {
    if (!input.trim()) return;

    const nextMsgs: Msg[] = [...messages, { role: "user" as const, content: input }];
    setMessages(nextMsgs);
    setInput("");
    setBusy(true);

    let res: ApiReply = {};
    try {
      const r = await fetch("/api/dose-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs, facts }),
      });
      res = (await r.json()) as ApiReply;
    } catch (e: any) {
      res = { error: e?.message || "Network error" };
    } finally {
      setBusy(false);
    }

    if (res.error) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${res.error}` }]);
      return;
    }

    if (res.follow_up) {
      setMessages((m) => [...m, { role: "assistant", content: res.follow_up as string }]);
      return;
    }

    if (res.used) setUsed(res.used);
    if (res.reply) {
      setMessages((m) => [...m, { role: "assistant", content: res.reply as string }]);
    }
  }

  function setDose(key: "alk" | "ca" | "mg", value: string) {
    const v = value.trim();
    const num = v === "" ? NaN : Number(v);

    setFacts((prev) => {
      const next = { ...prev.currentDose };
      if (!Number.isFinite(num)) delete next[key];
      else next[key] = num;
      return { currentDose: next };
    });
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="text-sm opacity-70">
        Ask for a dosing plan. The assistant will use your targets, recent results, preferred products and potencies, and your tank volume. If
        something is missing it will ask you.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className="w-full rounded border px-2 py-1" placeholder="ALK ml/day" inputMode="decimal" onChange={(e) => setDose("alk", e.target.value)} />
        <input className="w-full rounded border px-2 py-1" placeholder="CA ml/day" inputMode="decimal" onChange={(e) => setDose("ca", e.target.value)} />
        <input className="w-full rounded border px-2 py-1" placeholder="MG ml/day" inputMode="decimal" onChange={(e) => setDose("mg", e.target.value)} />
      </div>

      <div className="h-56 overflow-auto space-y-2 border rounded p-2 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? "text-blue-900" : "text-gray-900"}>
            <b>{m.role === "assistant" ? "Assistant" : "You"}:</b> {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your latest readings or ask for a plan..." />
        <button className="rounded bg-blue-600 text-white px-3 py-1 disabled:opacity-60" disabled={busy} onClick={send}>
          {busy ? "..." : "Send"}
        </button>
      </div>

      {used && (
        <details className="text-xs">
          <summary>Inputs used</summary>
          <pre className="whitespace-pre-wrap">{JSON.stringify(used, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
