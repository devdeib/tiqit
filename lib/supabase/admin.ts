import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerEnv } from "@/lib/env";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client. Use only in Route Handlers, Server Actions,
 * and background jobs — never import in Client Components.
 */
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  if (!adminClient) {
    const env = getServerEnv();
    adminClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return adminClient;
}
