import { createHash, timingSafeEqual } from "crypto";

export function shamCashWebhookDigest(rawBody: string, secret: string): string {
  return createHash("sha256").update(`${rawBody}${secret}`).digest("hex");
}

export function shamCashSignatureMatches(
  rawBody: string,
  secret: string,
  signatureHeader: string,
): boolean {
  const expected = shamCashWebhookDigest(rawBody, secret);
  const candidates = [signatureHeader, signatureHeader.replace(/^sha256=/i, "")];

  for (const candidate of candidates) {
    if (candidate.length !== expected.length) continue;
    try {
      if (timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(expected, "utf8"))) {
        return true;
      }
    } catch {
      /* length mismatch */
    }
  }
  return false;
}
