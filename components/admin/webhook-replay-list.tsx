"use client";

import { useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/api/admin-client";
import type { AdminStuckPayment } from "@/types/admin";

export function WebhookReplayList({ stuckPayments: initial }: { stuckPayments: AdminStuckPayment[] }) {
  const [items, setItems] = useState(initial);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function replay(paymentId: string) {
    setLoadingId(paymentId);
    setMessage(null);
    try {
      const res = await adminFetch<{ result: { orderId: string; alreadyProcessed: boolean } }>(
        `/api/admin/webhooks/${paymentId}/replay`,
        { method: "POST" },
      );
      setMessage(
        res.result.alreadyProcessed
          ? `Idempotent replay: order ${res.result.orderId} (already processed)`
          : `Replayed for order ${res.result.orderId}`,
      );
      setItems((list) => list.filter((p) => p.paymentId !== paymentId));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div style={{
        background: "rgba(139,47,232,.08)",
        border: "1px solid rgba(139,47,232,.2)",
        borderRadius: "10px",
        padding: "20px 24px",
        fontSize: "13px",
        color: "var(--tq-purple-lt)",
        fontWeight: 600,
      }}>
        ✓ No stuck payments detected — all clear.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {message && (
        <div style={{
          background: "rgba(139,47,232,.1)",
          border: "1px solid rgba(139,47,232,.25)",
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "13px",
          color: "var(--tq-purple-lt)",
        }}>
          {message}
        </div>
      )}
      {items.map((p) => (
        <div
          key={p.paymentId}
          style={{
            background: "var(--tq-panel)",
            border: "1px solid var(--tq-rule)",
            borderLeft: "3px solid var(--tq-pink)",
            borderRadius: "10px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--tq-white)", marginBottom: "4px" }}>
              Payment{" "}
              <span style={{ fontFamily: "var(--font-geist-mono), monospace", color: "var(--tq-pink)" }}>
                {p.providerPaymentId.slice(0, 12)}…
              </span>
              {" "}— {p.paymentStatus}
            </p>
            <p style={{ fontSize: "12px", color: "var(--tq-muted)" }}>
              Order{" "}
              <Link
                href={`/admin/orders/${p.orderId}`}
                style={{ color: "var(--tq-purple-lt)", textDecoration: "none", fontWeight: 600 }}
              >
                {p.orderId.slice(0, 8)}…
              </Link>
              {" "}({p.orderStatus}) · {p.amount} SYP
              {p.hasStoredPayload ? " · payload stored" : " · synthetic replay"}
            </p>
          </div>
          <button
            type="button"
            disabled={loadingId === p.paymentId}
            onClick={() => void replay(p.paymentId)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(247,37,133,.1)",
              color: "var(--tq-pink)",
              border: "1px solid rgba(247,37,133,.25)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: loadingId === p.paymentId ? 0.5 : 1,
            }}
          >
            {loadingId === p.paymentId ? "Replaying…" : "↻ Replay webhook"}
          </button>
        </div>
      ))}
    </div>
  );
}
