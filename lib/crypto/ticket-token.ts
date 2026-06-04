import { createHmac, randomBytes } from "crypto";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function generateTicketToken(): string {
  return randomBytes(32).toString("hex");
}

export function signTicketToken(token: string, keyVersion = 1): string {
  const env = getServerEnv();
  const secret = env.HMAC_SECRET_V1;
  if (!secret) {
    throw new AppError("HMAC_SECRET_V1 is not configured", {
      code: "CONFIG",
      status: 503,
      expose: true,
    });
  }
  return createHmac("sha256", secret).update(`${keyVersion}:${token}`).digest("hex");
}

export function buildQrPayload(token: string, signature: string, keyVersion = 1): string {
  return `v${keyVersion}:${token}:${signature}`;
}

export function verifyTicketToken(
  token: string,
  signature: string,
  keyVersion = 1,
): boolean {
  try {
    const expected = signTicketToken(token, keyVersion);
    return timingSafeEqualHex(expected, signature);
  } catch {
    return false;
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
