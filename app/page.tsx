import { listPublicEvents } from "@/services/events.service";
import { EventCard } from "@/components/events/event-card";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await listPublicEvents();

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Page header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1
              className="text-3xl"
              style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
            >
              Events
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--tq-muted)" }}>
              GCC's live events — on sale now.
            </p>
          </div>
          <span className="tq-label">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>

        {/* Events grid */}
        {events.length === 0 ? (
          <div
            className="tq-panel py-24 text-center"
          >
            <p className="text-lg font-bold" style={{ color: "var(--tq-off)" }}>
              No events live yet.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--tq-muted)" }}>
              Check back soon — nights are being planned.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
