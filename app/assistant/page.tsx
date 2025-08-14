import AssistantPanel from "../calculator/AssistantPanel";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dosing Assistant (Chat)</h1>
      <AssistantPanel />
    </main>
  );
}
