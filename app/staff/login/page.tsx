"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLoginFormState } from "@/lib/auth/use-login-form-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

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
      const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email, password });
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", background: "var(--tq-void)", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 40% at 50% 55%,rgba(139,47,232,.1) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: "360px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}><TiqitLogo size="lg" href="/" /></div>
          <span style={{ fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tq-muted)" }}>Staff scanner</span>
        </div>
        <div style={{ background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderTop: "2px solid var(--tq-purple)", borderRadius: "12px", padding: "32px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "4px" }}>Staff sign in</h1>
          <p style={{ fontSize: "13px", color: "var(--tq-muted)", marginBottom: "24px" }}>Door staff only. Must have staff role and event assignment.</p>
          {accessDenied && <div style={{ background: "rgba(247,37,133,.1)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px", color: "var(--tq-pink)" }}>This account does not have staff access.</div>}
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div><label style={{ display: "block", fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Email</label><input required type="email" placeholder="staff@tiqit.io" value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }} className="tq-input" /></div>
            <div><label style={{ display: "block", fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Password</label><input required type="password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }} className="tq-input" /></div>
            {error && <p style={{ fontSize: "13px", color: "var(--tq-pink)" }}>{error}</p>}
            <button type="submit" disabled={loading} className="tq-btn-primary">{loading ? "Signing in…" : "Sign in →"}</button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px" }}><Link href="/" style={{ color: "var(--tq-muted)", textDecoration: "none" }}>← Back to events</Link></p>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--tq-void)", display: "flex", alignItems: "center", justifyContent: "center" }}><TiqitLogo size="lg" /></div>}><StaffLoginForm /></Suspense>;
}
