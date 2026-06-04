import Link from "next/link";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import { listOrganizerEventOrders } from "@/services/organizer/orders.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function OrganizerOrdersPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;

  const [event, orders] = await Promise.all([
    getOrganizerEvent(ctx, id),
    listOrganizerEventOrders(ctx, id),
  ]);

  return (
    <main className="py-8">
      <Link href={`/organizer/events/${id}`} className="text-sm text-neutral-600 underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Orders</h1>
      <p className="mt-1 text-neutral-600">{event.title} · read-only</p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Order</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Tickets</th>
              <th className="py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-neutral-600">
                  No orders yet.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                <td className="py-2 pr-4">{o.status}</td>
                <td className="py-2 pr-4">{o.totalAmount} SYP</td>
                <td className="py-2 pr-4">{o.ticketCount}</td>
                <td className="py-2">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
