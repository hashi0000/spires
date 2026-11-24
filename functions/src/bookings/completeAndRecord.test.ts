import * as assert from "assert";
import { describe, it } from "node:test";
import { applyCompleteLegPatch, completeRecordPlan } from "./completeAndRecord";

describe("completeRecordPlan", () => {
  it("labels a private job with outstanding balance for one click record", () => {
    const plan = completeRecordPlan(
      {
        status: "allocated",
        actualFare: 235,
        amountReceivedPence: 0,
        paymentMethod: "cash",
        dueOnOutbound: 176.25,
        dueOnReturn: 58.75,
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "outbound"
    );
    assert.equal(plan.mode, "complete_and_record");
    assert.equal(plan.amountPence, 17625);
    assert.match(plan.label, /Complete & record £176\.25 received/);
  });

  it("leaves the remaining balance for the return when the split is agreed", () => {
    const plan = completeRecordPlan(
      {
        status: "allocated",
        outboundStatus: "completed",
        actualFare: 235,
        amountReceivedPence: 17625,
        paymentMethod: "cash",
        dueOnOutbound: 176.25,
        dueOnReturn: 58.75,
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "return"
    );
    assert.equal(plan.mode, "complete_and_record");
    assert.equal(plan.amountPence, 5875);
  });

  it("does not invent a split on an earlier return leg", () => {
    const plan = completeRecordPlan(
      {
        status: "allocated",
        actualFare: 235,
        amountReceivedPence: 0,
        paymentMethod: "card",
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "outbound"
    );
    assert.equal(plan.mode, "complete_only");
    assert.equal(plan.reason, "no_leg_split");
  });

  it("uses the full remaining balance on the last leg without a split", () => {
    const plan = completeRecordPlan(
      {
        status: "allocated",
        outboundStatus: "completed",
        actualFare: 235,
        amountReceivedPence: 3500,
        paymentMethod: "card",
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "return"
    );
    assert.equal(plan.mode, "complete_and_record");
    assert.equal(plan.amountPence, 20000);
  });

  it("marks account and paid jobs complete without payment", () => {
    assert.equal(
      completeRecordPlan({ status: "allocated", actualFare: 100, paymentMethod: "account", amountReceivedPence: 0 }, "outbound").reason,
      "account"
    );
    assert.equal(
      completeRecordPlan({ status: "allocated", actualFare: 100, paymentStatus: "paid", amountReceivedPence: 10000 }, "outbound").reason,
      "paid"
    );
  });

  it("leaves payment for review when charges still need calculating", () => {
    const plan = completeRecordPlan(
      {
        status: "allocated",
        actualFare: 180,
        amountReceivedPence: 0,
        paymentMethod: "cash",
        timedHire: { hireHours: 6 },
      },
      "outbound"
    );
    assert.equal(plan.mode, "complete_only");
    assert.equal(plan.reason, "charges_pending");
  });

  it("does not guess a payment method when none is stored", () => {
    const plan = completeRecordPlan(
      { status: "allocated", actualFare: 80, amountReceivedPence: 0 },
      "outbound"
    );
    assert.equal(plan.mode, "complete_and_record");
    assert.equal(plan.methodKnown, false);
    assert.equal(plan.paymentMethod, "");
  });
});

describe("applyCompleteLegPatch", () => {
  it("completes only the selected return leg", () => {
    const decision = applyCompleteLegPatch(
      {
        status: "allocated",
        outboundStatus: "completed",
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "return"
    );
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.patch.status, "completed");
    assert.equal(decision.patch.returnStatus, "completed");
    assert.equal(decision.completedAtField, "returnCompletedAt");
  });
});
