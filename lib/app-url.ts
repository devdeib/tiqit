import "server-only";

import { getServerEnv } from "@/lib/env";

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Canonical public origin for redirects and webhook callbacks (no trailing slash). */
export function getAppBaseUrl(): string {
  const env = getServerEnv();
  const configured = env.APP_URL?.trim();
  const vercel = process.env.VERCEL_URL?.trim();

  if (configured && !isLocalhostUrl(configured)) {
    return configured.replace(/\/$/, "");
  }

  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function getConfiguredAppUrl(): string | null {
  const url = getServerEnv().APP_URL?.trim();
  return url || null;
}

export function isProductionAppUrlMisconfigured(): boolean {
  const configured = getConfiguredAppUrl();
  return Boolean(configured && isLocalhostUrl(configured) && process.env.VERCEL_URL);
}
