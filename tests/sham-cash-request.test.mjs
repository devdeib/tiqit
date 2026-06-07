import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shamCashApiRequest } from "../services/sham-cash/request.ts";
import {
  ShamCashProviderError,
  ShamCashTimeoutError,
} from "../services/sham-cash/errors.ts";
import { SHAM_CASH_DOCUMENTED_API_BASE_URL } from "../services/sham-cash/constants.ts";

describe("shamCashApiRequest", () => {
  it("sends Authorization Bearer header", async () => {
    let capturedHeaders;
    const fetchImpl = async (_url, init) => {
      capturedHeaders = init.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await shamCashApiRequest({
      method: "GET",
      path: "/connectivity-check",
      apiToken: "live-token",
      baseUrl: SHAM_CASH_DOCUMENTED_API_BASE_URL,
      fetchImpl,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    });

    assert.equal(capturedHeaders.Authorization, "Bearer live-token");
  });

  it("throws ShamCashTimeoutError when request exceeds timeout", async () => {
    const fetchImpl = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });

    await assert.rejects(
      () =>
        shamCashApiRequest({
          method: "GET",
          path: "/slow-endpoint",
          apiToken: "live-token",
          baseUrl: SHAM_CASH_DOCUMENTED_API_BASE_URL,
          fetchImpl,
          timeoutMs: 30,
          retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
        }),
      (error) => error instanceof ShamCashTimeoutError,
    );
  });

  it("throws ShamCashProviderError for non-2xx JSON envelope", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ error: { code: "forbidden", message: "Not allowed" } }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );

    await assert.rejects(
      () =>
        shamCashApiRequest({
          method: "GET",
          path: "/forbidden",
          apiToken: "live-token",
          baseUrl: SHAM_CASH_DOCUMENTED_API_BASE_URL,
          fetchImpl,
          retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
        }),
      (error) => {
        return (
          error instanceof ShamCashProviderError &&
          error.httpStatus === 403 &&
          error.providerCode === "forbidden" &&
          error.message === "Not allowed"
        );
      },
    );
  });

  it("retries retryable provider errors", async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response(JSON.stringify({ error: { message: "Unavailable" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await shamCashApiRequest({
      method: "GET",
      path: "/retry-check",
      apiToken: "live-token",
      baseUrl: SHAM_CASH_DOCUMENTED_API_BASE_URL,
      fetchImpl,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
    });

    assert.equal(attempts, 3);
    assert.equal(result.raw.status, "ok");
  });
});
