import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type OrganizerAccess = "anonymous" | "approved" | "denied";

/**
 * Resolves whether the current Supabase Auth session may use the organizer portal.
 * Uses the user JWT (anon client) — not service role.
 */
export async function resolveOrganizerAccess(
  supabase: SupabaseClient<Database>,
): Promise<OrganizerAccess> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return "anonymous";

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, organizer_status, is_active")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();

  if (profileError || !profile) return "denied";
  if (
    profile.role === "organizer" &&
    profile.organizer_status === "approved" &&
    profile.is_active
  ) {
    return "approved";
  }

  return "denied";
}
