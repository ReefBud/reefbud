"use client";
import { useState } from "react";

type Msg = { role: "user"|"assistant"; content: string };

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [facts, setFacts] = useState<any>({ currentDose: {} });
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState<any>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);

  async function send() {
    if (!input.trim()) return;
    const nextMsgs = [...messages, { role:"user", content: input }];
    setMessages(nextMsgs);
    setInput("");
    setBusy(true);
    const res = await fetch("/api/dose-assistant", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ messages: nextMsgs, facts })
    }).then(r => r.json()).catch(err => ({ error: err?.message || "Network error" }));
    setBusy(false);

    if (res.error) {
      setMessages(m => [...m, { role:"assistant", content: "Error: " + res.error }]);
      return;
    }
    if (res.follow_up) {
      setFollowUp(res.follow_up);
      setMessages(m => [...m, { role:"assistant", content: res.follow_up }]);
      return;
    }
    setFollowUp(null);
    if (res.used) setUsed(res.used);
    if (res.reply) setMessages(m => [...m, { role:"assistant", content: res.reply }]);
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="text-sm opacity-70">
        Ask for a dosing plan. The assistant will use your targets, recent results, and selected products. If it needs anything, it will ask.
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["alk","ca","mg"].map(k => (
          <input key={k} className="w-full rounded border px-2 py-1"
            placeholder={`${k.toUpperCase()} ml/day`}
            onChange={e => setFacts((f:any) => ({...f, currentDose: {...f.currentDose, [k]: Number(e.target.value || 0)}}))}
          />
        ))}
      </div>

      <div className="h-56 overflow-auto space-y-2 border rounded p-2 bg-gray-50">
        {messages.map((m,i) => (
          <div key={i} className={m.role==="assistant" ? "text-blue-900" : "text-gray-900"}>
            <b>{m.role === "assistant" ? "Assistant" : "You"}:</b> {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={input} onChange={e=>setInput(e.target.value)} placeholder="Describe your latest readings or ask for a plan..." />
        <button className="rounded bg-blue-600 text-white px-3 py-1 disabled:opacity-60" disabled={busy} onClick={send}>{busy ? "..." : "Send"}</button>
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
