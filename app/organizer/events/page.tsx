import Link from "next/link";
import { EventStatusBadge } from "@/components/organizer/event-status-badge";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { listOrganizerEvents } from "@/services/organizer/events.service";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const ctx = await getOrganizerContext();
  if (!ctx) return null;
  const events = await listOrganizerEvents(ctx);

  return (
    <main style={{ paddingTop:"40px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px" }}>
        <div>
          <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"4px" }}>Events</h1>
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>{events.length} event{events.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/organizer/events/new" className="tq-btn-primary">+ New event</Link>
      </div>

      {events.length === 0 ? (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", padding:"48px 24px", textAlign:"center" }}>
          <p style={{ fontSize:"15px", fontWeight:700, color:"var(--tq-off)", marginBottom:"6px" }}>No events yet</p>
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>Create a draft to get started.</p>
        </div>
      ) : (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Event","Date","Status",""].map((h) => <th key={h} style={{ textAlign:"left", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", padding:"12px 16px", borderBottom:"1px solid var(--tq-rule)", fontWeight:500 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} style={{ borderBottom:"1px solid var(--tq-rule)" }}>
                  <td style={{ padding:"16px" }}>
                    <Link href={`/organizer/events/${ev.id}`} style={{ fontSize:"14px", fontWeight:700, color:"var(--tq-white)", textDecoration:"none", display:"block", marginBottom:"2px" }}>{ev.title}</Link>
                    <span style={{ fontSize:"11px", color:"var(--tq-muted)" }}>{ev.venue}</span>
                  </td>
                  <td style={{ padding:"16px", fontSize:"13px", color:"var(--tq-off)" }}>{new Date(ev.eventDate).toLocaleDateString()}</td>
                  <td style={{ padding:"16px" }}><EventStatusBadge status={ev.status} /></td>
                  <td style={{ padding:"16px", textAlign:"right" }}><Link href={`/organizer/events/${ev.id}`} style={{ fontSize:"12px", fontWeight:600, color:"var(--tq-purple-lt)", textDecoration:"none" }}>Manage →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
