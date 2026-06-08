"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/api/admin-client";

export function EventApprovalActions({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve"|"reject"|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function approve() {
    setLoading("approve"); setError(null);
    try { await adminFetch(`/api/admin/events/${eventId}/approve`, { method:"POST" }); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Approve failed"); }
    finally { setLoading(null); }
  }
  async function reject() {
    setLoading("reject"); setError(null);
    try { await adminFetch(`/api/admin/events/${eventId}/reject`, { method:"POST", body:JSON.stringify({ reason:rejectReason || undefined }) }); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Reject failed"); }
    finally { setLoading(null); }
  }

  return (
    <div style={{ background:"rgba(212,168,67,.06)", border:"1px solid rgba(212,168,67,.2)", borderRadius:"12px", padding:"24px" }}>
      <h2 style={{ fontSize:"15px", fontWeight:700, letterSpacing:"-0.02em", marginBottom:"16px", color:"var(--tq-gold)" }}>Approval actions</h2>
      <div style={{ marginBottom:"14px" }}>
        <label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Rejection reason (optional)</label>
        <textarea placeholder="Explain why this event is being rejected…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} style={{ width:"100%", background:"var(--tq-base)", border:"1px solid var(--tq-rule)", borderRadius:"8px", color:"var(--tq-white)", fontSize:"13px", padding:"10px 14px", outline:"none", fontFamily:"inherit", resize:"vertical" }} />
      </div>
      {error && <p style={{ fontSize:"13px", color:"var(--tq-pink)", marginBottom:"12px" }}>{error}</p>}
      <div style={{ display:"flex", gap:"10px" }}>
        <button type="button" disabled={!!loading} onClick={() => void approve()} className="tq-btn-primary">{loading === "approve" ? "Approving…" : "✓ Approve → Active"}</button>
        <button type="button" disabled={!!loading} onClick={() => void reject()} style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"rgba(247,37,133,.1)", color:"var(--tq-pink)", border:"1px solid rgba(247,37,133,.25)", borderRadius:"8px", padding:"10px 20px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{loading === "reject" ? "Rejecting…" : "✕ Reject"}</button>
      </div>
    </div>
  );
}
