"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessDenied = searchParams.get("error") === "access_denied";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      const next = searchParams.get("next") || "/admin";
      router.push(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Admin sign in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Requires a Supabase Auth user linked to a <code className="text-xs">users</code> row with{" "}
        <code className="text-xs">role = admin</code>.
      </p>
      {accessDenied && (
        <p className="mt-4 text-sm text-red-600">This account does not have admin access.</p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        <Link href="/" className="underline">
          Back to public site
        </Link>
      </p>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-8">Loading…</main>}>
      <AdminLoginForm />
    </Suspense>
  );
}
