"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/api/admin-client";
import type { AdminUserRow } from "@/types/admin";
import type { OrganizerStatus } from "@/types/database";

export function UserManager({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    organizerStatus: "pending" as OrganizerStatus,
  });

  async function createOrganizer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await adminFetch<{ user: AdminUserRow }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUsers((u) => [res.user, ...u]);
      setForm({ email: "", fullName: "", password: "", organizerStatus: "pending" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(
    id: string,
    patch: { organizerStatus?: OrganizerStatus; isActive?: boolean; role?: "organizer" | "staff" },
  ) {
    setError(null);
    try {
      const res = await adminFetch<{ user: AdminUserRow }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setUsers((list) => list.map((u) => (u.id === id ? res.user : u)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={createOrganizer} className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Create organizer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={form.organizerStatus}
            onChange={(e) =>
              setForm({ ...form, organizerStatus: e.target.value as OrganizerStatus })
            }
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create organizer"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Organizer</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-3 pr-4">{u.fullName}</td>
                <td className="py-3 pr-4">{u.email}</td>
                <td className="py-3 pr-4">{u.role}</td>
                <td className="py-3 pr-4">{u.organizerStatus ?? "—"}</td>
                <td className="py-3 pr-4">{u.isActive ? "Yes" : "No"}</td>
                <td className="py-3">
                  {u.role !== "admin" && (
                    <div className="flex flex-wrap gap-2">
                      {u.role === "organizer" && (
                        <>
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => patchUser(u.id, { organizerStatus: "approved" })}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => patchUser(u.id, { organizerStatus: "suspended" })}
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => patchUser(u.id, { role: "staff" })}
                          >
                            → Staff
                          </button>
                        </>
                      )}
                      {u.role === "staff" && (
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() =>
                            patchUser(u.id, { role: "organizer", organizerStatus: "pending" })
                          }
                        >
                          → Organizer
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
