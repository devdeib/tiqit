"use client";

import { use, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { TicketCard } from "@/components/tickets/ticket-card";
import type { CheckoutStatusResponse, OrderConfirmationResponse } from "@/types/api";
import { PageShell } from "@/components/ui/page-shell";

type Props = { params: Promise<{ orderId: string }> };

export default function ConfirmationPage({ params }: Props) {
  const { orderId } = use(params);
  const [phone, setPhone] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [order, setOrder] = useState<OrderConfirmationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPhone(sessionStorage.getItem("guestPhone")); }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const guestPhone = phone ?? sessionStorage.getItem("guestPhone");
        if (!guestPhone) { setError("Missing guest phone — use the same browser session as checkout"); return; }
        const { status: s } = await apiGet<{ status: CheckoutStatusResponse }>(`/api/checkout/${orderId}/status?phone=${encodeURIComponent(guestPhone)}`);
        if (cancelled) return;
        setStatus(s);
        if (s.paymentStatus === "failed") { setError("Payment failed. Return to checkout and try again."); return; }
        if (s.ticketsIssued && guestPhone) {
          const { order: o } = await apiPost<{ order: OrderConfirmationResponse }>("/api/orders/lookup", { orderId, phone: guestPhone });
          if (!cancelled) setOrder(o);
          return;
        }
        if (!s.ticketsIssued && s.paymentStatus === "pending") window.setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load order");
      }
    }
    if (phone !== null) poll();
    return () => { cancelled = true; };
  }, [orderId, phone]);

  return (
    <PageShell>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }} className="confirmation-page">
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "6px" }}>Your tickets</h1>
          {!error && !order && <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>Verifying your payment…</p>}
        </div>

        {error && (
          <div style={{ background: "rgba(247,37,133,.1)", border: "1px solid rgba(247,37,133,.25)", borderRadius: "10px", padding: "16px 20px", fontSize: "14px", color: "var(--tq-pink)" }}>
            {error}
          </div>
        )}

        {!error && !status && phone !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--tq-muted)", fontSize: "13px" }}>
            <span className="tq-pulse" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--tq-purple)", display: "inline-block" }} />
            Checking payment…
          </div>
        )}

        {status && !status.ticketsIssued && status.paymentStatus === "pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--tq-muted)", fontSize: "13px" }}>
            <span className="tq-pulse" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--tq-purple)", display: "inline-block" }} />
            Processing payment…
          </div>
        )}

        {status?.ticketsIssued && !order && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--tq-muted)", fontSize: "13px" }}>
            <span className="tq-pulse" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--tq-purple-lt)", display: "inline-block" }} />
            Loading tickets…
          </div>
        )}

        {order && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", background: "rgba(139,47,232,.1)", border: "1px solid rgba(139,47,232,.25)", borderRadius: "10px" }}>
              <span style={{ fontSize: "18px" }}>✓</span>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--tq-white)" }}>{order.eventTitle}</p>
                <p style={{ fontSize: "12px", color: "var(--tq-muted)" }}>Total: {order.totalAmount} SYP</p>
              </div>
            </div>

            {order.tickets.map((t) => {
              const isVip = t.ticketTypeName.toLowerCase().includes("vip");
              return (
                <TicketCard
                  key={t.id}
                  ticketId={t.id}
                  holderName={t.holderName}
                  phone={phone ?? ""}
                  eventTitle={order.eventTitle}
                  venue=""
                  eventDate={new Date().toISOString()}
                  ticketType={t.ticketTypeName}
                  qrValue={t.qrPayload}
                  isVip={isVip}
                />
              );
            })}

            <button
              onClick={() => window.print()}
              className="tq-btn-ghost no-print"
              style={{ alignSelf: "flex-start" }}
            >
              Print tickets
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
