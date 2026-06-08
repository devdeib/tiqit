import { resolveShamCashApiAccountId } from "./accounts";
import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { getServerEnv } from "@/lib/env";
import { createShamCashHttpClient } from "./http-client";
import {
  extractTransactionsFromResponse,
  isIncomingTransaction,
  parseShamCashTransaction,
  receiverAccountMatchesAny,
  transactionMatchesSubmittedId,
} from "./transactions-api";
import type { ShamCashHttpClientDeps } from "./http-client";
import { logger } from "@/lib/logger";

export type PaymentForMatching = {
  id: string;
  order_id: string;
  reference_code: string;
  amount: number;
  currency: string;
  created_at: string;
};

export type ShamCashTransaction = {
  transaction_id: string;
  /** All known ids from the provider record (id, reference, external_id, etc.). */
  identifiers: string[];
  amount: number;
  currency: string;
  occurred_at: string;
  sender_name: string;
  sender_address: string;
  receiver_account: string;
  direction: "incoming" | "outgoing" | "unknown";
  note: string;
};

export type TransactionMatcherDeps = {
  httpClientDeps?: ShamCashHttpClientDeps;
  accountId?: string;
  displayAccountId?: string;
  listTransactions?: () => Promise<ShamCashTransaction[]>;
  clockSkewMs?: number;
  maxVerificationWindowMs?: number;
  now?: () => Date;
};

const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_VERIFICATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function findPaymentTransaction(
  payment: PaymentForMatching,
  deps: TransactionMatcherDeps = {},
): Promise<ShamCashTransaction | null> {
  const displayAccountId = deps.displayAccountId?.trim() ?? deps.accountId?.trim();
  if (!deps.listTransactions && !displayAccountId) {
    return null;
  }

  const transactions = deps.listTransactions
    ? await deps.listTransactions()
    : await (async () => {
        const resolvedAccountId = await resolveShamCashApiAccountId(
          displayAccountId!,
          deps.httpClientDeps,
        );
        return fetchTransactionsFromProvider(
          payment,
          resolvedAccountId,
          displayAccountId!,
          deps.httpClientDeps,
        );
      })();

  const window = computeVerificationWindow(payment.created_at, deps);

  for (const transaction of transactions) {
    if (!isWithinDateWindow(transaction.occurred_at, window.start, window.end)) continue;
    if (transaction.note !== payment.reference_code) continue;
    if (!amountsMatch(transaction.amount, payment.amount)) continue;
    if (normalizeCurrency(transaction.currency) !== normalizeCurrency(payment.currency)) continue;
    return transaction;
  }

  return null;
}

async function fetchTransactionsFromProvider(
  payment: PaymentForMatching,
  apiAccountId: string,
  displayAccountId: string,
  httpClientDeps?: ShamCashHttpClientDeps,
): Promise<ShamCashTransaction[]> {
  const client = createShamCashHttpClient(
    httpClientDeps ?? {
      getApiKey: () => getShamCashApiToken(),
      getBaseUrl: () => resolveShamCashApiBaseUrl(getServerEnv().SHAM_CASH_API_BASE_URL),
    },
  );

  const created = new Date(payment.created_at);
  if (!Number.isNaN(created.getTime())) {
    created.setUTCDate(created.getUTCDate() - 7);
  }

  const response = await client.listTransactions({
    accountId: apiAccountId,
    startAt: Number.isNaN(created.getTime())
      ? undefined
      : created.toISOString().slice(0, 10),
    limit: 100,
  });

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

function computeVerificationWindow(
  createdAt: string,
  deps: TransactionMatcherDeps,
): { start: Date; end: Date } {
  const createdMs = new Date(createdAt).getTime();
  const clockSkewMs = deps.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  const maxWindowMs = deps.maxVerificationWindowMs ?? DEFAULT_VERIFICATION_WINDOW_MS;
  const end = deps.now?.() ?? new Date();

  return {
    start: new Date(createdMs - clockSkewMs),
    end: new Date(Math.min(end.getTime(), createdMs + maxWindowMs)),
  };
}

export function isWithinDateWindow(
  occurredAt: string,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const occurredMs = new Date(occurredAt).getTime();
  if (Number.isNaN(occurredMs)) return false;
  return occurredMs >= windowStart.getTime() && occurredMs <= windowEnd.getTime();
}

export function amountsMatch(transactionAmount: number, paymentAmount: number): boolean {
  return Math.abs(transactionAmount - paymentAmount) < 0.01;
}

export function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

export type VerificationConditionCheck = {
  condition: string;
  paymentValue: unknown;
  transactionValue: unknown;
  passed: boolean;
};

export type VerificationConditionContext = {
  submittedTransactionId: string;
  expectedAmount: number;
  expectedCurrency: string;
  paymentCreatedAt: string;
  displayAccountId: string;
  apiAccountId: string;
  windowStart: string;
  windowEnd: string;
  /** Not validated in submit-payment flow; logged for comparison only. */
  expectedReferenceCode?: string | null;
};

export function evaluateVerificationConditions(
  transaction: ShamCashTransaction,
  context: VerificationConditionContext,
): VerificationConditionCheck[] {
  const incoming = isIncomingTransaction(transaction);
  const incomingPass = incoming !== false;
  const receiverCandidates = [context.displayAccountId, context.apiAccountId];
  const receiverPass = receiverAccountMatchesAny(transaction.receiver_account, receiverCandidates);
  const amountPass = amountsMatch(transaction.amount, context.expectedAmount);
  const currencyPass =
    normalizeCurrency(transaction.currency) === normalizeCurrency(context.expectedCurrency);
  const occurredMs = new Date(transaction.occurred_at).getTime();
  const windowStartMs = new Date(context.windowStart).getTime();
  const windowEndMs = new Date(context.windowEnd).getTime();
  const datePass =
    Number.isFinite(occurredMs) &&
    occurredMs >= windowStartMs &&
    occurredMs <= windowEndMs;
  const idPass = transactionMatchesSubmittedId(transaction, context.submittedTransactionId);
  const notePass =
    context.expectedReferenceCode === undefined || context.expectedReferenceCode === null
      ? null
      : transaction.note === context.expectedReferenceCode;

  const checks: VerificationConditionCheck[] = [
    {
      condition: "transaction_id_match",
      paymentValue: context.submittedTransactionId,
      transactionValue: {
        transaction_id: transaction.transaction_id,
        identifiers: transaction.identifiers,
      },
      passed: idPass,
    },
    {
      condition: "direction_incoming",
      paymentValue: "incoming (unknown direction treated as pass)",
      transactionValue: { direction: transaction.direction, isIncoming: incoming },
      passed: incomingPass,
    },
    {
      condition: "receiver_account",
      paymentValue: receiverCandidates,
      transactionValue: transaction.receiver_account,
      passed: receiverPass,
    },
    {
      condition: "amount",
      paymentValue: context.expectedAmount,
      transactionValue: transaction.amount,
      passed: amountPass,
    },
    {
      condition: "currency",
      paymentValue: normalizeCurrency(context.expectedCurrency),
      transactionValue: normalizeCurrency(transaction.currency),
      passed: currencyPass,
    },
    {
      condition: "date_window",
      paymentValue: { start: context.windowStart, end: context.windowEnd },
      transactionValue: transaction.occurred_at,
      passed: datePass,
    },
  ];

  if (notePass !== null) {
    checks.push({
      condition: "note_reference_match",
      paymentValue: context.expectedReferenceCode,
      transactionValue: transaction.note,
      passed: notePass,
    });
  } else {
    checks.push({
      condition: "note_reference_match",
      paymentValue: "not_checked_in_submit_payment_flow",
      transactionValue: transaction.note,
      passed: true,
    });
  }

  return checks;
}

export function firstFailingCondition(
  checks: VerificationConditionCheck[],
): VerificationConditionCheck | null {
  return checks.find((check) => !check.passed) ?? null;
}

export function logVerificationConditionReport(input: {
  phase: "id_filter" | "validation" | "payment_matcher";
  submittedTransactionId: string;
  parsedTransactionCount: number;
  rawRowCount?: number;
  idMatchCount: number;
  transaction: ShamCashTransaction;
  checks: VerificationConditionCheck[];
  failingCondition: VerificationConditionCheck | null;
}): void {
  logger.info("sham_cash_verification_condition_report", input);
}

export function logPaymentMatcherConditionReport(
  payment: PaymentForMatching,
  transaction: ShamCashTransaction,
  window: { start: Date; end: Date },
): void {
  const checks: VerificationConditionCheck[] = [
    {
      condition: "date_window",
      paymentValue: {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      transactionValue: transaction.occurred_at,
      passed: isWithinDateWindow(transaction.occurred_at, window.start, window.end),
    },
    {
      condition: "note_reference_match",
      paymentValue: payment.reference_code,
      transactionValue: transaction.note,
      passed: transaction.note === payment.reference_code,
    },
    {
      condition: "amount",
      paymentValue: payment.amount,
      transactionValue: transaction.amount,
      passed: amountsMatch(transaction.amount, payment.amount),
    },
    {
      condition: "currency",
      paymentValue: normalizeCurrency(payment.currency),
      transactionValue: normalizeCurrency(transaction.currency),
      passed: normalizeCurrency(transaction.currency) === normalizeCurrency(payment.currency),
    },
  ];

  logVerificationConditionReport({
    phase: "payment_matcher",
    submittedTransactionId: payment.reference_code,
    parsedTransactionCount: 1,
    idMatchCount: 0,
    transaction,
    checks,
    failingCondition: firstFailingCondition(checks),
  });
}
