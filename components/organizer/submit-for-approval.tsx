"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerEventDetail } from "@/types/organizer";

export function SubmitForApproval({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function submit() {
    setLoading(true); setError(null);
    try {
      await organizerFetch<{ event: OrganizerEventDetail }>(`/api/organizer/events/${eventId}/submit`, { method: "POST", body: "{}" });
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Submit failed"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(212,168,67,.12)", color: "var(--tq-gold)",
          border: "1px solid rgba(212,168,67,.3)", borderRadius: "8px",
          padding: "10px 20px", fontSize: "13px", fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Submitting…" : "Submit for admin approval →"}
      </button>
      {error && <p style={{ fontSize: "13px", color: "var(--tq-pink)" }}>{error}</p>}
    </div>
  );
}
