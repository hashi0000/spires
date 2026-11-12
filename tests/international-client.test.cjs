const assert = require("node:assert/strict");
const test = require("node:test");
const rules = require("../spires-international/js/rules.js");

test("preview fares cannot be charged and a missing brand stays Spires Taxis", () => {
  assert.equal(rules.brandOf({}), "spires_taxis");
  assert.equal(rules.brandOf({ brand: "spires_international" }), "spires_international");
  const fare = rules.chargeableFare({ amountPence: 9200, brand: "spires_taxis" });
  assert.equal(fare.chargeable, false);
  assert.equal(fare.farePence, null);
});

test("vehicle and luggage limits", () => {
  assert.equal(rules.vehicleDecision(4, 2, "standard").ok, true);
  assert.equal(rules.vehicleDecision(6, 2, "standard").ok, false);
  assert.equal(rules.vehicleDecision(4, 6, "standard").ok, false);
  assert.equal(rules.vehicleDecision(8, 8, "vito_8").ok, true);
});

test("payment success, failure, duplicate and refund stay distinct from confirmation", () => {
  const quote = rules.newQuote();
  const blocked = rules.applyPaymentNotice(quote, { id: "evt_1", type: "payment_intent.succeeded", amountPence: 100 });
  assert.equal(blocked.accepted, false);
  const awaiting = rules.approveFare(quote, 2500, true);
  const paid = rules.applyPaymentNotice(awaiting, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 2500 });
  assert.equal(paid.state.status, "payment_received");
  assert.equal(paid.state.paymentStatus, "paid");
  assert.equal(paid.state.confirmationSent, false);
  assert.equal(paid.state.driverNotified, false);
  const duplicate = rules.applyPaymentNotice(paid.state, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 2500 });
  assert.equal(duplicate.duplicate, true);
  const failed = rules.applyPaymentNotice(awaiting, { id: "evt_fail", type: "payment_intent.payment_failed", amountPence: 2500 });
  assert.equal(failed.state.paymentStatus, "failed");
  assert.equal(failed.state.status, "awaiting_payment");
  const left = rules.applyPaymentNotice(awaiting, { id: "evt_left", type: "checkout.session.expired", amountPence: 2500 });
  assert.equal(left.state.paymentStatus, "abandoned");
  const early = rules.confirmAfterPayment(awaiting);
  assert.equal(early.state.status, "awaiting_payment");
  const confirmed = rules.confirmAfterPayment(paid.state);
  assert.equal(confirmed.state.status, "confirmed");
  assert.equal(confirmed.state.driverNotified, false);
  const refund = rules.applyPaymentNotice(paid.state, { id: "evt_refund", type: "charge.refunded", amountPence: 2500 });
  assert.equal(refund.state.paymentStatus, "refunded");
  assert.notEqual(refund.state.status, "confirmed");
});

test("analytics refuse the live Spires Taxis stream and drop personal details", () => {
  const blocked = rules.measurementEvent({
    consent: "granted",
    measurementId: rules.PRODUCTION_GA4,
    name: "generate_lead",
    dedupeKey: "q1",
    alreadySent: [],
    params: { lead_type: "quote", email: "a@b.com" },
  });
  assert.equal(blocked.sent, false);
  const empty = rules.measurementEvent({
    consent: "granted",
    measurementId: "",
    name: "generate_lead",
    dedupeKey: "q1",
    alreadySent: [],
    params: { lead_type: "quote" },
  });
  assert.equal(empty.sent, false);
  const sent = rules.measurementEvent({
    consent: "granted",
    measurementId: "G-TESTINTL1",
    name: "generate_lead",
    dedupeKey: "q1",
    alreadySent: [],
    params: { lead_type: "quote", email: "a@b.com", message: "hello" },
  });
  assert.equal(sent.sent, true);
  assert.deepEqual(sent.event.params, { brand: "spires_international", lead_type: "quote" });
});
