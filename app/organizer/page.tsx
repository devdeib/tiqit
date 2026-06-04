import Link from "next/link";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerDashboard } from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const stats = await getOrganizerDashboard(ctx);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-neutral-600">Overview of your events and approval pipeline.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total events" value={stats.eventsTotal} />
        <StatCard label="Draft" value={stats.eventsDraft} />
        <StatCard label="Pending approval" value={stats.eventsPendingApproval} />
        <StatCard label="Active" value={stats.eventsActive} />
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/organizer/events/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          New event
        </Link>
        <Link
          href="/organizer/events"
          className="rounded border px-4 py-2 text-sm"
        >
          View all events
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
