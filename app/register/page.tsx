"use client";
import OAuthButtons from "@/components/OAuthButtons";

export default function RegisterPage() {
  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Create account</h1>
      <OAuthButtons />
      <p className="text-sm text-gray-600">We use Google sign-in to create your account.</p>
    </main>
  );
}
