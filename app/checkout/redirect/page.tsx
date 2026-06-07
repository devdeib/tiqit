"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManualPaymentForm } from "@/components/checkout/manual-payment-form";
import { apiGet } from "@/lib/api/client";
import { normalizeToE164Phone } from "@/lib/phone";
import type { CheckoutStatusResponse, ManualPaymentCheckoutContext } from "@/types/api";

function ManualPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");

  const [context, setContext] = useState<ManualPaymentCheckoutContext | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getPhone = useCallback((): string | null => {
    const raw = sessionStorage.getItem("guestPhone");
    if (!raw) return null;
    return normalizeToE164Phone(raw);
  }, []);

  const loadContext = useCallback(async () => {
    if (!orderId) return;
    const phone = getPhone();
    if (!phone) {
      setError("Missing guest phone — reserve tickets again from the event page.");
      setLoading(false);
      return;
    }

    const q = `?phone=${encodeURIComponent(phone)}`;
    try {
      const [{ context: ctx }, { status: s }] = await Promise.all([
        apiGet<{ context: ManualPaymentCheckoutContext }>(
          `/api/checkout/${orderId}/payment-context${q}`,
        ),
        apiGet<{ status: CheckoutStatusResponse }>(`/api/checkout/${orderId}/status${q}`),
      ]);
      setContext(ctx);
      setStatus(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment details");
    } finally {
      setLoading(false);
    }
  }, [orderId, getPhone]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!orderId) return;
    if (status?.paymentStatus === "completed" || status?.orderStatus === "confirmed") {
      const phone = getPhone();
      const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
      router.replace(`/orders/${orderId}/confirmation${q}`);
    }
  }, [status, orderId, router, getPhone]);

  if (!orderId) {
    return <p className="text-red-600">Missing order ID. Return to checkout and try again.</p>;
  }

  if (loading) {
    return <p className="mt-6 text-neutral-600">Loading payment details…</p>;
  }

  if (error && !context) {
    return <p className="mt-6 text-red-600">{error}</p>;
  }

  if (!context) {
    return <p className="mt-6 text-red-600">Unable to load payment details.</p>;
  }

  const phone = getPhone();
  const shamCash = context.shamCash;
  const alreadyPaid =
    status?.paymentStatus === "completed" || context.orderStatus === "confirmed";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-700">Order reference</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-wide">
          {context.orderReferenceCode || "—"}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Total:{" "}
          <strong>
            {context.totalAmount} {context.currency}
          </strong>
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold">Pay with Sham Cash</h2>
        <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{shamCash.instructions}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500">Account name</dt>
            <dd className="font-medium">{shamCash.accountName || "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Account ID</dt>
            <dd className="font-mono font-medium">{shamCash.accountId || "—"}</dd>
          </div>
        </dl>

        {shamCash.qrImageUrl && (
          <img
            src={shamCash.qrImageUrl}
            alt="Sham Cash QR code"
            className="mt-4 max-h-48 rounded border"
          />
        )}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
        <li>
          Transfer <strong>{context.totalAmount} {context.currency}</strong> to the Sham Cash
          account above.
        </li>
        <li>
          Include reference <strong>{context.orderReferenceCode}</strong> in the payment note if
          possible.
        </li>
        <li>Enter your Sham Cash transaction ID below to verify payment instantly.</li>
      </ol>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!alreadyPaid && phone && (
        <ManualPaymentForm
          orderId={orderId}
          phone={phone}
          onSubmitted={() => void loadContext()}
        />
      )}
    </div>
  );
}

export default function LiveCheckoutRedirectPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Complete Sham Cash payment</h1>
      <Suspense fallback={<p className="mt-6">Loading…</p>}>
        <ManualPaymentContent />
      </Suspense>
    </main>
  );
}
