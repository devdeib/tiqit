import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accountMatchesHint,
  resolveShamCashApiAccountId,
} from "../services/sham-cash/accounts.ts";
import { transactionIdsMatch } from "../services/sham-cash/transactions-api.ts";

describe("transactionIdsMatch", () => {
  it("matches numeric and string forms", () => {
    assert.equal(transactionIdsMatch("26100263", "26100263"), true);
    assert.equal(transactionIdsMatch("26100263", " 26100263 "), true);
  });
});

describe("resolveShamCashApiAccountId", () => {
  it("prefers explicit env account id", async () => {
    const previous = process.env.SHAM_CASH_API_ACCOUNT_ID;
    process.env.SHAM_CASH_API_ACCOUNT_ID = "api-acc-123";
    try {
      const id = await resolveShamCashApiAccountId("wallet-999", {
        getApiKey: () => "token",
        getBaseUrl: () => undefined,
        fetchImpl: async () => {
          throw new Error("should not fetch accounts when env is set");
        },
      });
      assert.equal(id, "api-acc-123");
    } finally {
      if (previous === undefined) delete process.env.SHAM_CASH_API_ACCOUNT_ID;
      else process.env.SHAM_CASH_API_ACCOUNT_ID = previous;
    }
  });

  it("matches linked account by display wallet hint", async () => {
    const id = await resolveShamCashApiAccountId("wallet-777", {
      getApiKey: () => "token",
      getBaseUrl: () => undefined,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: "success",
            code: "SUCCESS",
            message: "ok",
            data: [
              { id: "acc-a", wallet_id: "wallet-111", status: "active" },
              { id: "acc-b", wallet_id: "wallet-777", status: "active" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    assert.equal(id, "acc-b");
  });
});

describe("accountMatchesHint", () => {
  it("matches wallet_id field", () => {
    assert.equal(accountMatchesHint({ wallet_id: "wallet-777" }, "wallet-777"), true);
    assert.equal(accountMatchesHint({ wallet_id: "wallet-777" }, "other"), false);
  });
});
