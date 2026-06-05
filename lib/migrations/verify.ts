import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type MigrationMarker = {
  id: string;
  label: string;
  required: boolean;
};

export const EXPECTED_MIGRATION_MARKERS: MigrationMarker[] = [
  { id: "base_schema", label: "schema-v1.2.sql (platform_config)", required: true },
  { id: "20250605_fulfillment", label: "20250605-phase1-hardening-fulfillment.sql", required: true },
  { id: "20250608_admin_audit", label: "20250608-phase3-admin-portal.sql (admin_audit_logs)", required: true },
  { id: "20250610_rls_fix", label: "20250610-fix-rls-recursion.sql (validate_qr_scan RPC)", required: true },
];

export type MigrationVerificationResult = {
  ok: boolean;
  markers: Record<string, boolean>;
  missing: string[];
};

export async function verifyDatabaseMigrations(
  client: SupabaseClient<Database>,
): Promise<MigrationVerificationResult> {
  const markers: Record<string, boolean> = {
    base_schema: false,
    "20250605_fulfillment": false,
    "20250608_admin_audit": false,
    "20250610_rls_fix": false,
  };

  const [configRes, auditRes, rpcRes] = await Promise.all([
    client
      .from("platform_config")
      .select("key")
      .eq("key", "default_commission_rate")
      .maybeSingle(),
    client.from("admin_audit_logs").select("id").limit(1).maybeSingle(),
    client.rpc("validate_qr_scan", {
      p_token: "0".repeat(64),
      p_event_id: "00000000-0000-0000-0000-000000000000",
    }),
  ]);

  markers.base_schema = !configRes.error && configRes.data !== null;
  markers["20250608_admin_audit"] = !auditRes.error;
  markers["20250610_rls_fix"] = rpcRes.error?.code !== "PGRST202";
  markers["20250605_fulfillment"] = markers["20250610_rls_fix"];

  const missing = EXPECTED_MIGRATION_MARKERS.filter(
    (m) => m.required && !markers[m.id],
  ).map((m) => m.label);

  return { ok: missing.length === 0, markers, missing };
}
