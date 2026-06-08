import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { getAdminDashboardStats } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  if (!admin) return null;
  const stats = await getAdminDashboardStats(admin);

  return (
    <main style={{ paddingTop: "40px" }}>
      <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"9999px", fontSize:"10px", fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", background:"rgba(247,37,133,.12)", color:"var(--tq-pink)", marginBottom:"14px" }}>
        Platform operations
      </span>
      <h1 style={{ fontSize:"30px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Admin dashboard</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"36px" }}>Platform-wide operations and approvals.</p>

      {/* Action cards — items needing attention */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"40px" }}>
        <ActionCard label="Events pending approval" value={stats.eventsPendingApproval} href="/admin/events/pending" alert={stats.eventsPendingApproval > 0} cta="Review now →" />
        <ActionCard label="Organizers pending" value={stats.organizersPending} href="/admin/users" alert={stats.organizersPending > 0} cta="Manage users →" />
        <ActionCard label="Stuck payments" value={stats.stuckPayments} href="/admin/webhooks" alert={stats.stuckPayments > 0} cta={stats.stuckPayments > 0 ? "Fix now →" : "All clear"} />
      </div>

      {/* Quick links */}
      <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
        {[
          { href:"/admin/events/pending", label:"Pending events" },
          { href:"/admin/users",          label:"Users" },
          { href:"/admin/webhooks",       label:"Webhooks" },
          { href:"/admin/settings/payments", label:"Payment settings" },
        ].map((l) => (
          <Link key={l.href} href={l.href} style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"9px 18px", fontSize:"13px", fontWeight:600, color:"var(--tq-off)", textDecoration:"none", transition:"border-color .15s" }}>
            {l.label} →
          </Link>
        ))}
      </div>
    </main>
  );
}

function ActionCard({ label, value, href, alert, cta }: { label:string; value:number; href:string; alert:boolean; cta:string }) {
  return (
    <Link href={href} style={{ display:"block", background:"var(--tq-panel)", border:`1px solid var(--tq-rule)`, borderTop:`2px solid ${alert ? "var(--tq-pink)" : "var(--tq-rule)"}`, borderRadius:"10px", padding:"20px", textDecoration:"none", transition:"border-color .15s" }}>
      <p style={{ fontSize:"9px", letterSpacing:".14em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"10px", fontWeight:500 }}>{label}</p>
      <p style={{ fontSize:"40px", fontWeight:900, letterSpacing:"-0.04em", color: alert ? "var(--tq-pink)" : "var(--tq-off)", lineHeight:1, marginBottom:"12px" }}>{value}</p>
      <p style={{ fontSize:"11px", fontWeight:600, color: alert ? "var(--tq-purple-lt)" : "var(--tq-muted)" }}>{cta}</p>
    </Link>
  );
}
