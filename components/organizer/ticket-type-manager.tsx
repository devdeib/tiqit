"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerTicketType } from "@/types/organizer";

type Props = { eventId: string; initialTypes: OrganizerTicketType[]; editable: boolean };

const inp: React.CSSProperties = {
  width: "100%", background: "var(--tq-base)", border: "1px solid var(--tq-rule)",
  borderRadius: "8px", color: "var(--tq-white)", fontSize: "13px",
  padding: "9px 12px", outline: "none", fontFamily: "inherit",
};

export function TicketTypeManager({ eventId, initialTypes, editable }: Props) {
  const router = useRouter();
  const [types, setTypes]     = useState(initialTypes);
  const [name, setName]       = useState("");
  const [price, setPrice]     = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { ticketTypes } = await organizerFetch<{ ticketTypes: OrganizerTicketType[] }>(`/api/organizer/events/${eventId}/ticket-types`);
    setTypes(ticketTypes);
  }

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setLoading(true); setError(null);
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/ticket-types`, { method: "POST", body: JSON.stringify({ name, price: Number(price), totalCapacity: Number(capacity) }) });
      setName(""); setPrice(""); setCapacity("");
      await refresh(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to add ticket type"); }
    finally { setLoading(false); }
  }

  async function removeType(typeId: string) {
    if (!editable || !confirm("Delete this ticket type?")) return;
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/ticket-types/${typeId}`, { method: "DELETE" });
      await refresh(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "24px" }}>
      {/* Existing types */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {types.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>No ticket types yet. Add one below.</p>
        )}
        {types.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--tq-panel)", border: "1px solid var(--tq-rule)",
            borderLeft: "3px solid var(--tq-purple)", borderRadius: "10px", padding: "14px 18px",
          }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--tq-white)", marginBottom: "3px" }}>{t.name}</p>
              <p style={{ fontSize: "12px", color: "var(--tq-muted)" }}>
                {t.price} SYP · {t.available}/{t.totalCapacity} remaining
              </p>
            </div>
            {editable && t.available === t.totalCapacity && (
              <button
                type="button"
                onClick={() => void removeType(t.id)}
                style={{ background: "rgba(247,37,133,.1)", color: "var(--tq-pink)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "6px", padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {editable && (
        <form onSubmit={(e) => void addType(e)} style={{ background: "var(--tq-surface)", border: "1px solid var(--tq-rule)", borderTop: "2px solid var(--tq-purple)", borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tq-purple-lt)", marginBottom: "4px" }}>Add ticket type</p>
          <input required placeholder="Name (e.g. General Admission, VIP)" value={name} onChange={(e) => setName(e.target.value)} style={inp} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <input required type="number" min={0} placeholder="Price (SYP)" value={price} onChange={(e) => setPrice(e.target.value)} style={inp} />
            <input required type="number" min={1} placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inp} />
          </div>
          {error && <p style={{ fontSize: "13px", color: "var(--tq-pink)" }}>{error}</p>}
          <button type="submit" disabled={loading} className="tq-btn-primary" style={{ alignSelf: "flex-start" }}>
            {loading ? "Adding…" : "+ Add type"}
          </button>
        </form>
      )}
    </div>
  );
}
