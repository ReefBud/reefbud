
import Link from "next/link";

export default function Home() {
  return (
    <main className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-medium mb-2">Welcome</h2>
        <p className="text-sm text-gray-600">Sign in with your email to save data in Supabase. Choose a tool below.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex items-center justify-between">
          <div><h3 className="font-medium">Dashboard</h3><p className="text-sm text-gray-600">Tank volume & current params.</p></div>
          <Link className="btn" href="/dashboard">Open</Link>
        </div>
        <div className="card flex items-center justify-between">
          <div><h3 className="font-medium">Chemist</h3><p className="text-sm text-gray-600">Targets & product selection.</p></div>
          <Link className="btn" href="/chemist">Open</Link>
        </div>
        <div className="card flex items-center justify-between">
          <div><h3 className="font-medium">Results</h3><p className="text-sm text-gray-600">Log results with date/time.</p></div>
          <Link className="btn" href="/results">Open</Link>
        </div>
        <div className="card flex items-center justify-between">
          <div><h3 className="font-medium">Calculator</h3><p className="text-sm text-gray-600">Compute correction & daily dose.</p></div>
          <Link className="btn" href="/calculator">Open</Link>
        </div>
      </div>
    </main>
  );
}
