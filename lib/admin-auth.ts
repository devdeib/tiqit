import "server-only";

import { timingSafeEqual } from "crypto";
import { AppError } from "@/lib/errors";
import { resolveAdminAccess } from "@/lib/admin-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const ADMIN_HEADER = "x-admin-api-key";

export type AdminProfile = Database["public"]["Tables"]["users"]["Row"];

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  authUserId: string;
  profile: AdminProfile;
};

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createServerSupabaseClient();
  const access = await resolveAdminAccess(supabase);
  if (access !== "admin") return null;

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

export async function requireAdminContext(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) {
    throw new AppError("Admin authentication required", {
      code: "UNAUTHORIZED",
      status: 401,
      expose: true,
    });
  }
  return ctx;
}

export function assertAdminApiKey(request: Request): void {
  const configured = process.env.ADMIN_API_SECRET?.trim();
  if (!configured || configured.length < 16) {
    throw new AppError("Admin API is not configured", {
      code: "CONFIG",
      status: 503,
      expose: false,
    });
  }

  const provided = request.headers.get(ADMIN_HEADER)?.trim();
  if (!provided) {
    throw new AppError("Unauthorized", { code: "UNAUTHORIZED", status: 401, expose: false });
  }

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(configured, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("Unauthorized", { code: "UNAUTHORIZED", status: 401, expose: false });
  }
}

export function isAdminApiConfigured(): boolean {
  try {
    const secret = process.env.ADMIN_API_SECRET?.trim();
    return Boolean(secret && secret.length >= 16);
  } catch {
    return false;
  }
}

/** For deployment checks only */
export function adminSecretConfigured(): boolean {
  return Boolean(process.env.ADMIN_API_SECRET?.trim());
}
