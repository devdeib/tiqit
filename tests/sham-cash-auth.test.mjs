import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildShamCashAuthHeaders } from "../services/sham-cash/auth.ts";

describe("buildShamCashAuthHeaders", () => {
  it("builds Bearer Authorization header", () => {
    const headers = buildShamCashAuthHeaders("test-api-token");
    assert.equal(headers.Authorization, "Bearer test-api-token");
    assert.equal(headers.Accept, "application/json");
    assert.equal(headers["Content-Type"], "application/json");
  });

  it("trims token whitespace", () => {
    const headers = buildShamCashAuthHeaders("  token-with-space  ");
    assert.equal(headers.Authorization, "Bearer token-with-space");
  });

  it("rejects empty token", () => {
    assert.throws(() => buildShamCashAuthHeaders("   "), /must not be empty/);
  });
});
