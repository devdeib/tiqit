"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLoginFormState } from "@/lib/auth/use-login-form-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

function LoginForm() {
  const router = useRouter();
  const { error, setError, accessDenied, clearError } = useLoginFormState("organizer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/organizer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-16"
      style={{ background: "var(--tq-void)" }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 55%, rgba(139,47,232,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm tq-fade-up">
        {/* Logo */}
        <div className="mb-10 text-center">
          <TiqitLogo size="lg" href="/" />
          <p className="mt-3 tq-label">Organizer portal</p>
        </div>

        {/* Card */}
        <div
          className="tq-panel"
          style={{ borderTop: "2px solid var(--tq-purple)" }}
        >
          <div className="p-8">
            <h1
              className="mb-1 text-xl"
              style={{ fontWeight: 900, letterSpacing: "-0.03em" }}
            >
              Sign in
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--tq-muted)" }}>
              Use your approved organizer account.
            </p>

            {accessDenied && (
              <div
                className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(247,37,133,0.1)", color: "var(--tq-pink)", border: "1px solid rgba(247,37,133,0.2)" }}
              >
                This account is not an approved organizer.
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="tq-label mb-2 block">Email</label>
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  className="tq-input"
                />
              </div>
              <div>
                <label className="tq-label mb-2 block">Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="tq-input"
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--tq-pink)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="tq-btn-primary w-full"
                style={{ marginTop: "8px" }}
              >
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--tq-muted)" }}>
          <Link href="/" className="transition-colors hover:text-white" style={{ color: "var(--tq-muted)" }}>
            ← Back to events
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--tq-void)" }}>
          <TiqitLogo size="lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
