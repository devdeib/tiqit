import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generatePaymentReferenceCode,
  isPaymentReferenceCode,
} from "../services/sham-cash/reference-code.ts";

describe("generatePaymentReferenceCode", () => {
  it("generates TIQIT-prefixed uppercase hex code", () => {
    const code = generatePaymentReferenceCode();
    assert.match(code, /^TIQIT-[0-9A-F]{8}$/);
    assert.equal(isPaymentReferenceCode(code), true);
  });

  it("generates unique codes", () => {
    const a = generatePaymentReferenceCode();
    const b = generatePaymentReferenceCode();
    assert.notEqual(a, b);
  });
});

describe("isPaymentReferenceCode", () => {
  it("rejects invalid formats", () => {
    assert.equal(isPaymentReferenceCode("TIQIT-abc"), false);
    assert.equal(isPaymentReferenceCode("ORDER-12345678"), false);
  });
});
