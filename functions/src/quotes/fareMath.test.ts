import * as assert from "assert";
import { describe, it } from "node:test";
import { depositStillDuePence, nextReceivedPence, paymentPosition, requestAmountPence } from "./fareMath";

describe("fare and payment totals", () => {
  it("derives unpaid, part paid and paid from the fare and money received", () => {
    assert.equal(paymentPosition(18000, 0).label, "Unpaid");
    assert.equal(paymentPosition(18000, 0).stored, "pending");
    const part = paymentPosition(18000, 5000);
    assert.equal(part.label, "Part paid");
    assert.equal(part.outstandingPence, 13000);
    const paid = paymentPosition(18000, 18000);
    assert.equal(paid.label, "Paid");
    assert.equal(paid.outstandingPence, 0);
    const over = paymentPosition(18000, 19000);
    assert.equal(over.label, "Paid");
    assert.equal(over.overpaymentPence, 1000);
  });

  it("keeps a refund status and flags a stored paid mark with no money", () => {
    assert.equal(paymentPosition(18000, 18000, "refunded").label, "Refunded");
    assert.equal(paymentPosition(18000, 0, "paid").inconsistent, true);
  });

  it("adds a payment and can correct the running total", () => {
    assert.deepEqual(nextReceivedPence({ mode: "add", currentReceivedPence: 5000, amountPence: 2000 }), {
      ok: true,
      next: 7000,
    });
    assert.equal(nextReceivedPence({ mode: "add", currentReceivedPence: 5000, amountPence: 0 }).ok, false);
    assert.deepEqual(nextReceivedPence({ mode: "correct", currentReceivedPence: 7000, amountPence: 4000 }), {
      ok: true,
      next: 4000,
    });
  });

  it("defaults a request to the outstanding balance or the unpaid deposit", () => {
    const balance = requestAmountPence({
      kind: "balance",
      farePence: 18000,
      receivedPence: 5000,
      depositPence: 4000,
    });
    assert.equal(balance.ok && balance.amountPence, 13000);
    assert.equal(depositStillDuePence(4000, 1500), 2500);
    const deposit = requestAmountPence({
      kind: "deposit",
      farePence: 18000,
      receivedPence: 1500,
      depositPence: 4000,
    });
    assert.equal(deposit.ok && deposit.amountPence, 2500);
    const tooMuch = requestAmountPence({
      kind: "balance",
      farePence: 18000,
      receivedPence: 5000,
      depositPence: 0,
      customPence: 20000,
    });
    assert.equal(tooMuch.ok, false);
  });
});
