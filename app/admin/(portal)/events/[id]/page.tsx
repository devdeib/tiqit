import Link from "next/link";
import { EventApprovalActions } from "@/components/admin/event-approval-actions";
import { getAdminContext } from "@/lib/admin-auth";
import { getAdminEventDetail } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminEventDetailPage({ params }: Props) {
  const admin = await getAdminContext();
  if (!admin) return null;

  const { id } = await params;
  const event = await getAdminEventDetail(admin, id);

  return (
    <main className="py-8">
      <Link href="/admin/events/pending" className="text-sm text-neutral-600 underline">
        ← Pending events
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Status: <span className="font-medium">{event.status}</span> · Organizer:{" "}
        {event.organizerName} ({event.organizerEmail})
      </p>

      <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Venue</dt>
          <dd>{event.venue}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Event date</dt>
          <dd>{new Date(event.eventDate).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Sale ends</dt>
          <dd>{new Date(event.saleEndsAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Ticket types</dt>
          <dd>{event.ticketTypeCount}</dd>
        </div>
      </dl>

      {event.description && (
        <p className="mt-4 text-sm text-neutral-700 whitespace-pre-wrap">{event.description}</p>
      )}

      {event.status === "pending_approval" && <EventApprovalActions eventId={event.id} />}
    </main>
  );
}
