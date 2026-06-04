"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerEventDetail } from "@/types/organizer";

type Props = {
  mode: "create" | "edit";
  eventId?: string;
  initial?: OrganizerEventDetail;
  editable?: boolean;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  return new Date(local).toISOString();
}

export function EventForm({ mode, eventId, initial, editable = true }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [eventDate, setEventDate] = useState(
    initial ? toLocalInput(initial.eventDate) : "",
  );
  const [saleEndsAt, setSaleEndsAt] = useState(
    initial ? toLocalInput(initial.saleEndsAt) : "",
  );
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState(
    String(initial?.maxTicketsPerOrder ?? 10),
  );
  const [refundPolicyNote, setRefundPolicyNote] = useState(
    initial?.refundPolicyNote ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setError(null);
    setLoading(true);
    try {
      const body = {
        title,
        description: description || null,
        venue,
        eventDate: toIso(eventDate),
        saleEndsAt: toIso(saleEndsAt),
        maxTicketsPerOrder: Number(maxTicketsPerOrder),
        refundPolicyNote: refundPolicyNote || null,
      };

      if (mode === "create") {
        const { event } = await organizerFetch<{ event: OrganizerEventDetail }>(
          "/api/organizer/events",
          { method: "POST", body: JSON.stringify(body) },
        );
        router.push(`/organizer/events/${event.id}`);
      } else if (eventId) {
        await organizerFetch(`/api/organizer/events/${eventId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <input
        required
        disabled={!editable}
        placeholder="Event title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:opacity-60"
      />
      <textarea
        disabled={!editable}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:opacity-60"
        rows={4}
      />
      <input
        required
        disabled={!editable}
        placeholder="Venue"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:opacity-60"
      />
      <label className="block text-sm">
        Event date
        <input
          required
          disabled={!editable}
          type="datetime-local"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2 disabled:opacity-60"
        />
      </label>
      <label className="block text-sm">
        Sale ends at
        <input
          required
          disabled={!editable}
          type="datetime-local"
          value={saleEndsAt}
          onChange={(e) => setSaleEndsAt(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2 disabled:opacity-60"
        />
      </label>
      <input
        required
        disabled={!editable}
        type="number"
        min={1}
        max={100}
        placeholder="Max tickets per order"
        value={maxTicketsPerOrder}
        onChange={(e) => setMaxTicketsPerOrder(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:opacity-60"
      />
      <textarea
        disabled={!editable}
        placeholder="Refund policy note"
        value={refundPolicyNote}
        onChange={(e) => setRefundPolicyNote(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:opacity-60"
        rows={2}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {editable && (
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : mode === "create" ? "Create draft event" : "Save changes"}
        </button>
      )}
    </form>
  );
}
