export type ParsedShamCashApiError = {
  message: string;
  providerCode?: string;
  httpStatus: number;
  envelope: Record<string, unknown>;
};

export function parseShamCashErrorEnvelope(
  httpStatus: number,
  bodyText: string,
): ParsedShamCashApiError {
  const envelope = parseEnvelopeBody(bodyText, httpStatus);
  return {
    message: extractErrorMessage(envelope, httpStatus),
    providerCode: extractProviderCode(envelope),
    httpStatus,
    envelope,
  };
}

function parseEnvelopeBody(bodyText: string, httpStatus: number): Record<string, unknown> {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return { message: `HTTP ${httpStatus}` };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { message: String(parsed) };
  } catch {
    return { message: trimmed };
  }
}

function extractErrorMessage(envelope: Record<string, unknown>, httpStatus: number): string {
  const nestedError = envelope.error;
  if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
    const nested = nestedError as Record<string, unknown>;
    const nestedMessage = readString(nested.message) ?? readString(nested.detail);
    if (nestedMessage) return nestedMessage;
  }

  return (
    readString(envelope.message) ??
    readString(envelope.detail) ??
    readString(envelope.error_description) ??
    `Sham Cash API error (HTTP ${httpStatus})`
  );
}

function extractProviderCode(envelope: Record<string, unknown>): string | undefined {
  const nestedError = envelope.error;
  if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
    const nested = nestedError as Record<string, unknown>;
    const nestedCode = readString(nested.code) ?? readString(nested.type);
    if (nestedCode) return nestedCode;
  }

  return readString(envelope.code) ?? readString(envelope.error_code);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
