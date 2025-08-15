// app/calculator/page.tsx
"use client";

import AssistantPanel from "./AssistantPanel";

export default function CalculatorPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <div style={{border:'2px solid #3b82f6', padding: 8, background: '#f0f6ff'}}>
        <p className="mb-2">ChatGPT dosing calculator</p>
        <AssistantPanel />
      </div>
    </main>
  );
}
