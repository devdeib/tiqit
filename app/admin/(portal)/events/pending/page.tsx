import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { listPendingEvents } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export default async function AdminPendingEventsPage() {
  const admin = await getAdminContext();
  if (!admin) return null;
  const events = await listPendingEvents(admin);

  return (
    <main style={{ paddingTop:"40px" }}>
      <Link href="/admin" style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", marginBottom:"24px", display:"inline-block" }}>← Dashboard</Link>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Pending events</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"28px" }}>Events submitted by organizers awaiting your approval.</p>

      {events.length === 0 ? (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", padding:"48px 24px", textAlign:"center" }}>
          <p style={{ fontSize:"15px", fontWeight:700, color:"var(--tq-off)", marginBottom:"6px" }}>No events pending</p>
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>All submissions have been reviewed.</p>
        </div>
      ) : (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Event","Organizer","Date","Submitted","Actions"].map((h) => (
                  <th key={h} style={{ textAlign:"left", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", padding:"12px 16px", borderBottom:"1px solid var(--tq-rule)", fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderBottom:"1px solid var(--tq-rule)" }}>
                  <td style={{ padding:"16px" }}>
                    <Link href={`/admin/events/${e.id}`} style={{ fontSize:"14px", fontWeight:700, color:"var(--tq-white)", textDecoration:"none", display:"block", marginBottom:"2px" }}>{e.title}</Link>
                    <span style={{ fontSize:"11px", color:"var(--tq-muted)" }}>{e.venue}</span>
                  </td>
                  <td style={{ padding:"16px" }}>
                    <p style={{ fontSize:"13px", color:"var(--tq-off)", marginBottom:"2px" }}>{e.organizerName}</p>
                    <p style={{ fontSize:"11px", color:"var(--tq-muted)" }}>{e.organizerEmail}</p>
                  </td>
                  <td style={{ padding:"16px", fontSize:"13px", color:"var(--tq-off)" }}>{new Date(e.eventDate).toLocaleDateString()}</td>
                  <td style={{ padding:"16px", fontSize:"11px", color:"var(--tq-muted)" }}>
                    <Link href={`/admin/events/${e.id}`} style={{ display:"inline-flex", alignItems:"center", background:"rgba(139,47,232,.15)", color:"var(--tq-purple-lt)", border:"1px solid rgba(139,47,232,.3)", borderRadius:"6px", padding:"6px 14px", fontSize:"12px", fontWeight:600, textDecoration:"none" }}>Review →</Link>
                  </td>
                  <td style={{ padding:"16px" }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
