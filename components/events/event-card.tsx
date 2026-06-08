import Link from "next/link";
import type { PublicEventSummary } from "@/types/api";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active:     { bg: "rgba(139,47,232,0.18)", color: "var(--tq-purple-lt)", label: "On sale" },
  sold_out:   { bg: "rgba(247,37,133,0.18)", color: "var(--tq-pink)",      label: "Sold out" },
  completed:  { bg: "rgba(90,79,122,0.3)",   color: "var(--tq-muted)",     label: "Completed" },
  cancelled:  { bg: "rgba(90,79,122,0.3)",   color: "var(--tq-muted)",     label: "Cancelled" },
};

export function EventCard({ event }: { event: PublicEventSummary }) {
  const s = STATUS_STYLES[event.status] ?? STATUS_STYLES.completed;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block tq-panel tq-fade-up transition-all duration-200"
      style={{ textDecoration: "none" }}
    >
      {/* Pink top edge on hover */}
      <div
        className="tq-accent-top rounded-t-xl overflow-hidden"
        style={{
          borderTopColor: "var(--tq-pink)",
          borderTopWidth: "2px",
          borderTopStyle: "solid",
        }}
      />
      <div className="p-5">
        {/* Status badge */}
        <span
          className="tq-badge mb-3"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>

        <h2
          className="text-lg leading-tight"
          style={{ fontWeight: 900, letterSpacing: "-0.03em", color: "var(--tq-white)" }}
        >
          {event.title}
        </h2>

        <p className="mt-2 text-sm" style={{ color: "var(--tq-muted)" }}>
          {event.venue}
        </p>

        <p className="mt-3 text-xs" style={{ color: "var(--tq-sub)", letterSpacing: "0.04em" }}>
          {new Date(event.eventDate).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric",
          })}
        </p>

        <div
          className="mt-4 flex items-center justify-between border-t pt-4"
          style={{ borderColor: "var(--tq-rule)" }}
        >
          <span className="tq-label">View tickets</span>
          <span style={{ color: "var(--tq-purple)", fontSize: "18px" }}>→</span>
        </div>
      </div>
    </Link>
  );
}
