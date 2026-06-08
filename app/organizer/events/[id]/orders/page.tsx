import Link from "next/link";
import { getOrganizerContext } from "@/lib/organizer-auth";
import { getOrganizerEvent } from "@/services/organizer/events.service";
import { listOrganizerEventOrders } from "@/services/organizer/orders.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function OrganizerOrdersPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getOrganizerContext();
  if (!ctx) return null;
  const [event, orders] = await Promise.all([getOrganizerEvent(ctx, id), listOrganizerEventOrders(ctx, id)]);

  const statusColor: Record<string, string> = { confirmed:"var(--tq-purple-lt)", pending:"var(--tq-gold)", failed:"var(--tq-pink)", cancelled:"var(--tq-muted)" };
  const statusBg: Record<string, string> = { confirmed:"rgba(139,47,232,.18)", pending:"rgba(212,168,67,.15)", failed:"rgba(247,37,133,.12)", cancelled:"rgba(90,79,122,.2)" };

  return (
    <main style={{ paddingTop:"40px" }}>
      <Link href={`/organizer/events/${id}`} style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", display:"inline-block", marginBottom:"20px" }}>← {event.title}</Link>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px" }}>
        <div>
          <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"4px" }}>Orders</h1>
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>{orders.length} order{orders.length !== 1 ? "s" : ""} · read-only</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", padding:"48px 24px", textAlign:"center" }}>
          <p style={{ fontSize:"14px", fontWeight:700, color:"var(--tq-off)", marginBottom:"6px" }}>No orders yet</p>
          <p style={{ fontSize:"13px", color:"var(--tq-muted)" }}>Orders will appear here once tickets are purchased.</p>
        </div>
      ) : (
        <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Order ID","Status","Total","Tickets","Created"].map((h) => <th key={h} style={{ textAlign:"left", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", padding:"12px 16px", borderBottom:"1px solid var(--tq-rule)", fontWeight:500 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom:"1px solid var(--tq-rule)" }}>
                  <td style={{ padding:"14px 16px", fontFamily:"var(--font-geist-mono)", fontSize:"11px", color:"var(--tq-muted)" }}>{o.id.slice(0,8)}…</td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"9999px", fontSize:"10px", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", background:statusBg[o.status] ?? statusBg.cancelled, color:statusColor[o.status] ?? "var(--tq-muted)" }}>{o.status}</span>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:"13px", color:"var(--tq-off)", fontWeight:600 }}>{o.totalAmount} SYP</td>
                  <td style={{ padding:"14px 16px", fontSize:"13px", color:"var(--tq-off)" }}>{o.ticketsIssued ? "Issued" : "Pending"}</td>
                  <td style={{ padding:"14px 16px", fontSize:"11px", color:"var(--tq-muted)" }}>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
