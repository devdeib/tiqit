import Link from "next/link";
import { EventForm } from "@/components/organizer/event-form";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";
import { SubmitForApproval } from "@/components/organizer/submit-for-approval";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent, isEventEditable } from "@/services/organizer/events.service";
import { getOrganizerEventAnalytics } from "@/services/organizer/analytics.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function OrganizerEventDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;
  const [event, analytics] = await Promise.all([getOrganizerEvent(ctx, id), getOrganizerEventAnalytics(ctx, id).catch(() => null)]);
  const editable = isEventEditable(event.status);

  return (
    <main style={{ paddingTop:"40px" }}>
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", justifyContent:"space-between", gap:"16px", marginBottom:"28px" }}>
        <div>
          <Link href="/organizer/events" style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", display:"inline-block", marginBottom:"10px" }}>← Events</Link>
          <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <nav style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {[{ href:`/organizer/events/${id}/ticket-types`, label:"Ticket types" }, { href:`/organizer/events/${id}/orders`, label:"Orders" }, { href:`/organizer/events/${id}/staff`, label:"Staff" }].map((l) => (
            <Link key={l.href} href={l.href} style={{ display:"inline-flex", alignItems:"center", background:"var(--tq-surface)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"8px 16px", fontSize:"12px", fontWeight:600, color:"var(--tq-off)", textDecoration:"none" }}>{l.label}</Link>
          ))}
        </nav>
      </div>

      {analytics && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"28px" }}>
          {[{ label:"Confirmed orders", value:analytics.ordersConfirmed }, { label:"Revenue (SYP)", value:analytics.revenueConfirmed }, { label:"Tickets sold", value:analytics.ticketsSold }, { label:"Remaining", value:analytics.ticketsRemaining }].map((s) => (
            <div key={s.label} style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"8px", padding:"16px" }}>
              <p style={{ fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"6px", fontWeight:500 }}>{s.label}</p>
              <p style={{ fontSize:"26px", fontWeight:900, letterSpacing:"-0.04em", color:"var(--tq-purple-lt)" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {!editable && (
        <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", borderRadius:"8px", padding:"12px 16px", marginBottom:"24px", fontSize:"13px", color:"var(--tq-gold)" }}>
          This event is in <strong>{event.status}</strong> status — fields are read-only.
        </div>
      )}

      {event.status === "draft" && (
        <div style={{ marginBottom:"24px" }}>
          <SubmitForApproval eventId={event.id} />
        </div>
      )}

      <EventForm mode="edit" eventId={event.id} initial={event} editable={editable} />
    </main>
  );
}
