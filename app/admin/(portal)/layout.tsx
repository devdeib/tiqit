import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { getAdminContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAdminContext();
  if (!ctx) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-full bg-neutral-50">
      <AdminNav email={ctx.profile.email} />
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <div className="flex justify-end pt-2">
          <AdminSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
