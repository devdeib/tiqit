import type { ShamCashTransaction } from "./transaction-matcher";

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

function readReceiverAccount(raw: Record<string, unknown>): string {
  return (
    readString(raw.receiver_address) ??
    readString(raw.receiver_account_id) ??
    readString(raw.receiver_account) ??
    readString(raw.receiver_id) ??
    readString(raw.recipient_address) ??
    readString(raw.recipient_account) ??
    ""
  );
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

export function parseShamCashTransaction(raw: Record<string, unknown>): ShamCashTransaction | null {
  const transactionId = readString(raw.transaction_id);
  const amount = readNumber(raw.amount);
  const currency = readString(raw.currency);
  const occurredAt = readString(raw.occurred_at);

  if (!transactionId || amount === undefined || !currency || !occurredAt) {
    return null;
  }

  return {
    transaction_id: transactionId,
    amount,
    currency,
    occurred_at: occurredAt,
    sender_name: readString(raw.sender_name) ?? "",
    sender_address: readString(raw.sender_address) ?? "",
    receiver_account: readReceiverAccount(raw),
    direction: parseDirection(raw),
    note: readString(raw.note) ?? "",
  };
}

export function extractTransactionsFromResponse(raw: Record<string, unknown>): Record<string, unknown>[] {
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

  if (raw.transaction_id) {
    return [raw];
  }

  return [];
}
