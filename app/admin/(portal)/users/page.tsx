import { UserManager } from "@/components/admin/user-manager";
import { getAdminContext } from "@/lib/admin-auth";
import { listAdminUsers } from "@/services/admin/users.service";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getAdminContext();
  if (!admin) return null;
  const users = await listAdminUsers(admin);

  return (
    <main style={{ paddingTop:"40px" }}>
      <h1 style={{ fontSize:"28px", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Users</h1>
      <p style={{ fontSize:"13px", color:"var(--tq-muted)", marginBottom:"32px" }}>Manage organizer accounts, approval status, and staff roles.</p>
      <UserManager initialUsers={users} />
    </main>
  );
}
