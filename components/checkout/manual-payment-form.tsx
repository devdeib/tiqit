"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPostForm } from "@/lib/api/client";
import type { ManualPaymentSubmitResponse } from "@/types/api";

export function ManualPaymentForm({
  orderId,
  phone,
  onSubmitted,
}: {
  orderId: string;
  phone: string;
  onSubmitted: (result: ManualPaymentSubmitResponse) => void;
}) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("phone", phone);
      form.set("transactionId", transactionId.trim());
      if (proof) form.set("proof", proof);

      const { result } = await apiPostForm<{ result: ManualPaymentSubmitResponse }>(
        `/api/checkout/${orderId}/submit-payment`,
        form,
      );

      if (result.verified) {
        router.push(`/orders/${orderId}/confirmation?phone=${encodeURIComponent(phone)}`);
        return;
      }

      setError(result.verificationMessage ?? "Payment could not be verified.");
      onSubmitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold">Submit transaction ID</h2>
      <p className="text-sm text-neutral-600">
        After transferring, enter your Sham Cash transaction ID. We verify it automatically with
        Sham Cash — no admin approval needed.
      </p>

      <label className="block text-sm">
        <span className="font-medium">Transaction ID</span>
        <input
          type="text"
          required
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="Sham Cash transaction reference"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Payment screenshot (optional)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setProof(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Verifying payment…" : "Verify payment"}
      </button>
    </form>
  );
}
