import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseShamCashErrorEnvelope } from "../services/sham-cash/parse-error.ts";

describe("parseShamCashErrorEnvelope", () => {
  it("parses nested error object", () => {
    const parsed = parseShamCashErrorEnvelope(
      422,
      JSON.stringify({
        error: {
          code: "invalid_request",
          message: "Amount must be positive",
        },
      }),
    );

    assert.equal(parsed.httpStatus, 422);
    assert.equal(parsed.providerCode, "invalid_request");
    assert.equal(parsed.message, "Amount must be positive");
  });

  it("parses top-level message and code", () => {
    const parsed = parseShamCashErrorEnvelope(
      401,
      JSON.stringify({ code: "unauthorized", message: "Invalid API token" }),
    );

    assert.equal(parsed.providerCode, "unauthorized");
    assert.equal(parsed.message, "Invalid API token");
  });

  it("falls back for non-JSON bodies", () => {
    const parsed = parseShamCashErrorEnvelope(500, "upstream unavailable");
    assert.equal(parsed.message, "upstream unavailable");
    assert.equal(parsed.httpStatus, 500);
  });

  it("uses HTTP status when body is empty", () => {
    const parsed = parseShamCashErrorEnvelope(503, "");
    assert.match(parsed.message, /503/);
  });
});
