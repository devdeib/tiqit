import Link from "next/link";
import { getStaffContext } from "@/lib/staff-auth";
import { getStaffEventStats } from "@/services/staff/scan.service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ eventId: string }> };

export default async function StaffStatsPage({ params }: Props) {
  const staff = await getStaffContext();
  if (!staff) return null;
  const { eventId } = await params;
  const stats = await getStaffEventStats(staff, eventId);
  const { data: event } = await staff.supabase.from("events").select("title").eq("id", eventId).single();

  const pct = stats.totalTickets > 0 ? Math.round((stats.scanned / stats.totalTickets) * 100) : 0;

  return (
    <main>
      <Link href={`/staff/events/${eventId}/scan`} style={{ fontSize:"10px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--tq-muted)", textDecoration:"none", marginBottom:"14px", display:"inline-block" }}>← Scanner</Link>
      <h1 style={{ fontSize:"22px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"24px" }}>{event?.title ?? "Event"} — stats</h1>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"24px" }}>
        {[{ label:"Total tickets", value:stats.totalTickets, color:"var(--tq-off)" }, { label:"Scanned", value:stats.scanned, color:"var(--tq-purple-lt)" }, { label:"Remaining", value:stats.remaining, color:"var(--tq-pink)" }].map((s) => (
          <div key={s.label} style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"10px", padding:"16px", textAlign:"center" }}>
            <p style={{ fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", marginBottom:"8px", fontWeight:500 }}>{s.label}</p>
            <p style={{ fontSize:"32px", fontWeight:900, letterSpacing:"-0.04em", color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"10px", padding:"16px", marginBottom:"20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
          <span style={{ fontSize:"11px", color:"var(--tq-muted)", fontWeight:500 }}>Entry progress</span>
          <span style={{ fontSize:"11px", fontWeight:700, color:"var(--tq-purple-lt)" }}>{pct}%</span>
        </div>
        <div style={{ height:"6px", background:"var(--tq-base)", borderRadius:"3px", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"var(--tq-purple)", borderRadius:"3px", transition:"width .3s" }} />
        </div>
      </div>

      <Link href={`/staff/events/${eventId}/scan`} style={{ display:"block", background:"var(--tq-purple)", color:"#fff", borderRadius:"10px", padding:"14px", textAlign:"center", fontSize:"14px", fontWeight:700, textDecoration:"none" }}>Open scanner →</Link>
    </main>
  );
}
