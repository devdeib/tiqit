"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/api/admin-client";
import type { AdminUserRow } from "@/types/admin";
import type { OrganizerStatus } from "@/types/database";

const STATUS_STYLE: Record<string, { bg:string; color:string }> = {
  approved: { bg:"rgba(139,47,232,.18)", color:"var(--tq-purple-lt)" },
  pending:  { bg:"rgba(212,168,67,.15)",  color:"var(--tq-gold)" },
  rejected: { bg:"rgba(247,37,133,.12)", color:"var(--tq-pink)" },
};

export function UserManager({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email:"", fullName:"", password:"", organizerStatus:"pending" as OrganizerStatus });

  async function createOrganizer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const res = await adminFetch<{ user: AdminUserRow }>("/api/admin/users", { method:"POST", body:JSON.stringify(form) });
      setUsers((u) => [res.user, ...u]);
      setForm({ email:"", fullName:"", password:"", organizerStatus:"pending" });
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
    finally { setCreating(false); }
  }

  async function patchUser(id: string, patch: { organizerStatus?: OrganizerStatus; isActive?: boolean; role?: "organizer" | "staff" }) {
    setError(null);
    try {
      const res = await adminFetch<{ user: AdminUserRow }>(`/api/admin/users/${id}`, { method:"PATCH", body:JSON.stringify(patch) });
      setUsers((list) => list.map((u) => (u.id === id ? res.user : u)));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  }

  const inputStyle = { width:"100%", background:"var(--tq-base)", border:"1px solid var(--tq-rule)", borderRadius:"8px", color:"var(--tq-white)", fontSize:"13px", padding:"9px 12px", outline:"none", fontFamily:"inherit" };
  const btnSm = (color: string, bg: string, border: string) => ({ display:"inline-flex", alignItems:"center", background:bg, color, border:`1px solid ${border}`, borderRadius:"6px", padding:"5px 12px", fontSize:"11px", fontWeight:600 as const, cursor:"pointer" as const, fontFamily:"inherit" });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"32px" }}>
      {/* Create organizer form */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderTop:"2px solid var(--tq-purple)", borderRadius:"12px", padding:"24px" }}>
        <h2 style={{ fontSize:"16px", fontWeight:700, letterSpacing:"-0.02em", marginBottom:"20px", color:"var(--tq-white)" }}>Create organizer</h2>
        <form onSubmit={(e) => void createOrganizer(e)} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email:e.target.value })} style={inputStyle} />
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName:e.target.value })} style={inputStyle} />
          <input required type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password:e.target.value })} style={inputStyle} />
          <select value={form.organizerStatus} onChange={(e) => setForm({ ...form, organizerStatus:e.target.value as OrganizerStatus })} style={{ ...inputStyle, cursor:"pointer" }}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          {error && <p style={{ gridColumn:"1/-1", fontSize:"13px", color:"var(--tq-pink)" }}>{error}</p>}
          <button type="submit" disabled={creating} className="tq-btn-primary" style={{ gridColumn:"1/-1" }}>{creating ? "Creating…" : "Create organizer →"}</button>
        </form>
      </div>

      {/* Users table */}
      <div style={{ background:"var(--tq-panel)", border:"1px solid var(--tq-rule)", borderRadius:"12px", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Name","Email","Role","Status","Actions"].map((h) => (
                <th key={h} style={{ textAlign:"left", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--tq-muted)", padding:"12px 16px", borderBottom:"1px solid var(--tq-rule)", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const st = STATUS_STYLE[u.organizerStatus ?? "pending"] ?? STATUS_STYLE.pending;
              return (
                <tr key={u.id} style={{ borderBottom:"1px solid var(--tq-rule)" }}>
                  <td style={{ padding:"14px 16px", fontSize:"14px", fontWeight:600, color:"var(--tq-white)" }}>{u.fullName}</td>
                  <td style={{ padding:"14px 16px", fontSize:"12px", color:"var(--tq-muted)" }}>{u.email}</td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 8px", borderRadius:"4px", fontSize:"10px", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", background:"rgba(139,47,232,.15)", color:"var(--tq-purple-lt)" }}>{u.role}</span>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"9999px", fontSize:"10px", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", background:st.bg, color:st.color }}>{u.organizerStatus ?? "—"}</span>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                      {u.organizerStatus === "pending" && (
                        <>
                          <button onClick={() => void patchUser(u.id, { organizerStatus:"approved" })} style={btnSm("var(--tq-purple-lt)","rgba(139,47,232,.15)","rgba(139,47,232,.3)")}>Approve</button>
                          <button onClick={() => void patchUser(u.id, { organizerStatus:"suspended" })} style={btnSm("var(--tq-pink)","rgba(247,37,133,.1)","rgba(247,37,133,.25)")}>Reject</button>
                        </>
                      )}
                      {u.isActive && <button onClick={() => void patchUser(u.id, { isActive:false })} style={btnSm("var(--tq-muted)","transparent","var(--tq-rule)")}>Deactivate</button>}
                      {!u.isActive && <button onClick={() => void patchUser(u.id, { isActive:true })} style={btnSm("var(--tq-off)","var(--tq-surface)","var(--tq-rule)")}>Reactivate</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
