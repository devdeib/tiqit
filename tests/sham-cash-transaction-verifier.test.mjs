import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSACTION_VERIFICATION_MESSAGES,
  verifySubmittedTransaction,
} from "../services/sham-cash/transaction-verifier.ts";

const tiqitAccount = "TIQIT-WALLET-001";
const paymentCreatedAt = "2026-06-04T12:00:00.000Z";

const validTx = {
  transaction_id: "txn_001",
  amount: 15000,
  currency: "SYP",
  occurred_at: "2026-06-04T12:05:00.000Z",
  sender_name: "Guest",
  sender_address: "+963900000001",
  receiver_account: tiqitAccount,
  direction: "incoming",
  note: "TIQIT-ABCD1234",
};

describe("verifySubmittedTransaction", () => {
  it("accepts a valid incoming transaction to the Tiqit account", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "txn_001",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [validTx],
        now: () => new Date("2026-06-04T12:10:00.000Z"),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.transaction.transaction_id, "txn_001");
  });

  it("rejects when transaction id is not found", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "missing",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      { listTransactions: async () => [validTx] },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.notFound);
  });

  it("rejects outgoing transactions", async () => {
    const result = await verifySubmittedTransaction(
      {
        transactionId: "txn_001",
        expectedAmount: 15000,
        expectedCurrency: "SYP",
        tiqitAccountId: tiqitAccount,
        paymentCreatedAt,
      },
      {
        listTransactions: async () => [{ ...validTx, direction: "outgoing" }],
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
        listTransactions: async () => [{ ...validTx, receiver_account: "OTHER-ACCOUNT" }],
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
        listTransactions: async () => [{ ...validTx, amount: 14000 }],
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, TRANSACTION_VERIFICATION_MESSAGES.amountMismatch);
  });
});
