"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api/client";
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

  const items = event.ticketTypes
    .filter((t) => (quantities[t.id] ?? 0) > 0)
    .map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { reservation } = await apiPost<{ reservation: ReservationResponse }>(
        "/api/reservations",
        {
          eventId: event.id,
          items,
          guest: { fullName, phone, email: email || null },
        },
      );
      sessionStorage.setItem("guestPhone", phone);
      router.push(`/checkout/${reservation.reservationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve tickets");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {event.ticketTypes.map((type) => (
        <div key={type.id} className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{type.name}</p>
            <p className="text-sm text-neutral-600">
              {type.price} SYP · {type.available} left
            </p>
          </div>
          <input
            type="number"
            min={0}
            max={Math.min(type.available, event.maxTicketsPerOrder)}
            value={quantities[type.id] ?? 0}
            onChange={(e) =>
              setQuantities((q) => ({ ...q, [type.id]: Number(e.target.value) }))
            }
            className="w-20 rounded border px-2 py-1"
          />
        </div>
      ))}

      <div className="space-y-2 border-t pt-4">
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          required
          placeholder="Phone (+963...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || items.length === 0}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Reserving…" : "Continue to payment"}
      </button>
    </form>
  );
}
