"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/api/admin-client";
import type { AdminPendingManualPayment } from "@/types/admin";

export function PendingPaymentsList({
  payments: initial,
}: {
  payments: AdminPendingManualPayment[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(paymentId: string) {
    setLoadingId(paymentId);
    setMessage(null);
    setError(null);
    try {
      const res = await adminFetch<{
        result: { orderId: string; alreadyProcessed: boolean };
      }>(`/api/admin/payments/${paymentId}/approve`, { method: "POST" });
      setMessage(
        res.result.alreadyProcessed
          ? `Order already confirmed (${res.result.orderId.slice(0, 8)}…)`
          : `Payment approved — tickets issued for order ${res.result.orderId.slice(0, 8)}…`,
      );
      setItems((list) => list.filter((p) => p.paymentId !== paymentId));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(paymentId: string) {
    const reason = window.prompt("Optional rejection reason for internal notes:") ?? undefined;
    setLoadingId(paymentId);
    setMessage(null);
    setError(null);
    try {
      await adminFetch(`/api/admin/payments/${paymentId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      });
      setMessage("Payment rejected — customer can submit again.");
      setItems((list) => list.filter((p) => p.paymentId !== paymentId));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-600">No payments awaiting review.</p>;
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded border bg-white">
        {items.map((p) => (
          <li key={p.paymentId} className="flex flex-wrap gap-6 p-4 text-sm">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono font-semibold">{p.orderReference}</p>
              <p>
                {p.customerName} · {p.customerPhone}
              </p>
              <p className="text-neutral-600">
                {p.amount} {p.currency} · txn {p.transactionId ?? "—"} ·{" "}
                <Link href={`/admin/orders/${p.orderId}`} className="underline">
                  Order
                </Link>
              </p>
              <p className="text-neutral-500">
                Submitted {new Date(p.submittedAt).toLocaleString()}
              </p>
            </div>
            {p.proofImageUrl && (
              <a href={p.proofImageUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={p.proofImageUrl}
                  alt="Payment proof"
                  className="h-32 w-auto rounded border object-cover"
                />
              </a>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={loadingId === p.paymentId}
                onClick={() => void approve(p.paymentId)}
                className="rounded bg-green-700 px-3 py-1.5 text-white disabled:opacity-50"
              >
                {loadingId === p.paymentId ? "Working…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={loadingId === p.paymentId}
                onClick={() => void reject(p.paymentId)}
                className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
