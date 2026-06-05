"use client";

import { use, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { TicketQr } from "@/components/tickets/ticket-qr";
import type { CheckoutStatusResponse, OrderConfirmationResponse } from "@/types/api";

type Props = { params: Promise<{ orderId: string }> };

export default function ConfirmationPage({ params }: Props) {
  const { orderId } = use(params);
  const [phone, setPhone] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [order, setOrder] = useState<OrderConfirmationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhone(sessionStorage.getItem("guestPhone"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const guestPhone = phone ?? sessionStorage.getItem("guestPhone");
        if (!guestPhone) {
          setError("Missing guest phone — use the same browser session as checkout");
          return;
        }
        const statusQuery = `?phone=${encodeURIComponent(guestPhone)}`;
        const { status: s } = await apiGet<{ status: CheckoutStatusResponse }>(
          `/api/checkout/${orderId}/status${statusQuery}`,
        );
        if (cancelled) return;
        setStatus(s);

        if (s.paymentStatus === "failed") {
          setError("Payment failed. Return to checkout and try paying again.");
          return;
        }

        if (s.ticketsIssued && guestPhone) {
          const { order: o } = await apiPost<{ order: OrderConfirmationResponse }>(
            "/api/orders/lookup",
            { orderId, phone: guestPhone },
          );
          if (!cancelled) setOrder(o);
          return;
        }

        if (!s.ticketsIssued && s.paymentStatus === "pending") {
          window.setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load order");
        }
      }
    }

    if (phone !== null) poll();
    return () => {
      cancelled = true;
    };
  }, [orderId, phone]);

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Your tickets</h1>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {phone === null && <p className="mt-4">Loading…</p>}
      {phone !== null && !error && !status && <p className="mt-4">Checking payment…</p>}
      {status && !status.ticketsIssued && status.paymentStatus === "pending" && (
        <p className="mt-4 text-neutral-600">Processing payment…</p>
      )}
      {status?.ticketsIssued && !order && !error && (
        <p className="mt-4 text-neutral-600">Loading tickets…</p>
      )}
      {order && (
        <div className="mt-6 space-y-4">
          <p className="font-medium">{order.eventTitle}</p>
          <p className="text-sm text-neutral-600">Total: {order.totalAmount} SYP</p>
          {order.tickets.map((t) => (
            <div key={t.id} className="rounded border p-3">
              <p className="font-medium">{t.ticketTypeName}</p>
              <p className="text-sm text-neutral-600">{t.holderName}</p>
              <div className="mt-3">
                <TicketQr value={t.qrPayload} size={200} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-500">Show token</summary>
                <p className="mt-1 break-all font-mono text-xs text-neutral-600">{t.qrPayload}</p>
              </details>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
