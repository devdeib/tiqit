import "server-only";

import { getServerEnv } from "@/lib/env";

/** Canonical public origin for redirects and webhook callbacks (no trailing slash). */
export function getAppBaseUrl(): string {
  const env = getServerEnv();
  if (env.APP_URL?.trim()) {
    return env.APP_URL.trim().replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
