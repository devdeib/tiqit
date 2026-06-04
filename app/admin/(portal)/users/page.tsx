import { UserManager } from "@/components/admin/user-manager";
import { getAdminContext } from "@/lib/admin-auth";
import { listAdminUsers } from "@/services/admin/users.service";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  const users = await listAdminUsers(admin);

  return (
    <main className="py-8">
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Manage organizer accounts, approval status, and staff roles.
      </p>
      <div className="mt-8">
        <UserManager initialUsers={users} />
      </div>
    </main>
  );
}
