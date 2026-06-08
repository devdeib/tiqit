import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertShamCashSuccessEnvelope,
  unwrapShamCashEnvelopeData,
} from "../services/sham-cash/envelope.ts";
import { ShamCashProviderError } from "../services/sham-cash/errors.ts";
import { parseShamCashTransaction, transactionMatchesSubmittedId } from "../services/sham-cash/transactions-api.ts";

describe("assertShamCashSuccessEnvelope", () => {
  it("throws on error envelope even when HTTP would be 200", () => {
    assert.throws(
      () =>
        assertShamCashSuccessEnvelope({
          status: "error",
          code: "VALIDATION_ERROR",
          message: "account_id is required",
          data: null,
        }),
      (error) => error instanceof ShamCashProviderError,
    );
  });
});

describe("unwrapShamCashEnvelopeData", () => {
  it("returns data payload from success envelope", () => {
    const rows = [{ transaction_id: 123, amount: 10 }];
    assert.deepEqual(
      unwrapShamCashEnvelopeData({
        status: "success",
        code: "SUCCESS",
        message: "ok",
        data: rows,
      }),
      rows,
    );
  });
});

describe("parseShamCashTransaction", () => {
  it("parses numeric transaction_id and coin_id currency", () => {
    const parsed = parseShamCashTransaction(
      {
        transaction_id: 184627893,
        amount: 15000,
        coin_id: 2,
        occurred_at: "2026-04-16T01:22:21+03:00",
        account_id: "acc-123",
      },
      { accountId: "acc-123" },
    );

    assert.equal(parsed?.transaction_id, "184627893");
    assert.deepEqual(parsed?.identifiers, ["184627893"]);
    assert.equal(parsed?.currency, "SYP");
    assert.equal(parsed?.receiver_account, "acc-123");
    assert.equal(parsed?.direction, "incoming");
  });

  it("parses live ShamCash response without currency field", () => {
    const parsed = parseShamCashTransaction({
      transaction_id: 262081418,
      amount: 5,
      occurred_at: "2026-06-08T11:44:43",
    });

    assert.ok(parsed);
    assert.equal(parsed.transaction_id, "262081418");
    assert.deepEqual(parsed.identifiers, ["262081418"]);
    assert.equal(parsed.amount, 5);
    assert.equal(parsed.currency, "SYP");
    assert.equal(parsed.occurred_at, "2026-06-08T11:44:43");
    assert.equal(transactionMatchesSubmittedId(parsed, "262081418"), true);
  });

  it("parses full ShamCash transaction field shape", () => {
    const parsed = parseShamCashTransaction({
      transaction_id: 262081418,
      amount: 5,
      currency: "SYP",
      occurred_at: "2026-06-08T11:44:43",
      receiver_name: "tiqit",
      sender_name: "Guest",
      sender_address: "+963900000001",
      note: "TIQIT-ABCD1234",
    });

    assert.equal(parsed?.transaction_id, "262081418");
    assert.deepEqual(parsed?.identifiers, ["262081418"]);
    assert.equal(parsed?.sender_name, "Guest");
    assert.equal(parsed?.sender_address, "+963900000001");
    assert.equal(parsed?.note, "TIQIT-ABCD1234");
  });
});
