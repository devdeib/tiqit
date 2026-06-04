"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import type { CheckoutStatusResponse } from "@/types/api";

function MockPayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const phone = sessionStorage.getItem("guestPhone");
    if (!phone) return;
    const q = `?phone=${encodeURIComponent(phone)}`;
    apiGet<{ status: CheckoutStatusResponse }>(`/api/checkout/${orderId}/status${q}`)
      .then(({ status: s }) => setStatus(s))
      .catch(() => {});
  }, [orderId]);

  async function completePayment() {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const phone = sessionStorage.getItem("guestPhone");
      if (!phone) {
        throw new Error("Missing guest phone — reserve tickets again from the event page");
      }
      await apiPost("/api/dev/simulate-payment", { orderId, phone });
      router.push(`/orders/${orderId}/confirmation?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment simulation failed");
      setLoading(false);
    }
  }

  if (!orderId) {
    return <p className="text-red-600">Missing orderId</p>;
  }

  const alreadyPaid =
    status?.paymentStatus === "completed" || status?.orderStatus === "confirmed";

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-neutral-600">
        Development mock payment (Sham Cash API not configured).
      </p>
      {alreadyPaid && (
        <p className="text-sm text-amber-600">
          This order is already paid.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              const phone = sessionStorage.getItem("guestPhone") ?? "";
              const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
              router.push(`/orders/${orderId}/confirmation${q}`);
            }}
          >
            View tickets
          </button>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={completePayment}
        disabled={loading || alreadyPaid}
        className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Processing…" : "Simulate successful payment"}
      </button>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Mock payment</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <MockPayContent />
      </Suspense>
    </main>
  );
}
