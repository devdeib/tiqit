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

  const [event, ticketTypes] = await Promise.all([
    getOrganizerEvent(ctx, id),
    listOrganizerTicketTypes(ctx, id),
  ]);

  return (
    <main className="py-8">
      <Link href={`/organizer/events/${id}`} className="text-sm text-neutral-600 underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Ticket types</h1>
      <p className="mt-1 text-neutral-600">{event.title}</p>
      <EventStatusBadge status={event.status} />
      <TicketTypeManager
        eventId={id}
        initialTypes={ticketTypes}
        editable={isEventEditable(event.status)}
      />
    </main>
  );
}
