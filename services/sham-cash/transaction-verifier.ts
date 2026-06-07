import { getServerEnv } from "@/lib/env";
import {
  ShamCashConfigurationError,
  ShamCashError,
  ShamCashNetworkError,
  ShamCashProviderError,
  ShamCashTimeoutError,
} from "./errors";
import { resolveShamCashApiAccountId } from "./accounts";
import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { createShamCashHttpClient } from "./http-client";
import type { ShamCashListTransactionsQuery } from "./api-types";
import {
  extractTransactionsFromResponse,
  isIncomingTransaction,
  parseShamCashTransaction,
  receiverAccountMatchesAny,
  transactionIdsMatch,
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
  notFound:
    "Transaction not found. Check the ID and try again. It can take a few minutes to appear in Sham Cash.",
  notIncoming: "This transaction is not an incoming payment.",
  wrongReceiver: "Payment was not sent to the correct Sham Cash account.",
  amountMismatch: "Transaction amount does not match your order total.",
  outsideWindow: "Transaction is outside the valid payment window.",
  apiUnavailable: "Payment verification is temporarily unavailable. Please try again shortly.",
  invalidAccount:
    "Sham Cash verification account is not configured. Set SHAM_CASH_API_ACCOUNT_ID or link an account on shamcash-api.com.",
} as const;

export async function verifySubmittedTransaction(
  input: TransactionVerificationInput,
  deps: TransactionMatcherDeps = {},
): Promise<TransactionVerificationResult> {
  const transactionId = input.transactionId.trim();
  const displayAccountId = input.tiqitAccountId.trim();

  if (!transactionId) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notFound };
  }

  if (!displayAccountId) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.invalidAccount };
  }

  let transactions: ShamCashTransaction[];
  let apiAccountId = displayAccountId;

  try {
    if (deps.listTransactions) {
      transactions = await deps.listTransactions();
    } else {
      apiAccountId = await resolveShamCashApiAccountId(displayAccountId, deps.httpClientDeps);
      transactions = await fetchTransactionsForVerification(
        apiAccountId,
        displayAccountId,
        transactionId,
        input.paymentCreatedAt,
        deps.httpClientDeps,
      );
    }
  } catch (err) {
    return { ok: false, reason: mapShamCashErrorToUserMessage(err) };
  }

  const transaction = transactions.find((tx) => transactionIdsMatch(tx.transaction_id, transactionId));
  if (!transaction) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notFound };
  }

  const incoming = isIncomingTransaction(transaction);
  if (incoming === false) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notIncoming };
  }

  if (
    !receiverAccountMatchesAny(transaction.receiver_account, [displayAccountId, apiAccountId])
  ) {
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

function mapShamCashErrorToUserMessage(error: unknown): string {
  if (error instanceof ShamCashConfigurationError) {
    return TRANSACTION_VERIFICATION_MESSAGES.invalidAccount;
  }
  if (error instanceof ShamCashTimeoutError || error instanceof ShamCashNetworkError) {
    return TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable;
  }
  if (error instanceof ShamCashProviderError) {
    if (error.providerCode === "SUBSCRIPTION_UNAVAILABLE") {
      return error.message;
    }
    if (error.providerCode === "VALIDATION_ERROR") {
      return TRANSACTION_VERIFICATION_MESSAGES.invalidAccount;
    }
    if (error.httpStatus === 401 || error.httpStatus === 403) {
      return TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable;
    }
    return TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable;
  }
  if (error instanceof ShamCashError) {
    return TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable;
  }
  return TRANSACTION_VERIFICATION_MESSAGES.apiUnavailable;
}

async function fetchTransactionsForVerification(
  apiAccountId: string,
  displayAccountId: string,
  transactionId: string,
  paymentCreatedAt: string,
  httpClientDeps?: TransactionMatcherDeps["httpClientDeps"],
): Promise<ShamCashTransaction[]> {
  const client = createShamCashHttpClient(
    httpClientDeps ?? {
      getApiKey: () => getShamCashApiToken(),
      getBaseUrl: () => resolveShamCashApiBaseUrl(getServerEnv().SHAM_CASH_API_BASE_URL),
    },
  );

  const queries: ShamCashListTransactionsQuery[] = [
    { accountId: apiAccountId, transactionIds: transactionId, limit: 20 },
    {
      accountId: apiAccountId,
      transactionIds: transactionId,
      startAt: formatTransactionQueryStart(paymentCreatedAt),
      limit: 20,
    },
    {
      accountId: apiAccountId,
      startAt: formatTransactionQueryStart(paymentCreatedAt),
      limit: 100,
    },
  ];

  const merged = new Map<string, ShamCashTransaction>();

  for (const query of queries) {
    const parsed = await loadParsedTransactions(client, query, displayAccountId, apiAccountId);
    for (const tx of parsed) {
      merged.set(tx.transaction_id, tx);
    }
    if ([...merged.values()].some((tx) => transactionIdsMatch(tx.transaction_id, transactionId))) {
      break;
    }
  }

  return [...merged.values()];
}

async function loadParsedTransactions(
  client: ReturnType<typeof createShamCashHttpClient>,
  query: ShamCashListTransactionsQuery,
  displayAccountId: string,
  apiAccountId: string,
): Promise<ShamCashTransaction[]> {
  const response = await client.listTransactions(query);
  const rows = extractTransactionsFromResponse(response.data ?? response.raw);
  const parsed: ShamCashTransaction[] = [];

  for (const row of rows) {
    const transaction = parseShamCashTransaction(row, {
      accountId: apiAccountId || displayAccountId,
    });
    if (transaction) parsed.push(transaction);
  }

  return parsed;
}

function formatTransactionQueryStart(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - 7);
    return today.toISOString().slice(0, 10);
  }
  created.setUTCDate(created.getUTCDate() - 7);
  return created.toISOString().slice(0, 10);
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
