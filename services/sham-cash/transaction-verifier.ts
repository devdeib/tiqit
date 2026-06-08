import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  ShamCashConfigurationError,
  ShamCashError,
  ShamCashNetworkError,
  ShamCashProviderError,
  ShamCashTimeoutError,
} from "./errors";
import { resolveShamCashApiAccountId, listShamCashAccounts } from "./accounts";
import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { createShamCashHttpClient } from "./http-client";
import type { ShamCashListTransactionsQuery } from "./api-types";
import {
  extractTransactionsFromResponse,
  isIncomingTransaction,
  parseShamCashTransaction,
  receiverAccountMatchesAny,
  summarizeRawTransactionForLog,
  transactionMatchesSubmittedId,
  currencyToCoinId,
} from "./transactions-api";
import {
  logVerificationAccountContext,
  logVerificationAccountsComparison,
  logVerificationTransactionsSummary,
  responseContainsSubmittedTransactionId,
} from "./transaction-lookup-log";
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
  configuredApiAccountId?: string;
  paymentCreatedAt: string;
};

export type TransactionVerificationResult =
  | { ok: true; transaction: ShamCashTransaction }
  | { ok: false; reason: string };

export const TRANSACTION_VERIFICATION_MESSAGES = {
  notFound: "Transaction not found. Check the ID and try again.",
  notSyncedYet:
    "Transaction not synced yet. Wait a few minutes for Sham Cash to update, then try again.",
  idMismatch:
    "Transaction ID does not match Sham Cash records. Use the ID shown on your payment receipt.",
  notIncoming: "This transaction is not an incoming payment.",
  wrongReceiver: "Payment was not sent to the correct Sham Cash account.",
  amountMismatch: "Transaction amount does not match your order total.",
  currencyMismatch: "Transaction currency does not match your order.",
  outsideWindow: "Transaction is outside the valid payment window.",
  apiUnavailable: "Payment verification is temporarily unavailable. Please try again shortly.",
  invalidAccount:
    "Sham Cash verification account is not configured. In Admin → Payment settings, select the verification account linked to your API key.",
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
  let lookupDebug: VerificationLookupDebug | undefined;

  try {
    if (deps.listTransactions) {
      transactions = await deps.listTransactions();
    } else {
      apiAccountId = await resolveShamCashApiAccountId(
        displayAccountId,
        deps.httpClientDeps,
        input.configuredApiAccountId,
      );
      const fetched = await fetchTransactionsForVerification(
        apiAccountId,
        displayAccountId,
        transactionId,
        input.paymentCreatedAt,
        input.expectedCurrency,
        input.configuredApiAccountId,
        deps.httpClientDeps,
      );
      transactions = fetched.transactions;
      lookupDebug = fetched.debug;
    }
  } catch (err) {
    return { ok: false, reason: mapShamCashErrorToUserMessage(err) };
  }

  const window = computeVerificationWindow(input.paymentCreatedAt, deps);
  const idMatches = transactions.filter((tx) =>
    transactionMatchesSubmittedId(tx, transactionId),
  );

  if (idMatches.length === 0) {
    logVerificationLookup({
      submittedId: transactionId,
      apiAccountId,
      displayAccountId,
      transactionCount: transactions.length,
      idMatchCount: 0,
      lookupDebug,
      sampleTransactions: transactions.slice(0, 5).map((tx) => ({
        transaction_id: tx.transaction_id,
        identifiers: tx.identifiers,
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction,
        receiver_account: tx.receiver_account,
      })),
    });

    const financialMatches = findFinancialMatches(
      transactions,
      input,
      displayAccountId,
      apiAccountId,
    );
    if (financialMatches.length > 0) {
      return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.idMismatch };
    }

    if (transactions.length === 0) {
      return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notSyncedYet };
    }

    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.notFound };
  }

  let lastFailure: string | null = null;
  for (const transaction of idMatches) {
    const result = validateMatchedTransaction(
      transaction,
      input,
      displayAccountId,
      apiAccountId,
      window,
    );
    if (result.ok) {
      logVerificationLookup({
        submittedId: transactionId,
        apiAccountId,
        displayAccountId,
        transactionCount: transactions.length,
        idMatchCount: idMatches.length,
        matchedTransactionId: transaction.transaction_id,
        lookupDebug,
      });
      return result;
    }
    lastFailure = result.reason;
  }

  return { ok: false, reason: lastFailure ?? TRANSACTION_VERIFICATION_MESSAGES.notFound };
}

type VerificationLookupDebug = {
  queriesExecuted: number;
  rawRowCount: number;
  rawSamples: Record<string, unknown>[];
};

function validateMatchedTransaction(
  transaction: ShamCashTransaction,
  input: TransactionVerificationInput,
  displayAccountId: string,
  apiAccountId: string,
  window: { start: Date; end: Date },
): TransactionVerificationResult {
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
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.currencyMismatch };
  }

  if (!isWithinDateWindow(transaction.occurred_at, window.start, window.end)) {
    return { ok: false, reason: TRANSACTION_VERIFICATION_MESSAGES.outsideWindow };
  }

  return { ok: true, transaction };
}

function findFinancialMatches(
  transactions: ShamCashTransaction[],
  input: TransactionVerificationInput,
  displayAccountId: string,
  apiAccountId: string,
): ShamCashTransaction[] {
  return transactions.filter((tx) => {
    if (isIncomingTransaction(tx) === false) return false;
    if (!receiverAccountMatchesAny(tx.receiver_account, [displayAccountId, apiAccountId])) {
      return false;
    }
    if (!amountsMatch(tx.amount, input.expectedAmount)) return false;
    return normalizeCurrency(tx.currency) === normalizeCurrency(input.expectedCurrency);
  });
}

function logVerificationLookup(context: Record<string, unknown>): void {
  logger.info("sham_cash_verification_lookup", context);
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
  expectedCurrency: string,
  configuredApiAccountId: string | undefined,
  httpClientDeps?: TransactionMatcherDeps["httpClientDeps"],
): Promise<{ transactions: ShamCashTransaction[]; debug: VerificationLookupDebug }> {
  const client = createShamCashHttpClient(
    httpClientDeps ?? {
      getApiKey: () => getShamCashApiToken(),
      getBaseUrl: () => resolveShamCashApiBaseUrl(getServerEnv().SHAM_CASH_API_BASE_URL),
    },
  );

  logVerificationAccountContext({
    submittedTransactionId: transactionId,
    displayWalletId: displayAccountId,
    configuredApiAccountId: configuredApiAccountId?.trim() || null,
    envApiAccountId: process.env.SHAM_CASH_API_ACCOUNT_ID?.trim() || null,
    resolvedApiAccountId: apiAccountId,
  });

  try {
    const linkedAccounts = await listShamCashAccounts(httpClientDeps);
    logVerificationAccountsComparison({
      resolvedApiAccountId: apiAccountId,
      displayWalletId: displayAccountId,
      configuredApiAccountId: configuredApiAccountId?.trim() || null,
      linkedAccounts: linkedAccounts.map((account) => ({
        id: account.id,
        label: account.label,
        status: account.status,
        wallet_id:
          typeof account.raw.wallet_id === "string" ? account.raw.wallet_id : null,
        phone: typeof account.raw.phone === "string" ? account.raw.phone : null,
      })),
    });
  } catch (err) {
    logger.warn("sham_cash_verification_accounts_check_failed", {
      resolvedApiAccountId: apiAccountId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  const coinId = currencyToCoinId(expectedCurrency);
  const startAt = formatTransactionQueryStart(paymentCreatedAt);

  const queries: Array<{ query: ShamCashListTransactionsQuery; label: string }> = [
    { query: { accountId: apiAccountId, startAt, coinId, limit: 100 }, label: "recent_date_coin" },
    { query: { accountId: apiAccountId, startAt, limit: 100 }, label: "recent_date" },
    { query: { accountId: apiAccountId, coinId, limit: 100 }, label: "recent_coin" },
    { query: { accountId: apiAccountId, limit: 100 }, label: "unfiltered" },
    {
      query: { accountId: apiAccountId, transactionIds: transactionId, coinId, limit: 20 },
      label: "direct_id_coin",
    },
    {
      query: { accountId: apiAccountId, transactionIds: transactionId, limit: 20 },
      label: "direct_id",
    },
  ];

  const merged = new Map<string, ShamCashTransaction>();
  const rawSamples: Record<string, unknown>[] = [];
  let rawRowCount = 0;
  let queriesExecuted = 0;
  let submittedIdSeenInAnyResponse = false;
  let unfilteredQueryReturnedData = false;

  for (const { query, label } of queries) {
    queriesExecuted += 1;
    const { parsed, rawRows, responseData } = await loadParsedTransactions(
      client,
      query,
      displayAccountId,
      apiAccountId,
      label,
    );
    rawRowCount += rawRows.length;

    if (responseContainsSubmittedTransactionId(responseData, transactionId)) {
      submittedIdSeenInAnyResponse = true;
    }

    if (label === "unfiltered" && rawRows.length > 0) {
      unfilteredQueryReturnedData = true;
    }

    for (const row of rawRows.slice(0, 3)) {
      if (rawSamples.length < 5) rawSamples.push(summarizeRawTransactionForLog(row));
    }

    for (const tx of parsed) {
      const key = tx.identifiers.join("|") || tx.transaction_id;
      merged.set(key, tx);
    }

    if ([...merged.values()].some((tx) => transactionMatchesSubmittedId(tx, transactionId))) {
      break;
    }
  }

  logVerificationTransactionsSummary({
    submittedTransactionId: transactionId,
    resolvedApiAccountId: apiAccountId,
    queriesExecuted,
    totalRawRows: rawRowCount,
    submittedIdSeenInAnyResponse,
    unfilteredQueryReturnedData,
  });

  return {
    transactions: [...merged.values()],
    debug: { queriesExecuted, rawRowCount, rawSamples },
  };
}

async function loadParsedTransactions(
  client: ReturnType<typeof createShamCashHttpClient>,
  query: ShamCashListTransactionsQuery,
  displayAccountId: string,
  apiAccountId: string,
  queryLabel: string,
): Promise<{
  parsed: ShamCashTransaction[];
  rawRows: Record<string, unknown>[];
  responseData: unknown;
}> {
  const response = await client.listTransactions(query, { queryLabel });
  const responseData = response.data ?? response.raw;
  const rawRows = extractTransactionsFromResponse(responseData);
  const parsed: ShamCashTransaction[] = [];

  for (const row of rawRows) {
    const transaction = parseShamCashTransaction(row, {
      accountId: apiAccountId || displayAccountId,
    });
    if (transaction) parsed.push(transaction);
  }

  return { parsed, rawRows, responseData };
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
