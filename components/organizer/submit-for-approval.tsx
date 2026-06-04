"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerEventDetail } from "@/types/organizer";

export function SubmitForApproval({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await organizerFetch<{ event: OrganizerEventDetail }>(
        `/api/organizer/events/${eventId}/submit`,
        { method: "POST", body: "{}" },
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded border border-black px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit for admin approval"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
