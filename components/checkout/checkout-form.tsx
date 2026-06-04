"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api/client";
import type { CheckoutResponse } from "@/types/api";

type Props = { reservationId: string };

export function CheckoutForm({ reservationId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setError(null);
    setLoading(true);
    try {
      const phone = sessionStorage.getItem("guestPhone");
      if (!phone) {
        throw new Error("Missing guest phone — reserve tickets again from the event page");
      }

      const { checkout } = await apiPost<{ checkout: CheckoutResponse }>("/api/checkout", {
        reservationId,
        idempotencyKey: `checkout-${reservationId}`,
        phone,
      });
      window.location.href = checkout.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-neutral-600">
        Your tickets are held for 10 minutes. Complete payment to confirm.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Pay with Sham Cash"}
      </button>
    </div>
  );
}
