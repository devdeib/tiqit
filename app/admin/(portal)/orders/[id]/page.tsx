import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { inspectAdminOrder } from "@/services/admin/orders.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const admin = await getAdminContext();
  if (!admin) return null;

  const { id } = await params;
  const data = await inspectAdminOrder(admin, id);

  return (
    <main className="py-8">
      <Link href="/admin/webhooks" className="text-sm text-neutral-600 underline">
        ← Webhooks
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Order {data.order.id.slice(0, 8)}…</h1>
      <p className="mt-1 text-sm">
        Status: <strong>{data.order.status}</strong> · {data.order.totalAmount} SYP · Tickets
        issued: {data.order.ticketsIssued ? "Yes" : "No"}
      </p>

      {data.guest && (
        <section className="mt-6 rounded border bg-white p-4">
          <h2 className="font-semibold">Guest</h2>
          <p className="text-sm">
            {data.guest.fullName} · {data.guest.phone}
            {data.guest.email ? ` · ${data.guest.email}` : ""}
          </p>
        </section>
      )}

      {data.reservation && (
        <section className="mt-4 rounded border bg-white p-4">
          <h2 className="font-semibold">Reservation</h2>
          <p className="text-sm">
            {data.reservation.status} · expires {new Date(data.reservation.expiresAt).toLocaleString()}{" "}
            · held: {data.reservation.inventoryHeld ? "yes" : "no"}
          </p>
          <ul className="mt-2 text-sm text-neutral-600">
            {data.reservation.items.map((i) => (
              <li key={i.ticketTypeId}>
                Type {i.ticketTypeId.slice(0, 8)}… × {i.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="font-semibold">Payments</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-neutral-600">None</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {data.payments.map((p) => (
              <li key={p.id}>
                {p.status} · {p.providerPaymentId} · webhook{" "}
                {p.webhookVerified ? "verified" : "not verified"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="font-semibold">Webhook events</h2>
        {data.webhookEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">None recorded</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm font-mono">
            {data.webhookEvents.map((w) => (
              <li key={w.providerEventId}>
                {w.providerEventId} @ {new Date(w.processedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded border bg-white p-4">
        <h2 className="font-semibold">Tickets ({data.tickets.length})</h2>
        <ul className="mt-2 text-sm">
          {data.tickets.map((t) => (
            <li key={t.id}>
              {t.holderName} · {t.status}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
