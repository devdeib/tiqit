import { notFound } from "next/navigation";
import { getPublicEvent } from "@/services/events.service";
import { PurchaseForm } from "@/components/checkout/purchase-form";
import { PageShell } from "@/components/ui/page-shell";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  try {
    const event = await getPublicEvent(id);

    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-6 py-16">
          {/* Back */}
          <a
            href="/"
            className="tq-label mb-8 inline-flex items-center gap-2 transition-colors hover:text-white"
            style={{ color: "var(--tq-muted)", textDecoration: "none" }}
          >
            ← All events
          </a>

          {/* Event header */}
          <div
            className="tq-panel tq-fade-up mb-6 overflow-hidden"
            style={{ borderTop: "3px solid var(--tq-pink)" }}
          >
            <div className="p-6">
              <h1
                className="text-3xl leading-tight"
                style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
              >
                {event.title}
              </h1>

              <div className="mt-4 space-y-1">
                <p className="text-sm" style={{ color: "var(--tq-off)" }}>
                  {event.venue}
                </p>
                <p className="tq-label">
                  {new Date(event.eventDate).toLocaleString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                    year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>

              {event.description && (
                <p
                  className="mt-5 text-sm leading-relaxed"
                  style={{ color: "var(--tq-muted)", borderTop: "1px solid var(--tq-rule)", paddingTop: "16px" }}
                >
                  {event.description}
                </p>
              )}
            </div>
          </div>

          {/* Purchase form */}
          <PurchaseForm event={event} />
        </div>
      </PageShell>
    );
  } catch (err) {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  }
}
