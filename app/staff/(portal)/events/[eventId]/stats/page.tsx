import Link from "next/link";
import { getStaffContext } from "@/lib/staff-auth";
import { getStaffEventStats } from "@/services/staff/scan.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ eventId: string }> };

export default async function StaffStatsPage({ params }: Props) {
  const staff = await getStaffContext();
  if (!staff) return null;

  const { eventId } = await params;
  const stats = await getStaffEventStats(staff, eventId);

  const { data: event } = await staff.supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  return (
    <main>
      <Link href={`/staff/events/${eventId}/scan`} className="text-sm text-neutral-600 underline">
        ← Scanner
      </Link>
      <h1 className="mt-2 text-xl font-bold">{event?.title ?? "Event"} stats</h1>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <StatCard label="Total" value={stats.totalTickets} />
        <StatCard label="Scanned" value={stats.scanned} />
        <StatCard label="Remaining" value={stats.remaining} />
      </div>

      <Link
        href={`/staff/events/${eventId}/scan`}
        className="mt-8 block rounded-lg bg-emerald-800 py-3 text-center text-sm font-medium text-white"
      >
        Open scanner
      </Link>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
