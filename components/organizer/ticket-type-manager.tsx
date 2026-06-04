"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerTicketType } from "@/types/organizer";

type Props = {
  eventId: string;
  initialTypes: OrganizerTicketType[];
  editable: boolean;
};

export function TicketTypeManager({ eventId, initialTypes, editable }: Props) {
  const router = useRouter();
  const [types, setTypes] = useState(initialTypes);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { ticketTypes } = await organizerFetch<{ ticketTypes: OrganizerTicketType[] }>(
      `/api/organizer/events/${eventId}/ticket-types`,
    );
    setTypes(ticketTypes);
  }

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setLoading(true);
    setError(null);
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/ticket-types`, {
        method: "POST",
        body: JSON.stringify({
          name,
          price: Number(price),
          totalCapacity: Number(capacity),
        }),
      });
      setName("");
      setPrice("");
      setCapacity("");
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add ticket type");
    } finally {
      setLoading(false);
    }
  }

  async function removeType(typeId: string) {
    if (!editable || !confirm("Delete this ticket type?")) return;
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/ticket-types/${typeId}`, {
        method: "DELETE",
      });
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <ul className="space-y-3">
        {types.length === 0 && (
          <p className="text-sm text-neutral-600">No ticket types yet.</p>
        )}
        {types.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-neutral-600">
                {t.price} SYP · {t.available}/{t.totalCapacity} available
              </p>
            </div>
            {editable && t.available === t.totalCapacity && (
              <button
                type="button"
                onClick={() => removeType(t.id)}
                className="text-sm text-red-600 underline"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <form onSubmit={addType} className="space-y-3 rounded border p-4">
          <p className="text-sm font-medium">Add ticket type</p>
          <input
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
          <div className="flex gap-3">
            <input
              required
              type="number"
              min={0}
              placeholder="Price (SYP)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
            <input
              required
              type="number"
              min={1}
              placeholder="Capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add type"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
