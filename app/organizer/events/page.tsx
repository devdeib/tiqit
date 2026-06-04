import Link from "next/link";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { listOrganizerEvents } from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const events = await listOrganizerEvents(ctx);

  return (
    <main className="py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link
          href="/organizer/events/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          New event
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {events.length === 0 && (
          <p className="text-neutral-600">No events yet. Create a draft to get started.</p>
        )}
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/organizer/events/${event.id}`}
            className="block rounded border p-4 hover:bg-neutral-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-neutral-600">
                  {event.venue} · {new Date(event.eventDate).toLocaleString()}
                </p>
              </div>
              <EventStatusBadge status={event.status} />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
