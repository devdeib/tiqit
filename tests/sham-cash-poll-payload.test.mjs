import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPollEventId,
  buildPollWebhookPayload,
} from "../services/sham-cash/poll-payload.ts";

describe("buildPollWebhookPayload", () => {
  it("builds deterministic poll event id", () => {
    assert.equal(buildPollEventId("pay_abc", "completed"), "poll:pay_abc:completed");
  });

  it("builds webhook-compatible completed payload", () => {
    const { payload, rawBody } = buildPollWebhookPayload({
      providerPaymentId: "pay_abc",
      status: "completed",
      amount: 150,
      orderId: "00000000-0000-0000-0000-000000000001",
    });

    assert.equal(payload.status, "completed");
    assert.equal(payload.providerEventId, "poll:pay_abc:completed");

    const parsed = JSON.parse(rawBody);
    assert.equal(parsed.payment_id, "pay_abc");
    assert.equal(parsed.source, "api_poll");
  });
});
