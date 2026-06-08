import { redirect } from "next/navigation";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { OrganizerSignOut } from "@/components/organizer/organizer-sign-out";
import { getOrganizerContext } from "@/lib/organizer-auth";

export const dynamic = "force-dynamic";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrganizerContext();
  if (!ctx) redirect("/login");
  return (
    <div style={{ minHeight: "100vh", background: "var(--tq-void)" }}>
      <OrganizerNav email={ctx.profile.email} fullName={ctx.profile.full_name} />
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}>
          <OrganizerSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
