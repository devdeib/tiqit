import { AppError } from "@/lib/errors";
import type { AdminContext } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdminUserRow } from "@/types/admin";
import type { OrganizerStatus, UserRole } from "@/types/database";
import { logAdminAction } from "@/services/admin/audit.service";

export async function listAdminUsers(admin: AdminContext): Promise<AdminUserRow[]> {
  const { data, error } = await admin.supabase
    .from("users")
    .select("id, email, full_name, role, organizer_status, is_active, created_at")
    .in("role", ["organizer", "staff", "admin"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to load users", { code: "DATABASE", cause: error });
  }

  return (data ?? []).map(mapUserRow);
}

export async function createOrganizerProfile(
  admin: AdminContext,
  input: {
    email: string;
    fullName: string;
    password: string;
    organizerStatus?: OrganizerStatus;
  },
): Promise<AdminUserRow> {
  const service = createAdminSupabaseClient();

  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (authError || !authData.user) {
    throw new AppError("Failed to create auth user", {
      code: "DATABASE",
      cause: authError,
      expose: true,
    });
  }

  const status = input.organizerStatus ?? "pending";

  const { data: profile, error: profileError } = await admin.supabase
    .from("users")
    .insert({
      supabase_auth_id: authData.user.id,
      email: input.email,
      full_name: input.fullName,
      role: "organizer",
      organizer_status: status,
      is_active: true,
    })
    .select("id, email, full_name, role, organizer_status, is_active, created_at")
    .single();

  if (profileError || !profile) {
    await service.auth.admin.deleteUser(authData.user.id);
    throw new AppError("Failed to create organizer profile", {
      code: "DATABASE",
      cause: profileError,
    });
  }

  await logAdminAction(admin, {
    action: "user.create_organizer",
    entityType: "user",
    entityId: profile.id,
    metadata: { email: input.email, organizerStatus: status },
  });

  return mapUserRow(profile);
}

export async function updateAdminUser(
  admin: AdminContext,
  userId: string,
  input: {
    fullName?: string;
    isActive?: boolean;
    organizerStatus?: OrganizerStatus;
    role?: "organizer" | "staff";
  },
): Promise<AdminUserRow> {
  const { data: existing, error: loadError } = await admin.supabase
    .from("users")
    .select("id, role, organizer_status")
    .eq("id", userId)
    .maybeSingle();

  if (loadError || !existing) {
    throw new AppError("User not found", { code: "NOT_FOUND", status: 404, expose: true });
  }

  if (existing.role === "admin") {
    throw new AppError("Admin accounts cannot be modified here", {
      code: "FORBIDDEN",
      status: 403,
      expose: true,
    });
  }

  if (input.role === "staff" && existing.role === "organizer") {
    // staff must not have organizer_status
  }

  const nextRole = input.role ?? existing.role;
  const patch: {
    full_name?: string;
    is_active?: boolean;
    organizer_status?: OrganizerStatus | null;
    role?: UserRole;
  } = {};

  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (nextRole === "staff") {
    patch.role = "staff";
    patch.organizer_status = null;
  } else if (nextRole === "organizer") {
    patch.role = "organizer";
    patch.organizer_status = input.organizerStatus ?? existing.organizer_status ?? "pending";
  }

  if (nextRole === "organizer" && input.organizerStatus !== undefined) {
    patch.organizer_status = input.organizerStatus;
  }

  const { data, error } = await admin.supabase
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select("id, email, full_name, role, organizer_status, is_active, created_at")
    .single();

  if (error || !data) {
    throw new AppError("Failed to update user", { code: "DATABASE", cause: error });
  }

  await logAdminAction(admin, {
    action: "user.update",
    entityType: "user",
    entityId: userId,
    metadata: { patch: input },
  });

  return mapUserRow(data);
}

function mapUserRow(row: {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organizer_status: OrganizerStatus | null;
  is_active: boolean;
  created_at: string;
}): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    organizerStatus: row.organizer_status,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}
