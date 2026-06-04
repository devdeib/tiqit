import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { listPendingEvents } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export default async function AdminPendingEventsPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const events = await listPendingEvents(admin);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Pending events</h1>
      {events.length === 0 ? (
        <p className="mt-4 text-neutral-600">No events awaiting approval.</p>
      ) : (
        <ul className="mt-6 divide-y rounded border bg-white">
          {events.map((e) => (
            <li key={e.id} className="p-4">
              <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
                {e.title}
              </Link>
              <p className="mt-1 text-sm text-neutral-600">
                {e.venue} · {new Date(e.eventDate).toLocaleString()} · {e.organizerName} (
                {e.organizerEmail})
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
