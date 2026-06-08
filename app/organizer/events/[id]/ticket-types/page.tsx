import Link from "next/link";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";
import { TicketTypeManager } from "@/components/organizer/ticket-type-manager";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent, isEventEditable } from "@/services/organizer/events.service";
import { listOrganizerTicketTypes } from "@/services/organizer/ticket-types.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function OrganizerTicketTypesPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;
  const [event, ticketTypes] = await Promise.all([getOrganizerEvent(ctx, id), listOrganizerTicketTypes(ctx, id)]);
  const editable = isEventEditable(event.status);

  return (
    <main style={{ paddingTop:"40px" }}>
      <Link href={`/organizer/events/${id}`} style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", display:"inline-block", marginBottom:"20px" }}>← {event.title}</Link>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"28px" }}>
        <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em" }}>Ticket types</h1>
        <EventStatusBadge status={event.status} />
      </div>
      {!editable && <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", borderRadius:"8px", padding:"12px 16px", marginBottom:"20px", fontSize:"13px", color:"var(--tq-gold)" }}>Event is not editable in current status.</div>}
      <TicketTypeManager eventId={id} initialTypes={ticketTypes} editable={editable} />
    </main>
  );
}
