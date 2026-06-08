import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSACTION_VERIFICATION_MESSAGES,
  verifySubmittedTransaction,
} from "../services/sham-cash/transaction-verifier.ts";

const tiqitAccount = "TIQIT-WALLET-001";
const paymentCreatedAt = "2026-06-04T12:00:00.000Z";

function buildTx(overrides = {}) {
  return {
    transaction_id: "txn_001",
    identifiers: ["txn_001"],
    amount: 15000,
    currency: "SYP",
    occurred_at: "2026-06-04T12:05:00.000Z",
    sender_name: "Guest",
    sender_address: "+963900000001",
    receiver_account: tiqitAccount,
    direction: "incoming",
    note: "TIQIT-ABCD1234",
    ...overrides,
  };
}

describe("verifySubmittedTransaction", () => {
  it("accepts ShamCash naive occurred_at within payment window", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "262081418",
        expectedAmount: 5,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt: "2026-06-08T08:44:50.000Z",
      },
      {
        listTransactions: async () => [
          buildTx({
            transaction_id: "262081418",
            identifiers: ["262081418"],
            amount: 5,
            occurred_at: "2026-06-08T11:44:43",
          }),
        ],
        now: () => new Date("2026-06-08T09:00:00.000Z"),
      },
    );

    assert.equal(result.ok, true);
  });

  it("accepts a valid incoming transaction via direct transaction_id lookup", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "184627893",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [
          buildTx({ transaction_id: "184627893", identifiers: ["184627893"] }),
        ],
        now: () => new Date("2026-06-04T12:10:00.000Z"),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.transaction.transaction_id, "184627893");
  });

  it("finds transaction through recent list when user id matches reference field", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "26100263",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [
          buildTx({
            transaction_id: "acc_tx_internal_uuid",
            identifiers: ["acc_tx_internal_uuid", "26100263"],
          }),
        ],
        now: () => new Date("2026-06-04T12:10:00.000Z"),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.transaction.transaction_id, "acc_tx_internal_uuid");
  });

  it("matches alternate id formats (numeric vs string)", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "26100263",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [
          buildTx({
            transaction_id: "26100263",
            identifiers: ["26100263", 26100263].map(String),
          }),
        ],
        now: () => new Date("2026-06-04T12:10:00.000Z"),
      },
    );

    assert.equal(result.ok, true);
  });

  it("returns id mismatch when amount matches but submitted id does not", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "wrong-id",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [
          buildTx({ transaction_id: "26100263", identifiers: ["26100263"] }),
        ],
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.idMismatch);
  });

  it("returns not synced yet when API returns no transactions", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "26100263",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      { listTransactions: async () => [] },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.notSyncedYet);
  });

  it("rejects when transaction id is not found among recent transactions", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "missing",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      { listTransactions: async () => [buildTx({ amount: 99999 })] },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.notFound);
  });

  it("rejects outgoing transactions with exact reason", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "txn_001",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [buildTx({ direction: "outgoing" })],
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.notIncoming);
  });

  it("rejects wrong receiver account", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "txn_001",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [buildTx({ receiver_account: "OTHER-ACCOUNT" })],
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.wrongReceiver);
  });

  it("rejects amount mismatch", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "txn_001",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [buildTx({ amount: 14000 })],
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.amountMismatch);
  });
});
