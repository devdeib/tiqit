"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerFetch } from "@/lib/api/organizer-client";
import type { OrganizerStaffAssignment, OrganizerStaffOption } from "@/types/organizer";

type Props = { eventId: string; initialAssignments: OrganizerStaffAssignment[]; staffOptions: OrganizerStaffOption[] };

export function StaffManager({ eventId, initialAssignments, staffOptions }: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [staffId, setStaffId]         = useState(staffOptions[0]?.id ?? "");
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) return;
    setLoading(true); setError(null);
    try {
      const { assignment } = await organizerFetch<{ assignment: OrganizerStaffAssignment }>(`/api/organizer/events/${eventId}/staff`, { method: "POST", body: JSON.stringify({ staffId }) });
      setAssignments((prev) => [assignment, ...prev]);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Assign failed"); }
    finally { setLoading(false); }
  }

  async function remove(assignmentId: string) {
    try {
      await organizerFetch(`/api/organizer/events/${eventId}/staff/${assignmentId}`, { method: "DELETE" });
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Remove failed"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "24px" }}>
      {/* Assignment list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {assignments.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>No staff assigned yet.</p>
        )}
        {assignments.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderLeft: "3px solid var(--tq-purple)", borderRadius: "10px", padding: "14px 18px" }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--tq-white)", marginBottom: "3px" }}>{a.staffName}</p>
              <p style={{ fontSize: "12px", color: "var(--tq-muted)" }}>{a.staffEmail}</p>
            </div>
            <button type="button" onClick={() => void remove(a.id)} style={{ background: "rgba(247,37,133,.1)", color: "var(--tq-pink)", border: "1px solid rgba(247,37,133,.2)", borderRadius: "6px", padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Assign form */}
      {staffOptions.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>No staff users in the directory. An admin must create staff accounts first.</p>
      ) : (
        <form onSubmit={(e) => void assign(e)} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px", background: "var(--tq-surface)", border: "1px solid var(--tq-rule)", borderTop: "2px solid var(--tq-purple)", borderRadius: "10px", padding: "20px" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ display: "block", fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tq-muted)", marginBottom: "6px", fontWeight: 500 }}>Assign staff member</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ width: "100%", background: "var(--tq-base)", border: "1px solid var(--tq-rule)", borderRadius: "8px", color: "var(--tq-white)", fontSize: "13px", padding: "9px 12px", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.email})</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={loading} className="tq-btn-primary">
            {loading ? "Assigning…" : "Assign →"}
          </button>
        </form>
      )}

      {error && <p style={{ fontSize: "13px", color: "var(--tq-pink)" }}>{error}</p>}
    </div>
  );
}
