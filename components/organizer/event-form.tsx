"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerEventDetail } from "@/types/organizer";

type Props = { mode: "create" | "edit"; eventId?: string; initial?: OrganizerEventDetail; editable?: boolean };

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local: string): string { return new Date(local).toISOString(); }

const inp: React.CSSProperties = {
  width: "100%", background: "var(--tq-base)", border: "1px solid var(--tq-rule)",
  borderRadius: "8px", color: "var(--tq-white)", fontSize: "14px",
  padding: "10px 14px", outline: "none", fontFamily: "inherit",
  colorScheme: "dark",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: "9px", letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500,
};

export function EventForm({ mode, eventId, initial, editable = true }: Props) {
  const router = useRouter();
  const [title, setTitle]                       = useState(initial?.title ?? "");
  const [description, setDescription]           = useState(initial?.description ?? "");
  const [venue, setVenue]                       = useState(initial?.venue ?? "");
  const [eventDate, setEventDate]               = useState(initial ? toLocalInput(initial.eventDate) : "");
  const [saleEndsAt, setSaleEndsAt]             = useState(initial ? toLocalInput(initial.saleEndsAt) : "");
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState(String(initial?.maxTicketsPerOrder ?? 10));
  const [refundPolicyNote, setRefundPolicyNote] = useState(initial?.refundPolicyNote ?? "");
  const [error, setError]                       = useState<string | null>(null);
  const [loading, setLoading]                   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setError(null); setLoading(true);
    try {
      const body = { title, description: description || null, venue, eventDate: toIso(eventDate), saleEndsAt: toIso(saleEndsAt), maxTicketsPerOrder: Number(maxTicketsPerOrder), refundPolicyNote: refundPolicyNote || null };
      if (mode === "create") {
        const { event } = await organizerFetch<{ event: OrganizerEventDetail }>("/api/organizer/events", { method: "POST", body: JSON.stringify(body) });
        router.push(`/organizer/events/${event.id}`);
      } else if (eventId) {
        await organizerFetch(`/api/organizer/events/${eventId}`, { method: "PATCH", body: JSON.stringify(body) });
        router.refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setLoading(false); }
  }

  const disabled = !editable;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "560px" }}>
      <div>
        <label style={lbl}>Event title</label>
        <input required disabled={disabled} placeholder="e.g. Nocturnal Festival" value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inp, opacity: disabled ? 0.5 : 1 }} />
      </div>
      <div>
        <label style={lbl}>Description</label>
        <textarea disabled={disabled} placeholder="Tell attendees what to expect…" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inp, resize: "vertical", opacity: disabled ? 0.5 : 1 }} />
      </div>
      <div>
        <label style={lbl}>Venue</label>
        <input required disabled={disabled} placeholder="e.g. Coca-Cola Arena, Dubai" value={venue} onChange={(e) => setVenue(e.target.value)} style={{ ...inp, opacity: disabled ? 0.5 : 1 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={lbl}>Event date</label>
          <input required disabled={disabled} type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ ...inp, opacity: disabled ? 0.5 : 1 }} />
        </div>
        <div>
          <label style={lbl}>Sale ends at</label>
          <input required disabled={disabled} type="datetime-local" value={saleEndsAt} onChange={(e) => setSaleEndsAt(e.target.value)} style={{ ...inp, opacity: disabled ? 0.5 : 1 }} />
        </div>
      </div>
      <div>
        <label style={lbl}>Max tickets per order</label>
        <input required disabled={disabled} type="number" min={1} max={100} value={maxTicketsPerOrder} onChange={(e) => setMaxTicketsPerOrder(e.target.value)} style={{ ...inp, opacity: disabled ? 0.5 : 1 }} />
      </div>
      <div>
        <label style={lbl}>Refund policy note <span style={{ color: "var(--tq-sub)" }}>(optional)</span></label>
        <textarea disabled={disabled} placeholder="e.g. No refunds within 48 hours of event." value={refundPolicyNote} onChange={(e) => setRefundPolicyNote(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", opacity: disabled ? 0.5 : 1 }} />
      </div>
      {error && (
        <div style={{ background: "rgba(247,37,133,.1)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "8px", padding: "12px 14px", fontSize: "13px", color: "var(--tq-pink)" }}>
          {error}
        </div>
      )}
      {editable && (
        <button type="submit" disabled={loading} className="tq-btn-primary" style={{ alignSelf: "flex-start" }}>
          {loading ? "Saving…" : mode === "create" ? "Create draft →" : "Save changes"}
        </button>
      )}
    </form>
  );
}
