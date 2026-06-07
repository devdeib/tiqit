import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { submitManualPaymentFormSchema } from "../lib/validators/schemas.ts";

describe("submitManualPaymentFormSchema", () => {
  it("accepts valid submission fields", () => {
    const r = submitManualPaymentFormSchema.safeParse({
      phone: "+963900000001",
      transactionId: "TXN-123456",
    });
    assert.equal(r.success, true);
  });

  it("rejects short transaction id", () => {
    const r = submitManualPaymentFormSchema.safeParse({
      phone: "+963900000001",
      transactionId: "ab",
    });
    assert.equal(r.success, false);
  });
});
