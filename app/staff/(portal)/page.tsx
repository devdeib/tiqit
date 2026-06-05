import Link from "next/link";
import { getStaffContext } from "@/lib/staff-auth";
import { listStaffAssignedEvents } from "@/services/staff/events.service";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await getStaffContext();
  if (!staff) return null;

  const events = await listStaffAssignedEvents(staff);

  return (
    <main>
      <h1 className="text-xl font-bold">Your events</h1>
      <p className="mt-1 text-sm text-neutral-600">Select an event to scan tickets.</p>

      {events.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">
          No assignments yet. Ask an organizer to assign you to an event.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/staff/events/${e.id}/scan`}
                className="block rounded-lg border bg-white p-4 shadow-sm active:bg-neutral-50"
              >
                <p className="font-medium">{e.title}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {e.venue} · {new Date(e.eventDate).toLocaleString()}
                </p>
                <p className="mt-2 text-xs uppercase text-neutral-500">{e.status}</p>
              </Link>
              <Link
                href={`/staff/events/${e.id}/stats`}
                className="mt-1 inline-block text-xs text-emerald-800 underline"
              >
                Stats
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
