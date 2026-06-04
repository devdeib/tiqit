import "server-only";

import { AppError } from "@/lib/errors";
import { resolveOrganizerAccess } from "@/lib/organizer-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OrganizerProfile = Database["public"]["Tables"]["users"]["Row"];

export type OrganizerContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  authUserId: string;
  profile: OrganizerProfile;
};

export async function getOrganizerContext(): Promise<OrganizerContext | null> {
  const supabase = await createServerSupabaseClient();
  const access = await resolveOrganizerAccess(supabase);
  if (access !== "approved") return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return { supabase, authUserId: user.id, profile };
}

export async function requireOrganizerContext(): Promise<OrganizerContext> {
  const ctx = await getOrganizerContext();
  if (!ctx) {
    throw new AppError("Organizer authentication required", {
      code: "UNAUTHORIZED",
      status: 401,
      expose: true,
    });
  }
  return ctx;
}
