import { WebhookReplayList } from "@/components/admin/webhook-replay-list";
import { getAdminContext } from "@/lib/admin-auth";
import { listRecentAuditLogs, listStuckPayments } from "@/services/admin/webhooks.service";

export const dynamic = "force-dynamic";

export default async function AdminWebhooksPage() {
  const admin = await getAdminContext();
  if (!admin) return null;
  const [stuckPayments, audit] = await Promise.all([listStuckPayments(admin), listRecentAuditLogs(admin, 30)]);

  return (
    <main style={{ paddingTop:"40px" }}>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Webhooks & payments</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"32px" }}>Stuck payments and replay via fulfillment idempotency.</p>

      <section style={{ marginBottom:"40px" }}>
        <h2 style={{ fontSize:"16px", fontWeight:700, letterSpacing:"-0.02em", color:"var(--tq-off)", marginBottom:"16px" }}>Stuck / failed fulfillment</h2>
        <WebhookReplayList stuckPayments={stuckPayments} />
      </section>

      <section>
        <h2 style={{ fontSize:"16px", fontWeight:700, letterSpacing:"-0.02em", color:"var(--tq-off)", marginBottom:"16px" }}>Recent audit log</h2>
        {audit.length === 0 ? (
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>No actions yet.</p>
        ) : (
          <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  {["Action","Entity","ID","Admin","Time"].map((h) => (
                    <th key={h} style={{ textAlign:"left", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", padding:"10px 16px", borderBottom:"1px solid var(--tq-rule)", fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((log) => (
                  <tr key={log.id} style={{ borderBottom:"1px solid var(--tq-rule)" }}>
                    <td style={{ padding:"12px 16px", fontSize:"13px", fontWeight:600, color:"var(--tq-purple-lt)" }}>{log.action}</td>
                    <td style={{ padding:"12px 16px", fontSize:"13px", color:"var(--tq-off)" }}>{log.entityType}</td>
                    <td style={{ padding:"12px 16px", fontSize:"11px", fontFamily:"var(--font-geist-mono)", color:"var(--tq-muted)" }}>{log.entityId ? `${log.entityId.slice(0,8)}…` : "—"}</td>
                    <td style={{ padding:"12px 16px", fontSize:"12px", color:"var(--tq-muted)" }}>{log.adminName}</td>
                    <td style={{ padding:"12px 16px", fontSize:"11px", color:"var(--tq-sub)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
