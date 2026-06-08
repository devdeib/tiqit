import type { ShamCashTransaction } from "./transaction-matcher";

const CURRENCY_TO_COIN_ID: Record<string, number> = {
  USD: 1,
  SYP: 2,
  EUR: 3,
};

export function currencyToCoinId(currency: string): number | undefined {
  return CURRENCY_TO_COIN_ID[currency.trim().toUpperCase()];
}

const COIN_ID_TO_CURRENCY: Record<number, string> = {
  1: "USD",
  2: "SYP",
  3: "EUR",
};

/** Fields Sham Cash may use for transaction identity (app UI vs API payload). */
export const TRANSACTION_IDENTIFIER_FIELDS = [
  "transaction_id",
  "id",
  "reference",
  "reference_id",
  "external_id",
  "reference_number",
  "txn_id",
  "txn_ref",
  "payment_reference",
] as const;

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

function readIdentifierValue(raw: Record<string, unknown>, field: string): string | undefined {
  const direct = readString(raw[field]);
  if (direct) return direct;
  const numeric = readNumber(raw[field]);
  if (numeric !== undefined) return String(Math.trunc(numeric));
  return undefined;
}

export function extractTransactionIdentifiers(raw: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const field of TRANSACTION_IDENTIFIER_FIELDS) {
    const value = readIdentifierValue(raw, field);
    if (value) ids.add(value);
  }
  return [...ids];
}

function readTransactionId(raw: Record<string, unknown>): string | undefined {
  for (const field of TRANSACTION_IDENTIFIER_FIELDS) {
    const value = readIdentifierValue(raw, field);
    if (value) return value;
  }
  return undefined;
}

function readCurrency(raw: Record<string, unknown>): string | undefined {
  const currency = readString(raw.currency);
  if (currency) return currency;
  const coinId = readNumber(raw.coin_id);
  if (coinId !== undefined) return COIN_ID_TO_CURRENCY[coinId];
  return undefined;
}

function readReceiverAccount(raw: Record<string, unknown>, fallbackAccountId?: string): string {
  return (
    readString(raw.account_id) ??
    readString(raw.receiver_address) ??
    readString(raw.receiver_account_id) ??
    readString(raw.receiver_account) ??
    readString(raw.receiver_id) ??
    readString(raw.recipient_address) ??
    readString(raw.recipient_account) ??
    fallbackAccountId ??
    ""
  );
}

export function normalizeTransactionId(value: string): string {
  return value.trim();
}

export function transactionIdsMatch(left: string, right: string): boolean {
  const a = normalizeTransactionId(left);
  const b = normalizeTransactionId(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA === numB) {
    return true;
  }

  return false;
}

export function transactionMatchesSubmittedId(
  transaction: ShamCashTransaction,
  submittedId: string,
): boolean {
  const candidates = new Set<string>([
    transaction.transaction_id,
    ...(transaction.identifiers ?? []),
  ]);
  return [...candidates].some((candidate) => transactionIdsMatch(candidate, submittedId));
}

export function receiverAccountMatchesAny(
  transactionReceiver: string,
  expectedAccountIds: string[],
): boolean {
  const receiver = transactionReceiver.trim().toLowerCase();
  if (!receiver) return true;

  return expectedAccountIds.some((expected) => receiverAccountMatches(transactionReceiver, expected));
}

export function isIncomingTransaction(transaction: ShamCashTransaction): boolean | null {
  if (transaction.direction === "incoming") return true;
  if (transaction.direction === "outgoing") return false;
  return null;
}

export function receiverAccountMatches(
  transactionReceiver: string,
  expectedAccountId: string,
): boolean {
  const receiver = transactionReceiver.trim().toLowerCase();
  const expected = expectedAccountId.trim().toLowerCase();
  if (!receiver || !expected) return false;
  return receiver === expected;
}

function parseDirection(raw: Record<string, unknown>): ShamCashTransaction["direction"] {
  const direction = readString(raw.direction)?.toLowerCase();
  if (
    direction === "incoming" ||
    direction === "in" ||
    direction === "credit" ||
    direction === "receive" ||
    direction === "received"
  ) {
    return "incoming";
  }
  if (
    direction === "outgoing" ||
    direction === "out" ||
    direction === "debit" ||
    direction === "send" ||
    direction === "sent"
  ) {
    return "outgoing";
  }

  const type = readString(raw.type)?.toLowerCase();
  if (type === "credit" || type === "incoming" || type === "receive") return "incoming";
  if (type === "debit" || type === "outgoing" || type === "send") return "outgoing";

  if (raw.is_incoming === true) return "incoming";
  if (raw.is_incoming === false) return "outgoing";

  return "unknown";
}

export function parseShamCashTransaction(
  raw: Record<string, unknown>,
  options?: { accountId?: string; defaultCurrency?: string },
): ShamCashTransaction | null {
  const transactionId = readTransactionId(raw);
  const amount = readNumber(raw.amount) ?? readNumber(raw.value);
  const occurredAt =
    readString(raw.occurred_at) ??
    readString(raw.created_at) ??
    readString(raw.timestamp) ??
    readString(raw.date);

  if (!transactionId || amount === undefined || !occurredAt) {
    return null;
  }

  const currency = readCurrency(raw) ?? options?.defaultCurrency ?? "SYP";
  const identifiers = [...new Set([transactionId, ...extractTransactionIdentifiers(raw)])];
  const direction = parseDirection(raw);

  return {
    transaction_id: transactionId,
    identifiers,
    amount,
    currency,
    occurred_at: occurredAt,
    sender_name: readString(raw.sender_name) ?? "",
    sender_address: readString(raw.sender_address) ?? "",
    receiver_account: readReceiverAccount(raw, options?.accountId),
    direction: direction === "unknown" ? "incoming" : direction,
    note: readString(raw.note) ?? readString(raw.description) ?? "",
  };
}

export function summarizeRawTransactionForLog(raw: Record<string, unknown>): Record<string, unknown> {
  const identifiers = extractTransactionIdentifiers(raw);
  return {
    identifiers,
    amount: readNumber(raw.amount) ?? readNumber(raw.value),
    currency: readCurrency(raw),
    direction: readString(raw.direction) ?? readString(raw.type),
    receiver:
      readString(raw.account_id) ??
      readString(raw.receiver_address) ??
      readString(raw.receiver_account),
    reference: readString(raw.reference) ?? readString(raw.reference_id),
    external_id: readString(raw.external_id),
    occurred_at:
      readString(raw.occurred_at) ??
      readString(raw.created_at) ??
      readString(raw.timestamp),
    raw_keys: Object.keys(raw),
  };
}

export function extractTransactionsFromResponse(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    );
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  const raw = input as Record<string, unknown>;

  if (Array.isArray(raw.value)) {
    return raw.value.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    );
  }

  const candidates = [raw.transactions, raw.data, raw.items, raw.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      );
    }
  }

  if (readTransactionId(raw)) {
    return [raw];
  }

  return [];
}
