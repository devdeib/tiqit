"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { staffFetch } from "@/lib/api/staff-client";
import { QrScanner } from "@/components/staff/qr-scanner";
import type { StaffScanResult } from "@/types/staff";

const OUTCOME: Record<string, { label:string; border:string; bg:string; color:string }> = {
  valid:          { label:"✓ Valid — entry granted",  border:"rgba(139,47,232,.5)",  bg:"rgba(139,47,232,.1)",  color:"var(--tq-purple-lt)" },
  already_used:   { label:"⚠ Already scanned",        border:"rgba(212,168,67,.4)",  bg:"rgba(212,168,67,.08)", color:"var(--tq-gold)" },
  wrong_event:    { label:"✕ Wrong event",             border:"rgba(247,37,133,.4)",  bg:"rgba(247,37,133,.08)", color:"var(--tq-pink)" },
  invalid:        { label:"✕ Invalid ticket",          border:"rgba(247,37,133,.4)",  bg:"rgba(247,37,133,.08)", color:"var(--tq-pink)" },
  voided:         { label:"✕ Ticket voided",           border:"rgba(247,37,133,.4)",  bg:"rgba(247,37,133,.08)", color:"var(--tq-pink)" },
  not_authorized: { label:"✕ Not authorized",          border:"rgba(247,37,133,.4)",  bg:"rgba(247,37,133,.08)", color:"var(--tq-pink)" },
};

export function ScanConsole({ eventId, eventTitle }: { eventId:string; eventTitle:string }) {
  const [manualToken, setManualToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<StaffScanResult|null>(null);
  const [error, setError] = useState<string|null>(null);

  const submitScan = useCallback(async (qrToken: string) => {
    if (!qrToken.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await staffFetch<{ result:StaffScanResult }>("/api/staff/scan", { method:"POST", body:JSON.stringify({ eventId, qrToken:qrToken.trim() }) });
      setLastResult(res.result);
    } catch (e) { setError(e instanceof Error ? e.message : "Scan failed"); }
    finally { setLoading(false); }
  }, [eventId, loading]);

  const outcome = lastResult ? (OUTCOME[lastResult.outcome] ?? OUTCOME.invalid) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      <div>
        <Link href="/staff" style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", display:"inline-block", marginBottom:"12px" }}>← Events</Link>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h1 style={{ fontSize:"22px", fontWeight:900, letterSpacing:"-0.04em" }}>{eventTitle}</h1>
          <Link href={`/staff/events/${eventId}/stats`} style={{ fontSize:"11px", color:"var(--tq-purple-lt)", textDecoration:"none", fontWeight:600 }}>Stats →</Link>
        </div>
      </div>

      {/* QR scanner */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--tq-rule)", display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:"var(--tq-purple)", display:"inline-block" }} />
          <span style={{ fontSize:"11px", fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", color:"var(--tq-purple-lt)" }}>Camera scan</span>
        </div>
        <div style={{ padding:"16px" }}>
          <QrScanner onScan={(token) => void submitScan(token)} />
        </div>
      </div>

      {/* Manual entry */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", padding:"16px" }}>
        <p style={{ fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"10px", fontWeight:500 }}>Manual token entry</p>
        <div style={{ display:"flex", gap:"8px" }}>
          <input value={manualToken} onChange={(e) => setManualToken(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { void submitScan(manualToken); setManualToken(""); } }} placeholder="Paste QR token…" className="tq-input" style={{ flex:1 }} />
          <button onClick={() => { void submitScan(manualToken); setManualToken(""); }} disabled={loading || !manualToken.trim()} className="tq-btn-primary" style={{ padding:"10px 18px", whiteSpace:"nowrap" }}>{loading ? "…" : "Verify"}</button>
        </div>
      </div>

      {/* Scan result */}
      {outcome && lastResult && (
        <div style={{ background:outcome.bg, border:`1px solid ${outcome.border}`, borderRadius:"12px", padding:"20px" }}>
          <p style={{ fontSize:"18px", fontWeight:900, letterSpacing:"-0.03em", color:outcome.color, marginBottom:"14px" }}>{outcome.label}</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            {[
              { label:"Holder", value:lastResult.ticket?.holderName },
              { label:"Ticket type", value:lastResult.ticket?.ticketTypeName },
              { label:"Ticket ID", value:lastResult.ticket?.id?.slice(0,8)+"…" },
            ].filter(f => f.value).map((f) => (
              <div key={f.label}>
                <p style={{ fontSize:"9px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"3px", fontWeight:500 }}>{f.label}</p>
                <p style={{ fontSize:"13px", fontWeight:600, color:outcome.color }}>{f.value}</p>
              </div>
            ))}
          </div>
          {lastResult.message && <p style={{ fontSize:"12px", color:"var(--tq-muted)", marginTop:"12px" }}>{lastResult.message}</p>}
        </div>
      )}

      {error && (
        <div style={{ background:"rgba(247,37,133,.1)", border:"1px solid rgba(247,37,133,.2)", borderRadius:"8px", padding:"14px", fontSize:"13px", color:"var(--tq-pink)" }}>{error}</div>
      )}
    </div>
  );
}
