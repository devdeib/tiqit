"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, adminFetchForm } from "@/lib/api/admin-client";
import type { AdminPaymentSettings } from "@/types/admin";

type LinkedAccount = { id:string; label:string|null; status:string|null };
type ShamCashConnectionStatus = { hasApiKey:boolean; linkedAccounts:LinkedAccount[]; configuredApiAccountId:string|null; resolvedAccountId:string|null; message:string|null };

export function PaymentSettingsForm({ initial }: { initial: AdminPaymentSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [accountId, setAccountId] = useState(initial.shamCashAccountId);
  const [apiAccountId, setApiAccountId] = useState(initial.shamCashApiAccountId);
  const [accountName, setAccountName] = useState(initial.shamCashAccountName);
  const [instructions, setInstructions] = useState(initial.paymentInstructions);
  const [qrFile, setQrFile] = useState<File|null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connection, setConnection] = useState<ShamCashConnectionStatus|null>(null);
  const [message, setMessage] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await adminFetch<{ status: ShamCashConnectionStatus }>("/api/admin/settings/payments/sham-cash-accounts");
        if (cancelled) return;
        setConnection(res.status);
        if (!initial.shamCashApiAccountId && res.status.configuredApiAccountId) setApiAccountId(res.status.configuredApiAccountId);
        else if (!initial.shamCashApiAccountId && res.status.linkedAccounts.length === 1) setApiAccountId(res.status.linkedAccounts[0].id);
      } catch (err) {
        if (!cancelled) setConnection({ hasApiKey:false, linkedAccounts:[], configuredApiAccountId:null, resolvedAccountId:null, message:err instanceof Error ? err.message : "Could not load Sham Cash accounts" });
      } finally { if (!cancelled) setLoadingAccounts(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [initial.shamCashApiAccountId]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try {
      await adminFetch("/api/admin/settings/payments", { method:"PUT", body:JSON.stringify({ shamCashAccountId:accountId, shamCashApiAccountId:apiAccountId, shamCashAccountName:accountName, paymentInstructions:instructions }) });
      setSettings((s) => ({ ...s, shamCashAccountId:accountId, shamCashApiAccountId:apiAccountId, shamCashAccountName:accountName, paymentInstructions:instructions }));
      setMessage("Settings saved.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function uploadQr() {
    if (!qrFile) return;
    setUploadingQr(true); setMessage(null); setError(null);
    try {
      const form = new FormData(); form.set("qrImage", qrFile);
      const res = await adminFetchForm<{ qrImageUrl:string }>("/api/admin/settings/payments/qr-upload", form);
      setSettings((s) => ({ ...s, shamCashQrImageUrl:res.qrImageUrl }));
      setQrFile(null); setMessage("QR image uploaded.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploadingQr(false); }
  }

  const inp = { width:"100%", background:"var(--tq-base)", border:"1px solid var(--tq-rule)", borderRadius:"8px", color:"var(--tq-white)", fontSize:"13px", padding:"10px 14px", outline:"none", fontFamily:"inherit" };

  return (
    <form onSubmit={(e) => void saveSettings(e)} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderTop:"2px solid var(--tq-purple)", borderRadius:"12px", padding:"24px", display:"flex", flexDirection:"column", gap:"16px" }}>

        {connection && !connection.hasApiKey && (
          <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", borderRadius:"8px", padding:"12px 14px", fontSize:"13px", color:"var(--tq-gold)" }}>Sham Cash API key not configured — set SHAM_CASH_API_KEY in environment.</div>
        )}
        {connection?.message && (
          <div style={{ background:"rgba(90,79,122,.2)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"12px 14px", fontSize:"13px", color:"var(--tq-muted)" }}>{connection.message}</div>
        )}

        <div><label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Sham Cash account ID</label><input value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} style={inp} /></div>

        <div>
          <label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>API account</label>
          {loadingAccounts ? <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>Loading accounts…</p> : connection?.linkedAccounts.length ? (
            <select value={apiAccountId ?? ""} onChange={(e) => setApiAccountId(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
              <option value="">— select account —</option>
              {connection.linkedAccounts.map((a) => <option key={a.id} value={a.id}>{a.label ?? a.id} {a.status ? `(${a.status})` : ""}</option>)}
            </select>
          ) : <input value={apiAccountId ?? ""} onChange={(e) => setApiAccountId(e.target.value)} placeholder="API account ID" style={inp} />}
        </div>

        <div><label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Account name (shown to customers)</label><input value={accountName ?? ""} onChange={(e) => setAccountName(e.target.value)} style={inp} /></div>
        <div><label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>Payment instructions</label><textarea value={instructions ?? ""} onChange={(e) => setInstructions(e.target.value)} rows={3} style={{ ...inp, resize:"vertical" as const }} /></div>

        {/* QR upload */}
        <div style={{ background:"var(--tq-base)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"16px" }}>
          <label style={{ display:"block", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"10px", fontWeight:500 }}>QR image</label>
          {settings.shamCashQrImageUrl && <img src={settings.shamCashQrImageUrl} alt="Sham Cash QR" style={{ maxHeight:"120px", borderRadius:"6px", marginBottom:"10px", display:"block" }} />}
          <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setQrFile(e.target.files?.[0] ?? null)} style={{ fontSize:"12px", color:"var(--tq-off)" }} />
            {qrFile && <button type="button" onClick={() => void uploadQr()} disabled={uploadingQr} style={{ background:"var(--tq-surface)", border:"1px solid var(--tq-rule)", borderRadius:"6px", padding:"6px 14px", fontSize:"12px", fontWeight:600, color:"var(--tq-off)", cursor:"pointer", fontFamily:"inherit" }}>{uploadingQr ? "Uploading…" : "Upload QR"}</button>}
          </div>
        </div>

        {message && <p style={{ fontSize:"13px", color:"var(--tq-purple-lt)" }}>{message}</p>}
        {error && <p style={{ fontSize:"13px", color:"var(--tq-pink)" }}>{error}</p>}

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {settings.updatedAt && <span style={{ fontSize:"11px", color:"var(--tq-sub)" }}>Last updated: {new Date(settings.updatedAt).toLocaleString()}</span>}
          <button type="submit" disabled={saving} className="tq-btn-primary">{saving ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </form>
  );
}
