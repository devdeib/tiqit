"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/api/admin-client";
import type { AdminStuckPayment } from "@/types/admin";

export function WebhookReplayList({
  stuckPayments: initial,
}: {
  stuckPayments: AdminStuckPayment[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function replay(paymentId: string) {
    setLoadingId(paymentId);
    setMessage(null);
    try {
      const res = await adminFetch<{
        result: { orderId: string; alreadyProcessed: boolean };
      }>(`/api/admin/webhooks/${paymentId}/replay`, { method: "POST" });
      setMessage(
        res.result.alreadyProcessed
          ? `Idempotent replay: order ${res.result.orderId} (already processed)`
          : `Replayed for order ${res.result.orderId}`,
      );
      setItems((list) => list.filter((p) => p.paymentId !== paymentId));
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-600">No stuck payments detected.</p>;
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-green-700">{message}</p>}
      <ul className="divide-y rounded border">
        {items.map((p) => (
          <li key={p.paymentId} className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Payment {p.providerPaymentId.slice(0, 12)}… — {p.paymentStatus}
              </p>
              <p className="text-neutral-600">
                Order{" "}
                <Link href={`/admin/orders/${p.orderId}`} className="underline">
                  {p.orderId.slice(0, 8)}…
                </Link>{" "}
                ({p.orderStatus}) · {p.amount} SYP
                {p.hasStoredPayload ? " · payload stored" : " · synthetic replay"}
              </p>
            </div>
            <button
              type="button"
              disabled={loadingId === p.paymentId}
              onClick={() => replay(p.paymentId)}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loadingId === p.paymentId ? "Replaying…" : "Replay webhook"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
