import { z } from "zod";

export type AppEnvironment = "development" | "staging" | "production";

/** .env often sets `KEY=` — treat blank as unset so `.optional()` works. */
function optionalEnvString(minLength = 1) {
  return z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().min(minLength).optional(),
  );
}

function optionalEnvUrl() {
  return z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().url().optional(),
  );
}

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  HMAC_SECRET_V1: optionalEnvString(16),
  SHAM_CASH_API_KEY: optionalEnvString(1),
  /** Alias for SHAM_CASH_API_KEY (server-only, never exposed to client). */
  SHAMCASH_API_TOKEN: optionalEnvString(1),
  SHAM_CASH_WEBHOOK_SECRET: optionalEnvString(1),
  SHAM_CASH_MOCK: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["true", "false"]).optional(),
  ),
  SHAM_CASH_FORCE_LIVE: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["true", "false"]).optional(),
  ),
  SHAM_CASH_API_BASE_URL: optionalEnvUrl(),
  APP_URL: optionalEnvUrl(),
  APP_ENV: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["development", "staging", "production"]).optional(),
  ),
  ALLOW_DEV_PAYMENT: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["true", "false"]).optional(),
  ),
  ADMIN_API_SECRET: optionalEnvString(16),
  LOG_FORMAT: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["json", "pretty"]).optional(),
  ),
  RATE_LIMIT_BACKEND: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.enum(["memory", "kv"]).optional(),
  ),
  RATE_LIMIT_KV_URL: optionalEnvUrl(),
  RATE_LIMIT_KV_TOKEN: optionalEnvString(1),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  cachedServerEnv = parsed.data;
  return parsed.data;
}

export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid client environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return parsed.data;
}

export const REQUIRED_SERVER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const REQUIRED_READY_ENV_KEYS = [
  ...REQUIRED_SERVER_ENV_KEYS,
] as const;

/** Logical environment for config validation (explicit APP_ENV or Vercel mapping). */
export function getAppEnvironment(): AppEnvironment {
  const explicit = process.env.APP_ENV;
  if (
    explicit === "development" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit;
  }
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";
  return "development";
}

export function isProductionDeploy(): boolean {
  return getAppEnvironment() === "production";
}

export function checkEnvPresence(keys: readonly string[]): {
  ok: boolean;
  missing: string[];
  present: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];
  for (const key of keys) {
    const value = process.env[key];
    if (!value || value.trim() === "") missing.push(key);
    else present.push(key);
  }
  return { ok: missing.length === 0, missing, present };
}
