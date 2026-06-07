import type { RetryPolicy } from "../payments/retry";
import { DEFAULT_PROVIDER_RETRY } from "../payments/retry";

/** Documented Sham Cash API base URL (v1). Override via SHAM_CASH_API_BASE_URL. */
export const SHAM_CASH_DOCUMENTED_API_BASE_URL = "https://api.shamcash-api.com/v1";

export const DEFAULT_SHAM_CASH_TIMEOUT_MS = 15_000;

export const DEFAULT_SHAM_CASH_RETRY: RetryPolicy = DEFAULT_PROVIDER_RETRY;
