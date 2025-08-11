
import Link from "next/link";
export default function Home(){
  return (<main className="space-y-4">
    <div className="border rounded p-4">Welcome. Use the nav above to open pages.</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Link className="border rounded p-3" href="/dashboard">Dashboard</Link>
      <Link className="border rounded p-3" href="/chemist">Chemist</Link>
      <Link className="border rounded p-3" href="/products">Products</Link>
      <Link className="border rounded p-3" href="/results">Results</Link>
      <Link className="border rounded p-3" href="/calculator">Calculator</Link>
      <Link className="border rounded p-3" href="/icp">ICP</Link>
    </div>
  </main>);
}
