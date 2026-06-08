"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api/client";
import { normalizeToE164Phone, formatPhoneValidationHint } from "@/lib/phone";
import type { PublicEventDetail, ReservationResponse } from "@/types/api";

type Props = { event: PublicEventDetail };

export function PurchaseForm({ event }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const items = event.ticketTypes.filter((t) => (quantities[t.id] ?? 0) > 0).map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedPhone = normalizeToE164Phone(phone);
      if (!normalizedPhone) throw new Error(formatPhoneValidationHint());
      const { reservation } = await apiPost<{ reservation: ReservationResponse }>("/api/reservations", { eventId: event.id, items, guest: { fullName, phone: normalizedPhone, email: email || null } });
      sessionStorage.setItem("guestPhone", normalizedPhone);
      router.push(`/checkout/${reservation.reservationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve tickets");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Ticket type selectors */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--tq-off)", marginBottom: "12px" }}>Select tickets</p>
        {event.ticketTypes.map((type) => (
          <div key={type.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--tq-rule)" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--tq-white)" }}>{type.name}</p>
              <p style={{ fontSize: "11px", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--tq-muted)", marginTop: "2px" }}>{type.price} SYP · {type.available} left</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button type="button" onClick={() => setQuantities((q) => ({ ...q, [type.id]: Math.max(0, (q[type.id] ?? 0) - 1) }))} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--tq-rule)", background: "var(--tq-base)", color: "var(--tq-white)", cursor: "pointer", fontSize: "16px", fontFamily: "inherit" }}>−</button>
              <span style={{ fontWeight: 700, minWidth: "16px", textAlign: "center", fontSize: "14px" }}>{quantities[type.id] ?? 0}</span>
              <button type="button" onClick={() => setQuantities((q) => ({ ...q, [type.id]: Math.min(type.available, event.maxTicketsPerOrder, (q[type.id] ?? 0) + 1) }))} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "none", background: "var(--tq-purple)", color: "#fff", cursor: "pointer", fontSize: "16px", fontFamily: "inherit" }}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Guest details */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Full name</label>
          <input required placeholder="Ahmad Al-Rashidi" value={fullName} onChange={(e) => setFullName(e.target.value)} className="tq-input" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Phone</label>
          <input required placeholder="+971 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="tq-input" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Email <span style={{ color: "var(--tq-sub)" }}>(optional)</span></label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="tq-input" />
        </div>
      </div>

      {error && <div style={{ background: "rgba(247,37,133,.1)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px", color: "var(--tq-pink)" }}>{error}</div>}

      <button type="submit" disabled={loading || items.length === 0} className="tq-btn-primary" style={{ width: "100%" }}>
        {loading ? "Reserving…" : "Continue to payment →"}
      </button>
    </form>
  );
}
