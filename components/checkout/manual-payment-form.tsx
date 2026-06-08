"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPostForm } from "@/lib/api/client";
import type { ManualPaymentSubmitResponse } from "@/types/api";

export function ManualPaymentForm({ orderId, phone, onSubmitted }: { orderId:string; phone:string; onSubmitted:(r:ManualPaymentSubmitResponse)=>void }) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState("");
  const [proof, setProof] = useState<File|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      const form = new FormData();
      form.set("phone", phone); form.set("transactionId", transactionId.trim());
      if (proof) form.set("proof", proof);
      const { result } = await apiPostForm<{ result:ManualPaymentSubmitResponse }>(`/api/checkout/${orderId}/submit-payment`, form);
      if (result.verified) { router.push(`/orders/${orderId}/confirmation?phone=${encodeURIComponent(phone)}`); return; }
      setError(result.verificationMessage ?? "Payment could not be verified.");
      onSubmitted(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Submission failed"); }
    finally { setSubmitting(false); }
  }

  const inp = { width:"100%", background:"var(--tq-base)", border:"1px solid var(--tq-rule)", borderRadius:"8px", color:"var(--tq-white)", fontSize:"13px", padding:"10px 14px", outline:"none", fontFamily:"inherit" };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display:"flex", flexDirection:"column", gap:"14px", background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderTop:"2px solid var(--tq-purple)", borderRadius:"12px", padding:"24px" }}>
      <h2 style={{ fontSize:"15px", fontWeight:700, letterSpacing:"-0.02em", color:"var(--tq-white)", marginBottom:"4px" }}>Submit transaction ID</h2>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>Enter your Sham Cash transaction ID. We verify it automatically — no manual approval needed.</p>
      <div><label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Transaction ID</label><input required type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Sham Cash transaction reference" style={inp} /></div>
      <div><label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Payment screenshot <span style={{ color:"var(--tq-sub)" }}>(optional)</span></label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setProof(e.target.files?.[0] ?? null)} style={{ fontSize:"12px", color:"var(--tq-off)" }} /></div>
      {error && <div style={{ background:"rgba(247,37,133,.1)", border:"1px solid rgba(247,37,133,.2)", borderRadius:"8px", padding:"12px 14px", fontSize:"13px", color:"var(--tq-pink)" }}>{error}</div>}
      <button type="submit" disabled={submitting} className="tq-btn-primary">{submitting ? "Verifying payment…" : "Verify payment →"}</button>
    </form>
  );
}
