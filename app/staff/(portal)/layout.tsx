import { redirect } from "next/navigation";
import { StaffSignOut } from "@/components/staff/staff-sign-out";
import { getStaffContext } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/staff/login");

  return (
    <div className="min-h-dvh bg-neutral-100">
      <header className="border-b bg-emerald-900 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="font-semibold">Staff scan</span>
          <span className="text-xs opacity-80">{ctx.profile.email}</span>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="flex justify-end pb-2">
          <StaffSignOut />
        </div>
        {children}
      </div>
    </div>
  );
}
