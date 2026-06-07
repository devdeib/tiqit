import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { getServerEnv } from "@/lib/env";
import { createShamCashHttpClient } from "./http-client";
import {
  extractTransactionsFromResponse,
  parseShamCashTransaction,
} from "./transactions-api";
import type { ShamCashHttpClientDeps } from "./http-client";

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
  const transactions = deps.listTransactions
    ? await deps.listTransactions()
    : await fetchTransactionsFromProvider(deps.httpClientDeps);

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
  httpClientDeps?: ShamCashHttpClientDeps,
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
