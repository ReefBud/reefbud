// app/calculator/page.tsx
"use client";

import dynamic from "next/dynamic";

const CalculatorForm = dynamic(() => import("./CalculatorForm"), { ssr: false });

export default function CalculatorPage() {
  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
    <h1 className="text-2xl font-semibold">Dosing Calculator</h1>
    <p className="text-sm text-muted-foreground">
    Enter your tank size, current daily doses, potency of your products, and current vs target parameters.
    This tool will suggest the daily dosing amount to reach your targets.
    </p>
    <CalculatorForm />
    </main>
  );
}
