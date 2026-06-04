import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOrganizerUserSchema, updateAdminUserSchema } from "../lib/validators/admin-schemas.ts";

describe("createOrganizerUserSchema", () => {
  it("accepts valid organizer", () => {
    const r = createOrganizerUserSchema.safeParse({
      email: "o@example.com",
      fullName: "Demo Org",
      password: "password123",
    });
    assert.equal(r.success, true);
  });

  it("rejects short password", () => {
    const r = createOrganizerUserSchema.safeParse({
      email: "o@example.com",
      fullName: "Demo",
      password: "short",
    });
    assert.equal(r.success, false);
  });
});

describe("updateAdminUserSchema", () => {
  it("accepts partial patch", () => {
    const r = updateAdminUserSchema.safeParse({ organizerStatus: "approved" });
    assert.equal(r.success, true);
  });
});
