import type { EventStatus } from "@/types/database";

const LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  active: "Active",
  sold_out: "Sold out",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize">
      {LABELS[status] ?? status}
    </span>
  );
}
