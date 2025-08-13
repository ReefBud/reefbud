"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <main className="p-6 space-y-6">
    <h1 className="text-2xl font-semibold">ReefBud</h1>
    <p className="text-sm text-gray-600">Choose a section to get started.</p>
    <div className="grid gap-4 md:grid-cols-3">
    <Tile href="/dashboard" title="Dashboard" desc="Tank volume + target parameters." />
    <Tile href="/calculator" title="Calculator" desc="Dosing suggestions from your targets/readings." />
    <Tile href="/products" title="Products" desc="Add custom products and potencies." />
    <Tile href="/results" title="Results" desc="View parameter trends over time." />
    {!signedIn && <Tile href="/login" title="Sign in" desc="Sign in to save your data." />}
    </div>
    </main>
  );
}

function Tile({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block rounded-2xl border p-4 hover:shadow-md transition">
    <div className="text-lg font-medium">{title}</div>
    <div className="text-sm text-gray-600 mt-1">{desc}</div>
    </Link>
  );
}
