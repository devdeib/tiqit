"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManualPaymentForm } from "@/components/checkout/manual-payment-form";
import { PageShell } from "@/components/ui/page-shell";
import { apiGet } from "@/lib/api/client";
import { normalizeToE164Phone } from "@/lib/phone";
import type { CheckoutStatusResponse, ManualPaymentCheckoutContext } from "@/types/api";

function ManualPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [context, setContext] = useState<ManualPaymentCheckoutContext|null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  const getPhone = useCallback(():string|null => { const raw = sessionStorage.getItem("guestPhone"); if (!raw) return null; return normalizeToE164Phone(raw); }, []);

  const loadContext = useCallback(async () => {
    if (!orderId) return;
    const phone = getPhone();
    if (!phone) { setError("Missing guest phone — reserve tickets again from the event page."); setLoading(false); return; }
    const q = `?phone=${encodeURIComponent(phone)}`;
    try {
      const [{ context:ctx }, { status:s }] = await Promise.all([
        apiGet<{ context:ManualPaymentCheckoutContext }>(`/api/checkout/${orderId}/payment-context${q}`),
        apiGet<{ status:CheckoutStatusResponse }>(`/api/checkout/${orderId}/status${q}`),
      ]);
      setContext(ctx); setStatus(s); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load payment details"); }
    finally { setLoading(false); }
  }, [orderId, getPhone]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => {
    if (!orderId) return;
    if (status?.paymentStatus === "completed" || status?.orderStatus === "confirmed") {
      const phone = getPhone(); const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
      router.replace(`/orders/${orderId}/confirmation${q}`);
    }
  }, [status, orderId, router, getPhone]);

  if (!orderId) return <div style={{ background:"rgba(247,37,133,.1)", border:"1px solid rgba(247,37,133,.2)", borderRadius:"8px", padding:"14px 16px", fontSize:"13px", color:"var(--tq-pink)" }}>Missing order ID. Return to checkout and try again.</div>;
  if (loading) return <div style={{ display:"flex", alignItems:"center", gap:"10px", color:"var(--tq-muted)", fontSize:"13px" }}><span style={{ width:"8px", height:"8px", borderRadius:"50%", background:"var(--tq-purple)", display:"inline-block", animation:"tq-pulse-dot 1.8s ease-in-out infinite" }} />Loading payment details…</div>;
  if (error && !context) return <div style={{ background:"rgba(247,37,133,.1)", border:"1px solid rgba(247,37,133,.2)", borderRadius:"8px", padding:"14px 16px", fontSize:"13px", color:"var(--tq-pink)" }}>{error}</div>;
  if (!context) return <div style={{ fontSize:"13px", color:"var(--tq-pink)" }}>Unable to load payment details.</div>;

  const phone = getPhone();
  const { shamCash } = context;
  const alreadyPaid = status?.paymentStatus === "completed" || context.orderStatus === "confirmed";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
      {/* Reference + amount */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderLeft:"3px solid var(--tq-purple)", borderRadius:"10px", padding:"20px" }}>
        <p style={{ fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"8px", fontWeight:500 }}>Order reference</p>
        <p style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", color:"var(--tq-white)", fontFamily:"var(--font-geist-mono)", marginBottom:"8px" }}>{context.orderReferenceCode || "—"}</p>
        <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>Total: <strong style={{ color:"var(--tq-off)" }}>{context.totalAmount} {context.currency}</strong></p>
      </div>

      {/* Sham Cash details */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"10px", padding:"20px" }}>
        <h2 style={{ fontSize:"15px", fontWeight:700, letterSpacing:"-0.02em", marginBottom:"14px", color:"var(--tq-white)" }}>Pay with Sham Cash</h2>
        <p style={{ fontSize:"13px", color:"var(--tq-muted)", whiteSpace:"pre-wrap", marginBottom:"14px", lineHeight:1.6 }}>{shamCash.instructions}</p>
        <div style={{ display:"grid", gap:"10px" }}>
          {[{ label:"Account name", value:shamCash.accountName || "—" }, { label:"Account ID", value:shamCash.accountId || "—" }].map((f) => (
            <div key={f.label} style={{ background:"var(--tq-base)", borderRadius:"6px", padding:"12px 14px" }}>
              <p style={{ fontSize:"9px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"4px", fontWeight:500 }}>{f.label}</p>
              <p style={{ fontSize:"14px", fontWeight:600, color:"var(--tq-off)", fontFamily:f.label==="Account ID" ? "var(--font-geist-mono)" : "inherit" }}>{f.value}</p>
            </div>
          ))}
        </div>
        {shamCash.qrImageUrl && <img src={shamCash.qrImageUrl} alt="Sham Cash QR" style={{ maxHeight:"160px", borderRadius:"8px", marginTop:"14px", display:"block" }} />}
      </div>

      {/* Steps */}
      <ol style={{ paddingLeft:"20px", fontSize:"13px", color:"var(--tq-muted)", lineHeight:1.7, display:"flex", flexDirection:"column", gap:"4px" }}>
        <li>Transfer <strong style={{ color:"var(--tq-off)" }}>{context.totalAmount} {context.currency}</strong> to the Sham Cash account above.</li>
        <li>Include reference <strong style={{ color:"var(--tq-off)" }}>{context.orderReferenceCode}</strong> in the payment note.</li>
        <li>Enter your Sham Cash transaction ID below to verify instantly.</li>
      </ol>

      {error && <div style={{ background:"rgba(247,37,133,.1)", border:"1px solid rgba(247,37,133,.2)", borderRadius:"8px", padding:"12px 14px", fontSize:"13px", color:"var(--tq-pink)" }}>{error}</div>}
      {!alreadyPaid && phone && <ManualPaymentForm orderId={orderId} phone={phone} onSubmitted={() => void loadContext()} />}
    </div>
  );
}

export default function LiveCheckoutRedirectPage() {
  return (
    <PageShell>
      <div style={{ maxWidth:"520px", margin:"0 auto", padding:"48px 24px" }}>
        <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Complete payment</h1>
        <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"28px" }}>Pay via Sham Cash to confirm your tickets.</p>
        <Suspense fallback={<div style={{ display:"flex", alignItems:"center", gap:"10px", color:"var(--tq-muted)", fontSize:"13px" }}>Loading…</div>}>
          <ManualPaymentContent />
        </Suspense>
      </div>
    </PageShell>
  );
}
