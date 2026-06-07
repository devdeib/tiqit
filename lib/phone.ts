/** Normalize common Syrian/local formats to E.164 (+963…). Returns null when invalid. */
export function normalizeToE164Phone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-()]/g, "");
  if (!cleaned) return null;

  if (/^\+[1-9][0-9]{7,14}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^0(9[0-9]{8})$/.test(cleaned)) {
    return `+963${cleaned.slice(1)}`;
  }

  if (/^(963[0-9]{9})$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^(9[0-9]{8})$/.test(cleaned)) {
    return `+963${cleaned}`;
  }

  return null;
}

export function formatPhoneValidationHint(): string {
  return "Use E.164 format, e.g. +963900000001 (or 09XXXXXXXX)";
}
