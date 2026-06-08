import { logger } from "@/lib/logger";
import { extractAccountsFromResponse } from "./accounts";
import {
  extractTransactionIdentifiers,
  extractTransactionsFromResponse,
  transactionIdsMatch,
} from "./transactions-api";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export type ShamCashTransactionsQueryLog = {
  account_id?: string;
  transaction_ids?: string;
  start_at?: string;
  end_at?: string;
  coin_id?: number;
  limit?: number;
};

export function buildTransactionsRequestPathForLog(
  path: string,
  query: ShamCashTransactionsQueryLog,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) params.set(key, normalized);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function readShamCashEnvelopeForLog(raw: Record<string, unknown>): {
  status: string | null;
  code: string | null;
  message: string | null;
} {
  return {
    status: readString(raw.status) ?? null,
    code: readString(raw.code) ?? null,
    message: readString(raw.message) ?? null,
  };
}

export function extractFirstTransactionForLog(
  input: unknown,
): Record<string, unknown> | null {
  const rows = extractTransactionsFromResponse(input);
  if (!rows.length) return null;

  const raw = rows[0];
  return {
    transaction_id: readString(raw.transaction_id) ?? readNumber(raw.transaction_id),
    id: readString(raw.id) ?? readNumber(raw.id),
    note: readString(raw.note) ?? readString(raw.description),
    amount: readNumber(raw.amount) ?? readNumber(raw.value),
    currency: readString(raw.currency),
    occurred_at:
      readString(raw.occurred_at) ??
      readString(raw.created_at) ??
      readString(raw.timestamp),
  };
}

export function responseContainsSubmittedTransactionId(
  input: unknown,
  submittedId: string,
): boolean {
  const rows = extractTransactionsFromResponse(input);
  return rows.some((row) =>
    extractTransactionIdentifiers(row).some((id) => transactionIdsMatch(id, submittedId)),
  );
}

export function logShamCashListTransactionsResponse(input: {
  requestPath: string;
  accountId: string;
  httpStatus: number;
  envelope: Record<string, unknown>;
  data: unknown;
  queryLabel?: string;
}): void {
  const rows = extractTransactionsFromResponse(input.data ?? input.envelope);
  const envelope = readShamCashEnvelopeForLog(input.envelope);

  logger.info("sham_cash_get_transactions", {
    queryLabel: input.queryLabel ?? null,
    requestPath: input.requestPath,
    account_id: input.accountId,
    httpStatus: input.httpStatus,
    response_status: envelope.status,
    response_code: envelope.code,
    response_message: envelope.message,
    transactionCount: rows.length,
    firstTransaction: extractFirstTransactionForLog(input.data ?? input.envelope),
  });
}

export function logShamCashListAccountsResponse(input: {
  requestPath: string;
  httpStatus: number;
  envelope: Record<string, unknown>;
  data: unknown;
}): void {
  const envelope = readShamCashEnvelopeForLog(input.envelope);
  const rows = extractAccountsFromResponse(input.data ?? input.envelope);

  logger.info("sham_cash_get_accounts", {
    requestPath: input.requestPath,
    httpStatus: input.httpStatus,
    response_status: envelope.status,
    response_code: envelope.code,
    response_message: envelope.message,
    accountCount: rows.length,
    accounts: rows.slice(0, 10).map((row) => ({
      id: readString(row.id) ?? readString(row.account_id),
      label:
        readString(row.name) ??
        readString(row.label) ??
        readString(row.wallet_id) ??
        readString(row.phone),
      status: readString(row.status),
      wallet_id: readString(row.wallet_id),
      phone: readString(row.phone),
    })),
  });
}

export function logVerificationAccountContext(input: {
  submittedTransactionId: string;
  displayWalletId: string;
  configuredApiAccountId: string | null;
  envApiAccountId: string | null;
  resolvedApiAccountId: string;
}): void {
  logger.info("sham_cash_verification_account_context", {
    submittedTransactionId: input.submittedTransactionId,
    displayWalletId: input.displayWalletId,
    configuredApiAccountId: input.configuredApiAccountId,
    envApiAccountId: input.envApiAccountId,
    resolvedApiAccountId: input.resolvedApiAccountId,
    accountIdSource: input.envApiAccountId
      ? "env"
      : input.configuredApiAccountId
        ? "admin_settings"
        : "auto_resolve",
  });
}

export function logVerificationAccountsComparison(input: {
  resolvedApiAccountId: string;
  displayWalletId: string;
  configuredApiAccountId: string | null;
  linkedAccounts: Array<{
    id: string;
    label: string | null;
    status: string | null;
    wallet_id?: string | null;
    phone?: string | null;
  }>;
}): void {
  const resolvedInLinked = input.linkedAccounts.some(
    (account) => account.id === input.resolvedApiAccountId,
  );
  const configuredInLinked = input.configuredApiAccountId
    ? input.linkedAccounts.some((account) => account.id === input.configuredApiAccountId)
    : null;

  logger.info("sham_cash_verification_accounts_check", {
    resolvedApiAccountId: input.resolvedApiAccountId,
    configuredApiAccountId: input.configuredApiAccountId,
    displayWalletId: input.displayWalletId,
    linkedAccountCount: input.linkedAccounts.length,
    resolvedAccountInLinkedList: resolvedInLinked,
    configuredAccountInLinkedList: configuredInLinked,
    linkedAccounts: input.linkedAccounts,
  });
}

export function logVerificationTransactionsSummary(input: {
  submittedTransactionId: string;
  resolvedApiAccountId: string;
  queriesExecuted: number;
  totalRawRows: number;
  submittedIdSeenInAnyResponse: boolean;
  unfilteredQueryReturnedData: boolean;
}): void {
  logger.info("sham_cash_verification_transactions_summary", input);
}
