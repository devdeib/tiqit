import { redirect } from "next/navigation";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { OrganizerSignOut } from "@/components/organizer/organizer-sign-out";
import { getOrganizerContext } from "@/lib/organizer-auth";

export const dynamic = "force-dynamic";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrganizerContext();
  if (!ctx) {
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <OrganizerNav email={ctx.profile.email} fullName={ctx.profile.full_name} />
      <div className="mx-auto max-w-5xl px-6 pb-12">
        <div className="flex justify-end pt-2">
          <OrganizerSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
