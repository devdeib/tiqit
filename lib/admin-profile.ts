import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminAccess = "anonymous" | "admin" | "denied";

export async function resolveAdminAccess(
  supabase: SupabaseClient<Database>,
): Promise<AdminAccess> {
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
  if (profile.role === "admin" && profile.is_active) return "admin";
  return "denied";
}
