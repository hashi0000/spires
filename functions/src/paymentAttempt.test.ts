import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentAttemptPlan } from "./paymentAttempt";

describe("Stripe payment attempt", () => {
  it("reuses an open intent when the balance has not changed", () => {
    const plan = paymentAttemptPlan({
      id: "job-1",
      openStripePaymentIntentId: "pi_open1",
      openStripePaymentAmountPence: 2000,
    }, 2000, "attempt-b");
    assert.equal(plan.action, "reuse");
  });

  it("creates a new attempt when the fare changes, when the open payment was credited, and for a second equal amount", () => {
    const changed = paymentAttemptPlan({
      id: "job-1",
      openStripePaymentIntentId: "pi_open1",
      openStripePaymentAmountPence: 2000,
    }, 1500, "attempt-c");
    assert.equal(changed.action, "create");
    assert.equal(changed.action === "create" && changed.idempotencyKey, "spires_job-1_attempt-c");
    const credited = paymentAttemptPlan({
      id: "job-1",
      openStripePaymentIntentId: "pi_deposit",
      openStripePaymentAmountPence: 2000,
      appliedStripePaymentIntentIds: ["pi_deposit"],
      amountReceivedPence: 2000,
    }, 2000, "attempt-d");
    assert.equal(credited.action, "create");
    assert.notEqual(credited.action === "create" && credited.idempotencyKey, "spires_job-1_attempt-c");
    assert.equal(String(credited.action === "create" && credited.idempotencyKey).includes("_2000"), false);
  });
});