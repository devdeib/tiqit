import Link from "next/link";
import { getAdminContext } from "@/lib/admin-auth";
import { getAdminDashboardStats } from "@/services/admin/events.service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const stats = await getAdminDashboardStats(admin);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-2 text-neutral-600">Platform operations and approvals.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Events pending approval"
          value={stats.eventsPendingApproval}
          href="/admin/events/pending"
        />
        <StatCard
          label="Organizers pending"
          value={stats.organizersPending}
          href="/admin/users"
        />
        <StatCard label="Stuck payments" value={stats.stuckPayments} href="/admin/webhooks" />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="rounded border bg-white p-4 hover:border-neutral-400">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Link>
  );
}
