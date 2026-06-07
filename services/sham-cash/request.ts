import type {
  RetryPolicy,
} from "../payments/retry";
import {
  isRetryableProviderError,
  withProviderRetry,
} from "../payments/retry";
import { buildShamCashAuthHeaders } from "./auth";
import { buildShamCashApiUrl } from "./config";
import { DEFAULT_SHAM_CASH_RETRY, DEFAULT_SHAM_CASH_TIMEOUT_MS } from "./constants";
import {
  ShamCashNetworkError,
  ShamCashProviderError,
  ShamCashTimeoutError,
} from "./errors";
import { parseShamCashErrorEnvelope } from "./parse-error";

export type ShamCashApiRequestOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  apiToken: string;
  baseUrl: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
};

export type ShamCashApiSuccess<T> = {
  data: T;
  raw: Record<string, unknown>;
  httpStatus: number;
};

export function isRetryableShamCashError(error: unknown): boolean {
  if (error instanceof ShamCashTimeoutError) return true;
  if (error instanceof ShamCashNetworkError) return true;
  if (error instanceof ShamCashProviderError) {
    return error.httpStatus === 502 || error.httpStatus === 503 || error.httpStatus === 504;
  }
  return isRetryableProviderError(error);
}

export async function shamCashApiRequest<T = Record<string, unknown>>(
  options: ShamCashApiRequestOptions,
): Promise<ShamCashApiSuccess<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHAM_CASH_TIMEOUT_MS;
  const retryPolicy = options.retryPolicy ?? DEFAULT_SHAM_CASH_RETRY;
  const url = buildShamCashApiUrl(options.baseUrl, options.path);
  const headers = buildShamCashAuthHeaders(options.apiToken);

  return withProviderRetry(
    async () => executeSingleRequest<T>(fetchImpl, url, headers, options.method, options.body, timeoutMs),
    retryPolicy,
    isRetryableShamCashError,
  );
}

async function executeSingleRequest<T>(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  method: ShamCashApiRequestOptions["method"],
  body: unknown | undefined,
  timeoutMs: number,
): Promise<ShamCashApiSuccess<T>> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const bodyText = await response.text();

    if (!response.ok) {
      const parsed = parseShamCashErrorEnvelope(response.status, bodyText);
      throw new ShamCashProviderError({
        message: parsed.message,
        httpStatus: parsed.httpStatus,
        providerCode: parsed.providerCode,
        envelope: parsed.envelope,
      });
    }

    const raw = parseSuccessBody(bodyText);
    return {
      data: raw as T,
      raw,
      httpStatus: response.status,
    };
  } catch (error) {
    if (error instanceof ShamCashProviderError) throw error;
    if (isAbortError(error)) {
      throw new ShamCashTimeoutError(timeoutMs);
    }
    throw new ShamCashNetworkError("Sham Cash API network request failed", error);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function parseSuccessBody(bodyText: string): Record<string, unknown> {
  const trimmed = bodyText.trim();
  if (!trimmed) return {};

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { message: trimmed };
  }
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.toLowerCase().includes("aborted");
}
