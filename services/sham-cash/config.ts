import { SHAM_CASH_DOCUMENTED_API_BASE_URL } from "./constants";

export function resolveShamCashApiBaseUrl(configured?: string | null): string {
  const trimmed = configured?.trim();
  if (trimmed) return trimTrailingSlash(trimmed);
  return SHAM_CASH_DOCUMENTED_API_BASE_URL;
}

export function buildShamCashApiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlash(baseUrl)}${normalizedPath}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
