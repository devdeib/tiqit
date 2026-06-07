import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amountsMatch,
  findPaymentTransaction,
  isWithinDateWindow,
} from "../services/sham-cash/transaction-matcher.ts";
import {
  extractTransactionsFromResponse,
  parseShamCashTransaction,
} from "../services/sham-cash/transactions-api.ts";

const payment = {
  id: "pay-1",
  order_id: "order-1",
  reference_code: "TIQIT-ABCD1234",
  amount: 15000,
  currency: "SYP",
  created_at: "2026-06-04T12:00:00.000Z",
};

const matchingTx = {
  transaction_id: "txn_001",
  amount: 15000,
  currency: "SYP",
  occurred_at: "2026-06-04T12:05:00.000Z",
  sender_name: "Guest",
  sender_address: "+963900000001",
  receiver_account: "TIQIT-WALLET",
  direction: "incoming",
  note: "TIQIT-ABCD1234",
};

describe("findPaymentTransaction", () => {
  it("matches transaction by note, amount, and currency", async () => {
    const result = await findPaymentTransaction(payment, {
      listTransactions: async () => [matchingTx],
      now: () => new Date("2026-06-04T12:10:00.000Z"),
    });

    assert.deepEqual(result, matchingTx);
  });

  it("returns null when note does not match reference code", async () => {
    const result = await findPaymentTransaction(payment, {
      listTransactions: async () => [{ ...matchingTx, note: "TIQIT-OTHER12" }],
      now: () => new Date("2026-06-04T12:10:00.000Z"),
    });

    assert.equal(result, null);
  });

  it("returns null when amount mismatches", async () => {
    const result = await findPaymentTransaction(payment, {
      listTransactions: async () => [{ ...matchingTx, amount: 14999 }],
      now: () => new Date("2026-06-04T12:10:00.000Z"),
    });

    assert.equal(result, null);
  });

  it("returns null when transaction occurred before payment window", async () => {
    const result = await findPaymentTransaction(payment, {
      listTransactions: async () => [
        { ...matchingTx, occurred_at: "2026-06-04T11:00:00.000Z" },
      ],
      now: () => new Date("2026-06-04T12:10:00.000Z"),
    });

    assert.equal(result, null);
  });
});

describe("amountsMatch", () => {
  it("allows minor floating point tolerance", () => {
    assert.equal(amountsMatch(100.001, 100), true);
    assert.equal(amountsMatch(100.02, 100), false);
  });
});

describe("parseShamCashTransaction", () => {
  it("parses documented transaction fields", () => {
    const parsed = parseShamCashTransaction({
      transaction_id: "txn_123",
      amount: 100,
      currency: "SYP",
      occurred_at: "2026-06-04T12:00:00.000Z",
      sender_name: "Ali",
      sender_address: "wallet-1",
      note: "TIQIT-ABCD1234",
    });

    assert.equal(parsed?.transaction_id, "txn_123");
    assert.equal(parsed?.note, "TIQIT-ABCD1234");
  });

  it("returns null when required fields are missing", () => {
    assert.equal(parseShamCashTransaction({ transaction_id: "txn_123" }), null);
  });
});

describe("extractTransactionsFromResponse", () => {
  it("extracts nested transactions array", () => {
    const rows = extractTransactionsFromResponse({
      transactions: [{ transaction_id: "a", amount: 1, currency: "SYP", occurred_at: "t", note: "n" }],
    });
    assert.equal(rows.length, 1);
  });

  it("extracts array wrapped in value", () => {
    const rows = extractTransactionsFromResponse({
      value: [{ transaction_id: "b" }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transaction_id, "b");
  });
});

describe("isWithinDateWindow", () => {
  it("includes occurred_at between start and end", () => {
    const start = new Date("2026-06-04T12:00:00.000Z");
    const end = new Date("2026-06-04T13:00:00.000Z");
    assert.equal(isWithinDateWindow("2026-06-04T12:30:00.000Z", start, end), true);
    assert.equal(isWithinDateWindow("2026-06-04T11:59:00.000Z", start, end), false);
  });
});
