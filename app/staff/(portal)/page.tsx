import Link from "next/link";
import { getStaffContext } from "@/lib/staff-auth";
import { listStaffAssignedEvents } from "@/services/staff/events.service";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const events = await listStaffAssignedEvents(staff);

  return (
    <main>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "4px" }}>Your events</h1>
        <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>Select an event to scan tickets.</p>
      </div>

      {events.length === 0 ? (
        <div style={{ background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderRadius: "12px", padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--tq-off)", marginBottom: "6px" }}>No assignments yet</p>
          <p style={{ fontSize: "13px", color: "var(--tq-muted)" }}>Ask an organizer to assign you to an event.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {events.map((e) => (
            <div key={e.id}>
              <Link href={`/staff/events/${e.id}/scan`} style={{ display: "block", background: "var(--tq-panel)", border: "1px solid var(--tq-rule)", borderLeft: "3px solid var(--tq-purple)", borderRadius: "10px", padding: "18px 20px", textDecoration: "none" }}>
                <p style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--tq-white)", marginBottom: "4px" }}>{e.title}</p>
                <p style={{ fontSize: "12px", color: "var(--tq-muted)", marginBottom: "8px" }}>{e.venue} · {new Date(e.eventDate).toLocaleString()}</p>
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", background: "rgba(139,47,232,.2)", color: "var(--tq-purple-lt)", padding: "3px 8px", borderRadius: "4px" }}>{e.status}</span>
              </Link>
              <Link href={`/staff/events/${e.id}/stats`} style={{ display: "inline-block", marginTop: "6px", marginLeft: "4px", fontSize: "11px", color: "var(--tq-purple-lt)", textDecoration: "none" }}>
                View stats →
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
