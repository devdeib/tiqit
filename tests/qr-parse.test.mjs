import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirror of lib/crypto/ticket-token parseQrInput (no server imports). */
function parseQrInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("v")) {
    const parts = trimmed.split(":");
    if (parts.length !== 3) return null;
    const version = Number.parseInt(parts[0].slice(1), 10);
    const token = parts[1];
    const signature = parts[2];
    if (!Number.isFinite(version) || !token || !signature) return null;
    if (!/^[0-9a-f]{64}$/i.test(signature)) return null;
    return { keyVersion: version, token, signature: signature.toLowerCase() };
  }
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return { keyVersion: 1, token: trimmed, signature: null };
  }
  return null;
}

describe("parseQrInput format", () => {
  it("parses v1 QR payload", () => {
    const token = "a".repeat(64);
    const sig = "b".repeat(64);
    const r = parseQrInput(`v1:${token}:${sig}`);
    assert.equal(r.keyVersion, 1);
    assert.equal(r.token, token);
  });
});
