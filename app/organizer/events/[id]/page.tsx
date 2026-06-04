import Link from "next/link";
import { EventForm } from "@/components/organizer/event-form";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";
import { SubmitForApproval } from "@/components/organizer/submit-for-approval";
import { getOrganizerContext } from "@/lib/organizer-auth";
import {
  getOrganizerEvent,
  isEventEditable,
} from "@/services/organizer/events.service";
import { getOrganizerEventAnalytics } from "@/services/organizer/analytics.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function OrganizerEventDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const [event, analytics] = await Promise.all([
    getOrganizerEvent(ctx, id),
    getOrganizerEventAnalytics(ctx, id).catch(() => null),
  ]);

  const editable = isEventEditable(event.status);

  return (
    <main className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="mt-2">
            <EventStatusBadge status={event.status} />
          </div>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href={`/organizer/events/${id}/ticket-types`} className="underline">
            Ticket types
          </Link>
          <Link href={`/organizer/events/${id}/orders`} className="underline">
            Orders
          </Link>
          <Link href={`/organizer/events/${id}/staff`} className="underline">
            Staff
          </Link>
        </nav>
      </div>

      {analytics && (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <MiniStat label="Confirmed orders" value={analytics.ordersConfirmed} />
          <MiniStat label="Revenue (SYP)" value={analytics.revenueConfirmed} />
          <MiniStat label="Tickets sold" value={analytics.ticketsSold} />
          <MiniStat label="Remaining" value={analytics.ticketsRemaining} />
        </div>
      )}

      {!editable && (
        <p className="mt-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This event is read-only. Only draft and pending-approval events can be edited.
          Activation requires admin approval.
        </p>
      )}

      {event.status === "draft" && (
        <div className="mt-4">
          <SubmitForApproval eventId={id} />
        </div>
      )}

      <EventForm mode="edit" eventId={id} initial={event} editable={editable} />
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-3 text-sm">
      <p className="text-neutral-600">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
