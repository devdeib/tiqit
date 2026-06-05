import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StaffAccess = "anonymous" | "active" | "denied";

export async function resolveStaffAccess(
  supabase: SupabaseClient<Database>,
): Promise<StaffAccess> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return "anonymous";

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();

  if (profileError || !profile) return "denied";
  if (profile.role === "staff" && profile.is_active) return "active";
  return "denied";
}
