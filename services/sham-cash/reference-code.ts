import { randomBytes } from "crypto";

const REFERENCE_PREFIX = "TIQIT-";
const REFERENCE_SUFFIX_LENGTH = 8;

/** Generates a unique guest-facing Sham Cash payment note, e.g. TIQIT-A1B2C3D4 */
export function generatePaymentReferenceCode(): string {
  const suffix = randomBytes(REFERENCE_SUFFIX_LENGTH / 2)
    .toString("hex")
    .toUpperCase();
  return `${REFERENCE_PREFIX}${suffix}`;
}

export function isPaymentReferenceCode(value: string): boolean {
  return /^TIQIT-[0-9A-F]{8}$/.test(value);
}
