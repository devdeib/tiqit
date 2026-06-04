import { listPublicEvents } from "@/services/events.service";
import { EventCard } from "@/components/events/event-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await listPublicEvents();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Events</h1>
      <div className="mt-6 space-y-4">
        {events.length === 0 ? (
          <div className="space-y-2 text-neutral-600">
            <p>No events available yet.</p>
            <p className="text-sm">
              The homepage only lists events with status{" "}
              <span className="font-medium text-neutral-400">active</span> (or
              sold out / completed / cancelled). Organizers submit events for
              admin approval; run{" "}
              <code className="rounded bg-neutral-800 px-1 text-neutral-300">
                supabase/seed-dev.sql
              </code>{" "}
              in the Supabase SQL Editor, then refresh.
            </p>
          </div>
        ) : (
          events.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </main>
  );
}
