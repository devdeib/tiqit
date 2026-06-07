import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ShamCashHttpClient } from "../services/sham-cash/http-client.ts";
import {
  ShamCashConfigurationError,
  ShamCashEndpointNotConfiguredError,
} from "../services/sham-cash/errors.ts";
import { resolveShamCashApiBaseUrl } from "../services/sham-cash/config.ts";
import { SHAM_CASH_DOCUMENTED_API_BASE_URL } from "../services/sham-cash/constants.ts";

describe("ShamCashHttpClient", () => {
  it("throws endpoint-not-configured for create payment", async () => {
    const client = new ShamCashHttpClient({
      getApiKey: () => "test-api-key",
      getBaseUrl: () => undefined,
    });

    await assert.rejects(
      () =>
        client.createPayment({
          orderId: "00000000-0000-0000-0000-000000000001",
          amount: 100,
          currency: "SYP",
          customerPhone: "+963900000000",
          description: "Order test",
        }),
      (error) =>
        error instanceof ShamCashEndpointNotConfiguredError &&
        error.endpointName === "CREATE_PAYMENT",
    );
  });

  it("throws endpoint-not-configured for status check", async () => {
    const client = new ShamCashHttpClient({
      getApiKey: () => "test-api-key",
      getBaseUrl: () => undefined,
    });

    await assert.rejects(
      () => client.getPaymentStatus("pay_123"),
      (error) =>
        error instanceof ShamCashEndpointNotConfiguredError &&
        error.endpointName === "GET_PAYMENT_STATUS",
    );
  });

  it("requires API key before calling configured endpoints", async () => {
    const unconfigured = new ShamCashHttpClient({
      getApiKey: () => undefined,
      getBaseUrl: () => undefined,
    });

    await assert.rejects(
      () => unconfigured.getPaymentStatus("pay_123"),
      (error) => error instanceof ShamCashConfigurationError,
    );
  });
});

describe("resolveShamCashApiBaseUrl", () => {
  it("defaults to documented base URL", () => {
    assert.equal(resolveShamCashApiBaseUrl(undefined), SHAM_CASH_DOCUMENTED_API_BASE_URL);
  });

  it("trims trailing slash from override", () => {
    assert.equal(
      resolveShamCashApiBaseUrl("https://custom.example/v1/"),
      "https://custom.example/v1",
    );
  });
});
