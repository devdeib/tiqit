"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api/client";
import { normalizeToE164Phone } from "@/lib/phone";
import type { CheckoutStatusResponse, CheckoutVerifyPaymentResponse } from "@/types/api";

function LivePaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const referenceFromUrl = searchParams.get("reference");

  const [referenceCode, setReferenceCode] = useState(referenceFromUrl ?? "");
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const getPhone = useCallback((): string | null => {
    const raw = sessionStorage.getItem("guestPhone");
    if (!raw) return null;
    return normalizeToE164Phone(raw);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const storedReference = sessionStorage.getItem(`paymentReference:${orderId}`);
    if (storedReference) setReferenceCode(storedReference);
    else if (referenceFromUrl) setReferenceCode(referenceFromUrl);

    const storedTotal = sessionStorage.getItem(`checkoutTotal:${orderId}`);
    if (storedTotal) setTotalAmount(Number(storedTotal));

    const phone = getPhone();
    if (!phone) return;

    const q = `?phone=${encodeURIComponent(phone)}`;
    apiGet<{ status: CheckoutStatusResponse }>(`/api/checkout/${orderId}/status${q}`)
      .then(({ status: s }) => setStatus(s))
      .catch(() => {});
  }, [orderId, referenceFromUrl, getPhone]);

  useEffect(() => {
    if (!orderId) return;
    if (status?.paymentStatus === "completed" || status?.orderStatus === "confirmed") {
      const phone = getPhone();
      const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
      router.replace(`/orders/${orderId}/confirmation${q}`);
    }
  }, [status, orderId, router, getPhone]);

  const verifyPayment = useCallback(async () => {
    if (!orderId || verifyingRef.current) return;

    const phone = getPhone();
    if (!phone) {
      setError("Missing guest phone — reserve tickets again from the event page.");
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    setError(null);

    try {
      const { result } = await apiPost<{ result: CheckoutVerifyPaymentResponse }>(
        `/api/checkout/${orderId}/verify-payment`,
        { phone },
      );

      if (result.referenceCode) {
        setReferenceCode(result.referenceCode);
        sessionStorage.setItem(`paymentReference:${orderId}`, result.referenceCode);
      }

      if (result.verified) {
        router.push(`/orders/${orderId}/confirmation?phone=${encodeURIComponent(phone)}`);
        return;
      }

      setPollMessage(
        "Payment not found yet. Send the exact reference code in your Sham Cash payment note, then wait or tap verify again.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [orderId, getPhone, router]);

  useEffect(() => {
    if (!orderId || status?.paymentStatus === "completed") return;

    const interval = setInterval(() => {
      void verifyPayment();
    }, 15_000);

    return () => clearInterval(interval);
  }, [orderId, status?.paymentStatus, verifyPayment]);

  if (!orderId) {
    return <p className="text-red-600">Missing order ID. Return to checkout and try again.</p>;
  }

  const alreadyPaid =
    status?.paymentStatus === "completed" || status?.orderStatus === "confirmed";

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-neutral-600">
        Complete your payment in the Sham Cash app, then return here. We check for your transfer
        every 15 seconds.
      </p>

      <div className="rounded-lg border bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-700">Payment reference (put in note)</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-wide">
          {referenceCode || "—"}
        </p>
        {totalAmount !== null && (
          <p className="mt-2 text-sm text-neutral-600">
            Amount: <strong>{totalAmount} SYP</strong>
          </p>
        )}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
        <li>Open the Sham Cash app and send the exact amount shown above.</li>
        <li>
          Paste <strong>{referenceCode || "your reference code"}</strong> into the payment note
          field.
        </li>
        <li>Return here — verification runs automatically, or tap the button below.</li>
      </ol>

      {pollMessage && <p className="text-sm text-amber-700">{pollMessage}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void verifyPayment()}
        disabled={verifying || alreadyPaid || !referenceCode}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {verifying ? "Checking payment…" : "Verify payment now"}
      </button>
    </div>
  );
}

export default function LiveCheckoutRedirectPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Complete Sham Cash payment</h1>
      <Suspense fallback={<p className="mt-6">Loading…</p>}>
        <LivePaymentContent />
      </Suspense>
    </main>
  );
}
