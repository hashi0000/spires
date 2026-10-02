import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeJoinerPaymentDeadline, computePaymentDeadline, isLondonQuietHours } from "./paymentDeadline";

describe("payment deadline quiet hours (Europe/London)", () => {
  it("keeps a daytime 2 hour window", () => {
    const result = computePaymentDeadline("2026-09-28T17:00:00.000Z", 2);
    assert.equal(result.deadlineAt, "2026-09-28T19:00:00.000Z");
    assert.equal(result.quietHoursApplied, false);
  });

  it("does not expire a 01:00 request at 03:00", () => {
    const openedAt = "2026-01-15T01:00:00.000Z";
    assert.equal(isLondonQuietHours(openedAt), true);
    const result = computePaymentDeadline(openedAt, 2);
    assert.equal(result.deadlineAt, "2026-01-15T09:00:00.000Z");
    assert.equal(result.quietHoursApplied, true);
  });

  it("pushes a 21:00 open that would expire at 23:00 to 09:00 next morning", () => {
    const result = computePaymentDeadline("2026-01-15T21:00:00.000Z", 2);
    assert.equal(result.deadlineAt, "2026-01-16T09:00:00.000Z");
    assert.equal(result.quietHoursApplied, true);
  });

  it("handles BST overnight the same way", () => {
    const openedAt = "2026-07-15T00:00:00.000Z";
    const result = computePaymentDeadline(openedAt, 2);
    assert.equal(result.quietHoursApplied, true);
    assert.ok(new Date(result.deadlineAt).getTime() - new Date(openedAt).getTime() > 2 * 60 * 60 * 1000);
  });

  it("reuses a remaining journey deadline for a fifth passenger", () => {
    const now = "2026-09-28T12:00:00.000Z";
    const existing = "2026-09-28T13:30:00.000Z";
    const result = computeJoinerPaymentDeadline(now, existing, 2);
    assert.equal(result.deadlineAt, existing);
  });
});
