"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import type { CheckoutStatusResponse } from "@/types/api";
import { PageShell } from "@/components/ui/page-shell";

function MockPayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const phone = sessionStorage.getItem("guestPhone");
    if (!phone) return;
    apiGet<{ status: CheckoutStatusResponse }>(`/api/checkout/${orderId}/status?phone=${encodeURIComponent(phone)}`)
      .then(({ status: s }) => setStatus(s)).catch(() => {});
  }, [orderId]);

  async function completePayment() {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const phone = sessionStorage.getItem("guestPhone");
      if (!phone) throw new Error("Missing guest phone — reserve tickets again from the event page");
      await apiPost("/api/dev/simulate-payment", { orderId, phone });
      router.push(`/orders/${orderId}/confirmation?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment simulation failed");
      setLoading(false);
    }
  }

  if (!orderId) return <p style={{ color: "var(--tq-pink)" }}>Missing orderId</p>;
  const alreadyPaid = status?.paymentStatus === "completed" || status?.orderStatus === "confirmed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ background: "rgba(212,168,67,.08)", border: "1px solid rgba(212,168,67,.2)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "var(--tq-gold)" }}>
        Development mode — Sham Cash API not configured.
      </div>
      {alreadyPaid && (
        <p style={{ fontSize: "13px", color: "var(--tq-gold)" }}>
          This order is already paid.{" "}
          <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tq-purple-lt)", textDecoration: "underline", fontFamily: "inherit", fontSize: "13px" }}
            onClick={() => { const phone = sessionStorage.getItem("guestPhone") ?? ""; router.push(`/orders/${orderId}/confirmation${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`); }}>
            View tickets
          </button>
        </p>
      )}
      {error && <p style={{ fontSize: "13px", color: "var(--tq-pink)" }}>{error}</p>}
      <button type="button" onClick={() => void completePayment()} disabled={loading || alreadyPaid} className="tq-btn-primary" style={{ background: "rgba(139,47,232,.8)" }}>
        {loading ? "Processing…" : "Simulate successful payment →"}
      </button>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <PageShell>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "6px" }}>Mock payment</h1>
        <p style={{ fontSize: "13px", color: "var(--tq-muted)", marginBottom: "24px" }}>Dev environment only.</p>
        <div style={{ background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderRadius: "12px", padding: "24px" }}>
          <Suspense fallback={<p style={{ color: "var(--tq-muted)" }}>Loading…</p>}><MockPayContent /></Suspense>
        </div>
      </div>
    </PageShell>
  );
}
