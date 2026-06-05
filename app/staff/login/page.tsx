"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLoginFormState } from "@/lib/auth/use-login-form-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error, setError, accessDenied, clearError } = useLoginFormState("staff");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const next = searchParams.get("next") || "/staff";
      router.push(next.startsWith("/staff") ? next : "/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Staff sign in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Door staff only. Account must have <code className="text-xs">role = staff</code> and an
        event assignment.
      </p>
      {accessDenied && (
        <p className="mt-4 text-sm text-red-600">This account does not have staff access.</p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          className="w-full rounded border px-3 py-3 text-base"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
          }}
          className="w-full rounded border px-3 py-3 text-base"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-emerald-800 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        <Link href="/" className="underline">
          Public site
        </Link>
      </p>
    </main>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <StaffLoginForm />
    </Suspense>
  );
}
