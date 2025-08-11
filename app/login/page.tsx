"use client";
import OAuthButtons from "@/components/OAuthButtons";

export default function LoginPage() {
  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <OAuthButtons />
      <p className="text-sm text-gray-600">
        Signing in creates an account if one does not exist yet.
      </p>
    </main>
  );
}
