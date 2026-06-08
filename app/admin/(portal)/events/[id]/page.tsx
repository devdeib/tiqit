import Link from "next/link";
import { EventApprovalActions } from "@/components/admin/event-approval-actions";
import { getAdminContext } from "@/lib/admin-auth";
import { getAdminEventDetail } from "@/services/admin/events.service";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function AdminEventDetailPage({ params }: Props) {
  const admin = await getAdminContext();
  if (!admin) return null;
  const { id } = await params;
  const event = await getAdminEventDetail(admin, id);

  return (
    <main style={{ paddingTop:"40px" }}>
      <Link href="/admin/events/pending" style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", marginBottom:"24px", display:"inline-block" }}>← Pending events</Link>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"16px", marginBottom:"28px" }}>
        <div>
          <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>{event.title}</h1>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <EventStatusBadge status={event.status} />
            <span style={{ fontSize:"13px", color:"var(--tq-muted)" }}>{event.organizerName} · {event.organizerEmail}</span>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"12px", marginBottom:"28px" }}>
        {[
          { label:"Venue", value:event.venue },
          { label:"Event date", value:new Date(event.eventDate).toLocaleString() },
          { label:"Sale ends", value:new Date(event.saleEndsAt).toLocaleString() },
        ].map((f) => (
          <div key={f.label} style={{ background:"var(--tq-surface)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"16px" }}>
            <p style={{ fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>{f.label}</p>
            <p style={{ fontSize:"14px", color:"var(--tq-off)" }}>{f.value}</p>
          </div>
        ))}
      </div>

      <EventApprovalActions eventId={event.id} />
    </main>
  );
}
