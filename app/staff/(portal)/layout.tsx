import { redirect } from "next/navigation";
import { StaffSignOut } from "@/components/staff/staff-sign-out";
import { getStaffContext } from "@/lib/staff-auth";
import { TiqitLogo } from "@/components/ui/tiqit-logo";

export const dynamic = "force-dynamic";

export default async function StaffPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/staff/login");
  return (
    <div style={{ minHeight: "100vh", background: "var(--tq-void)" }}>
      <header style={{ background: "var(--tq-base)", borderBottom: "1px solid var(--tq-rule)", padding: "12px 20px" }}>
        <div style={{ maxWidth: "520px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <TiqitLogo size="sm" />
            <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", background: "rgba(139,47,232,.2)", color: "var(--tq-purple-lt)", padding: "2px 8px", borderRadius: "4px" }}>
              Staff scan
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "11px", color: "var(--tq-muted)" }}>{ctx.profile.email}</span>
            <StaffSignOut />
          </div>
        </div>
      </header>
      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "24px 20px 64px" }}>
        {children}
      </div>
    </div>
  );
}
