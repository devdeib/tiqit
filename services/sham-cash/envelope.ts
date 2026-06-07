import { ShamCashProviderError } from "./errors";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function assertShamCashSuccessEnvelope(raw: Record<string, unknown>): void {
  if (readString(raw.status) !== "error") return;

  throw new ShamCashProviderError({
    message: readString(raw.message) ?? "Sham Cash API request failed",
    httpStatus: 400,
    providerCode: readString(raw.code),
    envelope: raw,
  });
}

export function unwrapShamCashEnvelopeData(raw: Record<string, unknown>): unknown {
  return Object.prototype.hasOwnProperty.call(raw, "data") ? raw.data : raw;
}
