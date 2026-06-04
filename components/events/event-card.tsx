import Link from "next/link";
import type { PublicEventSummary } from "@/types/api";

export function EventCard({ event }: { event: PublicEventSummary }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
    >
      <h2 className="text-lg font-semibold">{event.title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{event.venue}</p>
      <p className="mt-2 text-sm text-neutral-500">
        {new Date(event.eventDate).toLocaleString()} · {event.status}
      </p>
    </Link>
  );
}
