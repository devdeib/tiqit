"use client";
import { useState } from "react";
import { apiPost } from "@/lib/api/client";
import { normalizeToE164Phone, formatPhoneValidationHint } from "@/lib/phone";
import type { CheckoutResponse } from "@/types/api";

type Props = { reservationId: string };

function formatApiError(data: unknown, fallback: string): string {
  const payload = data as { error?: { message?: string; details?: { issues?: { fieldErrors?: Record<string, string[]> } } } };
  const message = payload?.error?.message ?? fallback;
  const fieldErrors = payload?.error?.details?.issues?.fieldErrors;
  if (!fieldErrors) return message;
  const hints = Object.entries(fieldErrors).flatMap(([field, errors]) => errors.map((e) => `${field}: ${e}`)).join("; ");
  if (hints.includes("phone")) return `${message}. ${formatPhoneValidationHint()}`;
  return hints ? `${message} (${hints})` : message;
}

export function CheckoutForm({ reservationId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setError(null);
    setLoading(true);
    try {
      const rawPhone = sessionStorage.getItem("guestPhone");
      if (!rawPhone) throw new Error("Missing guest phone — reserve tickets again from the event page");
      const phone = normalizeToE164Phone(rawPhone);
      if (!phone) throw new Error(`Invalid phone on file. ${formatPhoneValidationHint()}`);
      sessionStorage.setItem("guestPhone", phone);
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `checkout-${reservationId}`, phone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data, "Checkout failed"));
      const checkout = (data as { checkout: CheckoutResponse }).checkout;
      if (!checkout?.redirectUrl) throw new Error("Checkout succeeded but no redirect URL was returned");
      sessionStorage.setItem(`checkoutTotal:${checkout.orderId}`, String(checkout.totalAmount));
      if (checkout.referenceCode) sessionStorage.setItem(`paymentReference:${checkout.orderId}`, checkout.referenceCode);
      window.location.assign(checkout.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--tq-muted)", marginBottom: "20px" }}>
        Your tickets are held for 10 minutes. Complete payment to confirm.
      </p>
      {error && (
        <div style={{ background: "rgba(247,37,133,.1)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px", color: "var(--tq-pink)" }}>
          {error}
        </div>
      )}
      <button type="button" onClick={() => void handlePay()} disabled={loading} className="tq-btn-primary" style={{ width: "100%" }}>
        {loading ? "Redirecting…" : "Pay with Sham Cash →"}
      </button>
    </div>
  );
}
