import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { getAdminContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return (
    <div style={{ minHeight: "100vh", background: "var(--tq-void)" }}>
      <AdminNav email={ctx.profile.email} />
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}>
          <AdminSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
