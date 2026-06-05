import "server-only";

import { AppError } from "@/lib/errors";
import { resolveStaffAccess } from "@/lib/staff-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type StaffProfile = Database["public"]["Tables"]["users"]["Row"];

export type StaffContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  authUserId: string;
  profile: StaffProfile;
};

export async function getStaffContext(): Promise<StaffContext | null> {
  const supabase = await createServerSupabaseClient();
  const access = await resolveStaffAccess(supabase);
  if (access !== "active") return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();

  if (error || !profile) return null;
  return { supabase, authUserId: user.id, profile };
}

export async function requireStaffContext(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) {
    throw new AppError("Staff authentication required", {
      code: "UNAUTHORIZED",
      status: 401,
      expose: true,
    });
  }
  return ctx;
}

export async function assertStaffAssignedToEvent(
  staff: StaffContext,
  eventId: string,
): Promise<void> {
  const { data, error } = await staff.supabase
    .from("staff_event_assignments")
    .select("id")
    .eq("staff_id", staff.profile.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to verify event assignment", { code: "DATABASE", cause: error });
  }
  if (!data) {
    throw new AppError("You are not assigned to this event", {
      code: "FORBIDDEN",
      status: 403,
      expose: true,
    });
  }
}
