import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapProviderStatusResponse } from "../services/sham-cash/map-response.ts";

describe("mapProviderStatusResponse", () => {
  it("defaults to pending until provider schema is mapped", () => {
    const result = mapProviderStatusResponse("pay_123", { status: "unknown_value" });
    assert.equal(result.providerPaymentId, "pay_123");
    assert.equal(result.status, "pending");
    assert.deepEqual(result.raw, { status: "unknown_value" });
  });
});
