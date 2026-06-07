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

export function parseShamCashTransaction(raw: Record<string, unknown>): ShamCashTransaction | null {
  const transactionId = readString(raw.transaction_id);
  const amount = readNumber(raw.amount);
  const currency = readString(raw.currency);
  const occurredAt = readString(raw.occurred_at);
  const note = readString(raw.note);

  if (!transactionId || amount === undefined || !currency || !occurredAt || note === undefined) {
    return null;
  }

  return {
    transaction_id: transactionId,
    amount,
    currency,
    occurred_at: occurredAt,
    sender_name: readString(raw.sender_name) ?? "",
    sender_address: readString(raw.sender_address) ?? "",
    note,
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
