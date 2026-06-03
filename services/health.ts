import { createClient } from "@supabase/supabase-js";
import {
  checkEnvPresence,
  REQUIRED_READY_ENV_KEYS,
  REQUIRED_SERVER_ENV_KEYS,
} from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database";

export type HealthCheckResult = {
  status: "ok" | "degraded" | "error";
  app: { running: boolean };
  env: { ok: boolean; missing: string[]; present: string[] };
  supabase: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
  timestamp: string;
};

export type ReadyCheckResult = HealthCheckResult & {
  schema: {
    ok: boolean;
    platformConfig: boolean;
    hmacKeyVersion: boolean;
    error?: string;
  };
};

async function probeSupabase(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { ok: false, error: "Supabase credentials not configured" };
  }

  const started = Date.now();
  const client = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client
    .from("platform_config")
    .select("key")
    .limit(1)
    .maybeSingle();

  const latencyMs = Date.now() - started;

  if (error) {
    logger.warn("Supabase health probe failed", { error: error.message });
    return { ok: false, latencyMs, error: error.message };
  }

  return { ok: true, latencyMs };
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const env = checkEnvPresence(REQUIRED_SERVER_ENV_KEYS);
  const supabase = env.ok ? await probeSupabase() : { ok: false, error: "Skipped: missing env" };

  const status =
    env.ok && supabase.ok ? "ok" : env.ok || supabase.ok ? "degraded" : "error";

  return {
    status,
    app: { running: true },
    env,
    supabase,
    timestamp: new Date().toISOString(),
  };
}

export async function runReadyCheck(): Promise<ReadyCheckResult> {
  const base = await runHealthCheck();
  const env = checkEnvPresence(REQUIRED_READY_ENV_KEYS);

  let platformConfig = false;
  let hmacKeyVersion = false;
  let schemaError: string | undefined;

  if (env.ok) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const client = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [configRes, hmacRes] = await Promise.all([
      client
        .from("platform_config")
        .select("key")
        .eq("key", "default_commission_rate")
        .maybeSingle(),
      client
        .from("hmac_key_versions")
        .select("version")
        .eq("is_current", true)
        .maybeSingle(),
    ]);

    platformConfig = !configRes.error && configRes.data !== null;
    hmacKeyVersion = !hmacRes.error && hmacRes.data !== null;

    if (configRes.error) schemaError = configRes.error.message;
    else if (hmacRes.error) schemaError = hmacRes.error.message;
    else if (!platformConfig || !hmacKeyVersion) {
      schemaError = "Schema seed incomplete (platform_config or hmac_key_versions)";
    }
  } else {
    schemaError = "Skipped: missing env";
  }

  const schemaOk = platformConfig && hmacKeyVersion;
  const status =
    base.status === "ok" && schemaOk
      ? "ok"
      : base.status === "error" && !schemaOk
        ? "error"
        : "degraded";

  return {
    ...base,
    status,
    schema: {
      ok: schemaOk,
      platformConfig,
      hmacKeyVersion,
      error: schemaError,
    },
  };
}
