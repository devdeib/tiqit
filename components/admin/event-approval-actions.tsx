"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/api/admin-client";

export function EventApprovalActions({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function approve() {
    setLoading("approve");
    setError(null);
    try {
      await adminFetch(`/api/admin/events/${eventId}/approve`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoading(null);
    }
  }

  async function reject() {
    setLoading("reject");
    setError(null);
    try {
      await adminFetch(`/api/admin/events/${eventId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-semibold">Approval actions</h2>
      <textarea
        placeholder="Rejection reason (optional)"
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!!loading}
          onClick={approve}
          className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading === "approve" ? "Approving…" : "Approve → Active"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={reject}
          className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading === "reject" ? "Rejecting…" : "Reject → Cancelled"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
