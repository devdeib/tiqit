import type { EventStatus } from "@/types/database";

const STATUS: Record<EventStatus, { label: string; bg: string; color: string }> = {
  draft:            { label: "Draft",            bg: "rgba(90,79,122,0.25)",    color: "var(--tq-muted)" },
  pending_approval: { label: "Pending approval", bg: "rgba(212,168,67,0.15)",   color: "var(--tq-gold)" },
  active:           { label: "Active",           bg: "rgba(139,47,232,0.2)",    color: "var(--tq-purple-lt)" },
  sold_out:         { label: "Sold out",         bg: "rgba(247,37,133,0.15)",   color: "var(--tq-pink)" },
  completed:        { label: "Completed",        bg: "rgba(90,79,122,0.2)",     color: "var(--tq-muted)" },
  cancelled:        { label: "Cancelled",        bg: "rgba(90,79,122,0.15)",    color: "var(--tq-sub)" },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span
      className="tq-badge"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
