import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeToE164Phone } from "../lib/phone.ts";

describe("normalizeToE164Phone", () => {
  it("accepts E.164 input", () => {
    assert.equal(normalizeToE164Phone("+963931234567"), "+963931234567");
  });

  it("normalizes Syrian 09 prefix", () => {
    assert.equal(normalizeToE164Phone("0931234567"), "+963931234567");
  });

  it("normalizes 963 prefix without plus", () => {
    assert.equal(normalizeToE164Phone("963931234567"), "+963931234567");
  });

  it("rejects invalid numbers", () => {
    assert.equal(normalizeToE164Phone("123"), null);
  });
});
