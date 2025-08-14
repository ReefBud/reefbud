// app/assistant/page.tsx
import AssistantPanel from "../calculator/AssistantPanel";

export default function AssistantPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Assistant</h1>
      <div style={{border:'2px solid #3b82f6', padding: 8, background: '#f0f6ff'}}>
        <p className="mb-2">DEBUG: This is the Assistant page. If you can see this box, routing is correct.</p>
        <AssistantPanel />
      </div>
    </main>
  );
}
