import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapValidateQrScanResult,
  scanOutcomeMessage,
} from "../services/staff/scan-logic.ts";

describe("mapValidateQrScanResult", () => {
  it("maps VALID to valid", () => {
    assert.equal(mapValidateQrScanResult("VALID"), "valid");
  });

  it("maps ALREADY_USED for double scan", () => {
    assert.equal(mapValidateQrScanResult("ALREADY_USED"), "already_used");
  });

  it("maps WRONG_EVENT for cross-event scan", () => {
    assert.equal(mapValidateQrScanResult("WRONG_EVENT"), "wrong_event");
  });

  it("maps STAFF_NOT_AUTHORIZED for unassigned staff", () => {
    assert.equal(mapValidateQrScanResult("STAFF_NOT_AUTHORIZED"), "not_authorized");
  });
});

describe("scanOutcomeMessage", () => {
  it("describes already_used", () => {
    assert.match(scanOutcomeMessage("already_used"), /already/i);
  });
});
