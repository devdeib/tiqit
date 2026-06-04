"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerStaffAssignment, OrganizerStaffOption } from "@/types/organizer";

type Props = {
  eventId: string;
  initialAssignments: OrganizerStaffAssignment[];
  staffOptions: OrganizerStaffOption[];
};

export function StaffManager({ eventId, initialAssignments, staffOptions }: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const { assignment } = await organizerFetch<{ assignment: OrganizerStaffAssignment }>(
        `/api/organizer/events/${eventId}/staff`,
        { method: "POST", body: JSON.stringify({ staffId }) },
      );
      setAssignments((prev) => [assignment, ...prev]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setLoading(false);
    }
  }

  async function remove(assignmentId: string) {
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/staff/${assignmentId}`, {
        method: "DELETE",
      });
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <ul className="space-y-2">
        {assignments.length === 0 && (
          <p className="text-sm text-neutral-600">No staff assigned yet.</p>
        )}
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{a.staffName}</p>
              <p className="text-sm text-neutral-600">{a.staffEmail}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(a.id)}
              className="text-sm text-red-600 underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {staffOptions.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No staff users in the directory. An admin must create staff accounts first.
        </p>
      ) : (
        <form onSubmit={assign} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Assign staff
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="mt-1 block rounded border px-3 py-2"
            >
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Assigning…" : "Assign"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
