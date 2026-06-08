import Link from "next/link";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerDashboard } from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const stats = await getOrganizerDashboard(ctx);

  return (
    <div className="tq-fade-up py-12">
      {/* Header */}
      <div className="mb-10">
        <span
          className="tq-badge mb-3 inline-flex"
          style={{ background: "var(--tq-purple-dim)", color: "var(--tq-purple-lt)" }}
        >
          Organizer portal
        </span>
        <h1 className="text-3xl" style={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--tq-muted)" }}>
          Overview of your events and approval pipeline.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total events"      value={stats.eventsTotal}           accent="purple" />
        <StatCard label="Draft"             value={stats.eventsDraft}            accent="none" />
        <StatCard label="Pending approval"  value={stats.eventsPendingApproval}  accent="pink" />
        <StatCard label="Active"            value={stats.eventsActive}           accent="purple" />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/organizer/events/new" className="tq-btn-primary">
          + New event
        </Link>
        <Link href="/organizer/events" className="tq-btn-ghost">
          View all events
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "purple" | "pink" | "none";
}) {
  const borderColors = {
    purple: "var(--tq-purple)",
    pink:   "var(--tq-pink)",
    none:   "var(--tq-rule)",
  };

  return (
    <div
      className="tq-stat-card"
      style={{ borderTop: `2px solid ${borderColors[accent]}` }}
    >
      <p className="tq-label mb-2">{label}</p>
      <p
        className="text-3xl"
        style={{
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: accent === "none" ? "var(--tq-off)" : accent === "pink" ? "var(--tq-pink)" : "var(--tq-purple-lt)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
