
export const metadata = { title: "ReefBud", description: "Multi-user reef tank dosing tracker" };
import "./globals.css";
import Link from "next/link";
import HealthBadge from "@/components/HealthBadge";
import HeaderAuth from "@/components/HeaderAuth";
export default function RootLayout({ children }:{children:React.ReactNode}) {
  return (
  <html lang="en"><body>
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-2xl font-semibold">ReefBud</Link>
        <nav className="text-sm text-gray-600 space-x-4">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/chemist">Chemist</Link>
          <Link href="/products">Products</Link>
          <Link href="/results">Results</Link>
          <Link href="/calculator">Calculator</Link>
          <Link href="/icp">ICP</Link>
        </nav>
        <div className="flex items-center gap-3"><HealthBadge /><HeaderAuth /></div>
      </header>
      {children}
    </div>
  </body></html>);
}
