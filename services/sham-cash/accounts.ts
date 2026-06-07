import { getServerEnv } from "@/lib/env";
import { resolveShamCashApiBaseUrl, getShamCashApiToken } from "./config";
import { ShamCashConfigurationError } from "./errors";
import { createShamCashHttpClient, type ShamCashHttpClientDeps } from "./http-client";

export type ShamCashLinkedAccount = {
  id: string;
  status: string | null;
  label: string | null;
  raw: Record<string, unknown>;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readAccountId(raw: Record<string, unknown>): string | undefined {
  return readString(raw.id) ?? readString(raw.account_id);
}

export function extractAccountsFromResponse(input: unknown): Record<string, unknown>[] {
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
  const candidates = [raw.accounts, raw.data, raw.items, raw.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      );
    }
  }

  if (readAccountId(raw)) {
    return [raw];
  }

  return [];
}

export function parseShamCashAccount(raw: Record<string, unknown>): ShamCashLinkedAccount | null {
  const id = readAccountId(raw);
  if (!id) return null;

  return {
    id,
    status: readString(raw.status)?.toLowerCase() ?? null,
    label:
      readString(raw.name) ??
      readString(raw.label) ??
      readString(raw.wallet_id) ??
      readString(raw.phone) ??
      null,
    raw,
  };
}

export function accountMatchesHint(raw: Record<string, unknown>, hint: string): boolean {
  const normalized = hint.trim().toLowerCase();
  if (!normalized) return false;

  const fields = [
    "id",
    "account_id",
    "wallet_id",
    "wallet",
    "phone",
    "address",
    "account_number",
    "username",
    "name",
    "label",
  ];

  return fields.some((field) => readString(raw[field])?.toLowerCase() === normalized);
}

export async function listShamCashAccounts(
  httpClientDeps?: ShamCashHttpClientDeps,
): Promise<ShamCashLinkedAccount[]> {
  const client = createShamCashHttpClient(
    httpClientDeps ?? {
      getApiKey: () => getShamCashApiToken(),
      getBaseUrl: () => resolveShamCashApiBaseUrl(getServerEnv().SHAM_CASH_API_BASE_URL),
    },
  );

  const response = await client.listAccounts();
  const rows = extractAccountsFromResponse(response.data ?? response.raw);
  const parsed: ShamCashLinkedAccount[] = [];

  for (const row of rows) {
    const account = parseShamCashAccount(row);
    if (account) parsed.push(account);
  }

  return parsed;
}

export async function resolveShamCashApiAccountId(
  displayAccountId?: string,
  httpClientDeps?: ShamCashHttpClientDeps,
): Promise<string> {
  const fromEnv = process.env.SHAM_CASH_API_ACCOUNT_ID?.trim();
  if (fromEnv) return fromEnv;

  const accounts = await listShamCashAccounts(httpClientDeps);
  if (!accounts.length) {
    throw new ShamCashConfigurationError("SHAM_CASH_API_ACCOUNT_ID");
  }

  const hint = displayAccountId?.trim();
  if (hint) {
    const matched = accounts.find((account) => accountMatchesHint(account.raw, hint));
    if (matched) return matched.id;
  }

  const active = accounts.find((account) => account.status === "active") ?? accounts[0];
  return active.id;
}
