import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSendConfirmation } from "../quotes/quoteWorkflow";
import {
  INTERNATIONAL_BRAND,
  PRODUCTION_GA4,
  applyPaymentNotice,
  approveFare,
  brandOf,
  chargeableFare,
  confirmAfterPayment,
  measurementEvent,
  measurementStream,
  newQuote,
  skipsTaxisPaymentReceipt,
  skipsTaxisSideEffects,
  vehicleDecision,
} from "./rules";

describe("Spires International rules", () => {
  it("treats a missing brand as Spires Taxis", () => {
    assert.equal(brandOf({}), "spires_taxis");
    assert.equal(brandOf(null), "spires_taxis");
    assert.equal(brandOf({ brand: "anything" }), "spires_taxis");
    assert.equal(brandOf({ brand: INTERNATIONAL_BRAND }), INTERNATIONAL_BRAND);
    assert.equal(measurementStream({}), "taxis");
    assert.equal(measurementStream({ brand: INTERNATIONAL_BRAND }), "international_unconfigured");
    assert.equal(skipsTaxisSideEffects({ status: "pending" }), false);
    assert.equal(skipsTaxisPaymentReceipt({}), false);
  });

  it("never charges a client amount or a preview fare", () => {
    const priced = chargeableFare({ amountPence: 9200, brand: "spires_taxis" });
    assert.equal(priced.chargeable, false);
    assert.equal(priced.fareApproved, false);
    assert.equal(priced.farePence, null);
  });

  it("checks passengers and luggage against the two vehicles", () => {
    assert.equal(vehicleDecision(4, 4, "standard").ok, true);
    assert.equal(vehicleDecision(5, 1, "standard").ok, false);
    assert.equal(vehicleDecision(4, 5, "standard").ok, false);
    assert.equal(vehicleDecision(8, 8, "vito_8").ok, true);
    assert.equal(vehicleDecision(9, 1, "vito_8").ok, false);
    assert.equal(vehicleDecision(0, 0, "standard").ok, false);
  });

  it("keeps quote, awaiting payment, paid and confirmed apart", () => {
    const quote = newQuote();
    assert.equal(quote.status, "quote_requested");
    assert.equal(shouldSendConfirmation(null, { status: quote.status }), false);

    const blocked = applyPaymentNotice(quote, { id: "evt_1", type: "payment_intent.succeeded", amountPence: 100 });
    assert.equal(blocked.accepted, false);
    assert.match(blocked.reason || "", /approved fare/);

    const staffOnly = approveFare(quote, 150000, false);
    assert.ok("error" in staffOnly);

    const awaiting = approveFare(quote, 150000, true);
    assert.ok(!("error" in awaiting));
    if ("error" in awaiting) return;
    assert.equal(awaiting.status, "awaiting_payment");
    assert.equal(awaiting.paymentStatus, "awaiting_payment");
    assert.equal(shouldSendConfirmation(null, { status: awaiting.status }), false);
    assert.equal(skipsTaxisSideEffects(awaiting), true);

    const wrongAmount = applyPaymentNotice(awaiting, { id: "evt_low", type: "payment_intent.succeeded", amountPence: 100 });
    assert.equal(wrongAmount.accepted, false);

    const paid = applyPaymentNotice(awaiting, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 150000 });
    assert.equal(paid.accepted, true);
    assert.equal(paid.state.status, "payment_received");
    assert.equal(paid.state.paymentStatus, "paid");
    assert.equal(paid.state.driverNotified, false);
    assert.equal(paid.state.confirmationSent, false);
    assert.equal(shouldSendConfirmation(null, { status: paid.state.status }), false);
    assert.equal(skipsTaxisPaymentReceipt(paid.state), true);

    const again = applyPaymentNotice(paid.state, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 150000 });
    assert.equal(again.duplicate, true);
    assert.equal(again.state.status, "payment_received");

    const secondCharge = applyPaymentNotice(paid.state, { id: "evt_ok_2", type: "payment_intent.succeeded", amountPence: 150000 });
    assert.equal(secondCharge.duplicate, true);
    assert.equal(secondCharge.state.paymentStatus, "paid");

    const failed = applyPaymentNotice(awaiting, { id: "evt_fail", type: "payment_intent.payment_failed", amountPence: 150000 });
    assert.equal(failed.state.paymentStatus, "failed");
    assert.equal(failed.state.status, "awaiting_payment");
    assert.equal(failed.state.confirmationSent, false);

    const abandoned = applyPaymentNotice(awaiting, { id: "evt_leave", type: "checkout.session.expired", amountPence: 150000 });
    assert.equal(abandoned.state.paymentStatus, "abandoned");
    assert.equal(abandoned.state.status, "awaiting_payment");

    const tooSoon = confirmAfterPayment(awaiting);
    assert.equal(tooSoon.error?.length ? true : false, true);
    assert.equal(tooSoon.state.status, "awaiting_payment");

    const confirmed = confirmAfterPayment(paid.state);
    assert.equal(confirmed.error, undefined);
    assert.equal(confirmed.state.status, "confirmed");
    assert.equal(confirmed.state.driverNotified, false);
    assert.equal(shouldSendConfirmation(null, { status: "confirmed" }), true);
    assert.equal(skipsTaxisSideEffects(confirmed.state), false);

    const refund = applyPaymentNotice(paid.state, { id: "evt_refund", type: "charge.refunded", amountPence: 150000 });
    assert.equal(refund.state.paymentStatus, "refunded");
    assert.equal(refund.state.driverNotified, false);
    assert.notEqual(refund.state.status, "confirmed");
  });

  it("does not send preview events to the Spires Taxis property", () => {
    const blocked = measurementEvent({
      consent: "granted",
      measurementId: PRODUCTION_GA4,
      name: "purchase",
      dedupeKey: "evt_ok",
      alreadySent: [],
      params: { value: 1, transaction_id: "evt_ok", payment_kind: "full", email: "a@b.com" },
    });
    assert.equal(blocked.sent, false);
    const empty = measurementEvent({
      consent: "granted",
      measurementId: "",
      name: "generate_lead",
      dedupeKey: "q1",
      alreadySent: [],
      params: { lead_type: "quote" },
    });
    assert.equal(empty.sent, false);
    const lead = measurementEvent({
      consent: "granted",
      measurementId: "G-TESTINTL1",
      name: "generate_lead",
      dedupeKey: "q1",
      alreadySent: [],
      params: { lead_type: "quote", email: "a@b.com", message: "secret" },
    });
    assert.equal(lead.sent, true);
    if (!lead.sent) return;
    assert.deepEqual(lead.event.params, { brand: INTERNATIONAL_BRAND, lead_type: "quote" });
    const duplicate = measurementEvent({
      consent: "granted",
      measurementId: "G-TESTINTL1",
      name: "generate_lead",
      dedupeKey: "q1",
      alreadySent: ["generate_lead:q1"],
      params: { lead_type: "quote" },
    });
    assert.equal(duplicate.sent, false);
    const denied = measurementEvent({
      consent: "denied",
      measurementId: "G-TESTINTL1",
      name: "generate_lead",
      dedupeKey: "q2",
      alreadySent: [],
      params: { lead_type: "contact" },
    });
    assert.equal(denied.sent, false);
  });
});
