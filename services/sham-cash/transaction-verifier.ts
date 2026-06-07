import { getServerEnv } from "@/lib/env";
import { ShamCashConfigurationError } from "./errors";
import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { createShamCashHttpClient } from "./http-client";
import {
  extractTransactionsFromResponse,
  isIncomingTransaction,
  parseShamCashTransaction,
  receiverAccountMatches,
} from "./transactions-api";
import {
  amountsMatch,
  isWithinDateWindow,
  normalizeCurrency,
  type ShamCashTransaction,
  type TransactionMatcherDeps,
} from "./transaction-matcher";

export type TransactionVerificationInput = {
  transactionId: string;
  expectedAmount: number;
  expectedCurrency: string;
  tiqitAccountId: string;
  paymentCreatedAt: string;
};

export type TransactionVerificationResult =
  | { ok: true; transaction: ShamCashTransaction }
  | { ok: false; reason: string };

export const TRANSACTION_VERIFICATION_MESSAGES = {
  notFound: "Transaction not found. Check the ID and try again.",
  notIncoming: "This transaction is not an incoming payment.",
  wrongReceiver: "Payment was not sent to the correct Sham Cash account.",
  amountMismatch: "Transaction amount does not match your order total.",
  outsideWindow: "Transaction is outside the valid payment window.",
  apiUnavailable: "Payment verification is temporarily unavailable. Please try again shortly.",
} as const;

export async function verifySubmittedTransaction(
  input: TransactionVerificationInput,
  deps: TransactionMatcherDeps = {},
): Promise<TransactionVerificationResult> {
  const transactionId = input.transactionId.trim();
  if (!transactionId) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notFound };
  }

  let transactions: ShamCashTransaction[];
  try {
    transactions = deps.listTransactions
      ? await deps.listTransactions()
      : await fetchTransactionsFromProvider(deps.httpClientDeps);
  } catch (err) {
    if (err instanceof ShamCashConfigurationError) {
      return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable };
    }
    throw err;
  }

  const transaction = transactions.find((tx) => tx.transaction_id === transactionId);
  if (!transaction) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notFound };
  }

  const incoming = isIncomingTransaction(transaction);
  if (incoming === false) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notIncoming };
  }
  if (incoming === null) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notIncoming };
  }

  if (!receiverAccountMatches(transaction.receiver_account, input.tiqitAccountId)) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.wrongReceiver };
  }

  if (!amountsMatch(transaction.amount, input.expectedAmount)) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.amountMismatch };
  }

  if (
    normalizeCurrency(transaction.currency) !== normalizeCurrency(input.expectedCurrency)
  ) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.amountMismatch };
  }

  const window = computeVerificationWindow(input.paymentCreatedAt, deps);
  if (!isWithinDateWindow(transaction.occurred_at, window.start, window.end)) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.outsideWindow };
  }

  return { ok: true, transaction };
}

async function fetchTransactionsFromProvider(
  httpClientDeps?: TransactionMatcherDeps["httpClientDeps"],
): Promise<ShamCashTransaction[]> {
  const client = createShamCashHttpClient(
    httpClientDeps ?? {
      getApiKey: () => getShamCashApiToken(),
      getBaseUrl: () => resolveShamCashApiBaseUrl(getServerEnv().SHAM_CASH_API_BASE_URL),
    },
  );

  const response = await client.listTransactions();
  const rows = extractTransactionsFromResponse(response.raw);
  const parsed: ShamCashTransaction[] = [];

  for (const row of rows) {
    const transaction = parseShamCashTransaction(row);
    if (transaction) parsed.push(transaction);
  }

  return parsed;
}

function computeVerificationWindow(
  createdAt: string,
  deps: TransactionMatcherDeps,
): { start: Date; end: Date } {
  const createdMs = new Date(createdAt).getTime();
  const clockSkewMs = deps.clockSkewMs ?? 5 * 60 * 1000;
  const maxWindowMs = deps.maxVerificationWindowMs ?? 7 * 24 * 60 * 60 * 1000;
  const end = deps.now?.() ?? new Date();

  return {
    start: new Date(createdMs - clockSkewMs),
    end: new Date(Math.min(end.getTime(), createdMs + maxWindowMs)),
  };
}
