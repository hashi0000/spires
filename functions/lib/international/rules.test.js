"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const quoteWorkflow_1 = require("../quotes/quoteWorkflow");
const rules_1 = require("./rules");
(0, node_test_1.describe)("Spires International rules", () => {
    (0, node_test_1.it)("treats a missing brand as Spires Taxis", () => {
        strict_1.default.equal((0, rules_1.brandOf)({}), "spires_taxis");
        strict_1.default.equal((0, rules_1.brandOf)(null), "spires_taxis");
        strict_1.default.equal((0, rules_1.brandOf)({ brand: "anything" }), "spires_taxis");
        strict_1.default.equal((0, rules_1.brandOf)({ brand: rules_1.INTERNATIONAL_BRAND }), rules_1.INTERNATIONAL_BRAND);
        strict_1.default.equal((0, rules_1.measurementStream)({}), "taxis");
        strict_1.default.equal((0, rules_1.measurementStream)({ brand: rules_1.INTERNATIONAL_BRAND }), "international_unconfigured");
        strict_1.default.equal((0, rules_1.skipsTaxisSideEffects)({ status: "pending" }), false);
        strict_1.default.equal((0, rules_1.skipsTaxisPaymentReceipt)({}), false);
    });
    (0, node_test_1.it)("never charges a client amount or a preview fare", () => {
        const priced = (0, rules_1.chargeableFare)({ amountPence: 9200, brand: "spires_taxis" });
        strict_1.default.equal(priced.chargeable, false);
        strict_1.default.equal(priced.fareApproved, false);
        strict_1.default.equal(priced.farePence, null);
    });
    (0, node_test_1.it)("checks passengers and luggage against the two vehicles", () => {
        strict_1.default.equal((0, rules_1.vehicleDecision)(4, 4, "standard").ok, true);
        strict_1.default.equal((0, rules_1.vehicleDecision)(5, 1, "standard").ok, false);
        strict_1.default.equal((0, rules_1.vehicleDecision)(4, 5, "standard").ok, false);
        strict_1.default.equal((0, rules_1.vehicleDecision)(8, 8, "vito_8").ok, true);
        strict_1.default.equal((0, rules_1.vehicleDecision)(9, 1, "vito_8").ok, false);
        strict_1.default.equal((0, rules_1.vehicleDecision)(0, 0, "standard").ok, false);
    });
    (0, node_test_1.it)("keeps quote, awaiting payment, paid and confirmed apart", () => {
        const quote = (0, rules_1.newQuote)();
        strict_1.default.equal(quote.status, "quote_requested");
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status: quote.status }), false);
        const blocked = (0, rules_1.applyPaymentNotice)(quote, { id: "evt_1", type: "payment_intent.succeeded", amountPence: 100 });
        strict_1.default.equal(blocked.accepted, false);
        strict_1.default.match(blocked.reason || "", /approved fare/);
        const staffOnly = (0, rules_1.approveFare)(quote, 150000, false);
        strict_1.default.ok("error" in staffOnly);
        const awaiting = (0, rules_1.approveFare)(quote, 150000, true);
        strict_1.default.ok(!("error" in awaiting));
        if ("error" in awaiting)
            return;
        strict_1.default.equal(awaiting.status, "awaiting_payment");
        strict_1.default.equal(awaiting.paymentStatus, "awaiting_payment");
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status: awaiting.status }), false);
        strict_1.default.equal((0, rules_1.skipsTaxisSideEffects)(awaiting), true);
        const wrongAmount = (0, rules_1.applyPaymentNotice)(awaiting, { id: "evt_low", type: "payment_intent.succeeded", amountPence: 100 });
        strict_1.default.equal(wrongAmount.accepted, false);
        const paid = (0, rules_1.applyPaymentNotice)(awaiting, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 150000 });
        strict_1.default.equal(paid.accepted, true);
        strict_1.default.equal(paid.state.status, "payment_received");
        strict_1.default.equal(paid.state.paymentStatus, "paid");
        strict_1.default.equal(paid.state.driverNotified, false);
        strict_1.default.equal(paid.state.confirmationSent, false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status: paid.state.status }), false);
        strict_1.default.equal((0, rules_1.skipsTaxisPaymentReceipt)(paid.state), true);
        const again = (0, rules_1.applyPaymentNotice)(paid.state, { id: "evt_ok", type: "payment_intent.succeeded", amountPence: 150000 });
        strict_1.default.equal(again.duplicate, true);
        strict_1.default.equal(again.state.status, "payment_received");
        const secondCharge = (0, rules_1.applyPaymentNotice)(paid.state, { id: "evt_ok_2", type: "payment_intent.succeeded", amountPence: 150000 });
        strict_1.default.equal(secondCharge.duplicate, true);
        strict_1.default.equal(secondCharge.state.paymentStatus, "paid");
        const failed = (0, rules_1.applyPaymentNotice)(awaiting, { id: "evt_fail", type: "payment_intent.payment_failed", amountPence: 150000 });
        strict_1.default.equal(failed.state.paymentStatus, "failed");
        strict_1.default.equal(failed.state.status, "awaiting_payment");
        strict_1.default.equal(failed.state.confirmationSent, false);
        const abandoned = (0, rules_1.applyPaymentNotice)(awaiting, { id: "evt_leave", type: "checkout.session.expired", amountPence: 150000 });
        strict_1.default.equal(abandoned.state.paymentStatus, "abandoned");
        strict_1.default.equal(abandoned.state.status, "awaiting_payment");
        const tooSoon = (0, rules_1.confirmAfterPayment)(awaiting);
        strict_1.default.equal(tooSoon.error?.length ? true : false, true);
        strict_1.default.equal(tooSoon.state.status, "awaiting_payment");
        const confirmed = (0, rules_1.confirmAfterPayment)(paid.state);
        strict_1.default.equal(confirmed.error, undefined);
        strict_1.default.equal(confirmed.state.status, "confirmed");
        strict_1.default.equal(confirmed.state.driverNotified, false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status: "confirmed" }), true);
        strict_1.default.equal((0, rules_1.skipsTaxisSideEffects)(confirmed.state), false);
        const refund = (0, rules_1.applyPaymentNotice)(paid.state, { id: "evt_refund", type: "charge.refunded", amountPence: 150000 });
        strict_1.default.equal(refund.state.paymentStatus, "refunded");
        strict_1.default.equal(refund.state.driverNotified, false);
        strict_1.default.notEqual(refund.state.status, "confirmed");
    });
    (0, node_test_1.it)("does not send preview events to the Spires Taxis property", () => {
        const blocked = (0, rules_1.measurementEvent)({
            consent: "granted",
            measurementId: rules_1.PRODUCTION_GA4,
            name: "purchase",
            dedupeKey: "evt_ok",
            alreadySent: [],
            params: { value: 1, transaction_id: "evt_ok", payment_kind: "full", email: "a@b.com" },
        });
        strict_1.default.equal(blocked.sent, false);
        const empty = (0, rules_1.measurementEvent)({
            consent: "granted",
            measurementId: "",
            name: "generate_lead",
            dedupeKey: "q1",
            alreadySent: [],
            params: { lead_type: "quote" },
        });
        strict_1.default.equal(empty.sent, false);
        const lead = (0, rules_1.measurementEvent)({
            consent: "granted",
            measurementId: "G-TESTINTL1",
            name: "generate_lead",
            dedupeKey: "q1",
            alreadySent: [],
            params: { lead_type: "quote", email: "a@b.com", message: "secret" },
        });
        strict_1.default.equal(lead.sent, true);
        if (!lead.sent)
            return;
        strict_1.default.deepEqual(lead.event.params, { brand: rules_1.INTERNATIONAL_BRAND, lead_type: "quote" });
        const duplicate = (0, rules_1.measurementEvent)({
            consent: "granted",
            measurementId: "G-TESTINTL1",
            name: "generate_lead",
            dedupeKey: "q1",
            alreadySent: ["generate_lead:q1"],
            params: { lead_type: "quote" },
        });
        strict_1.default.equal(duplicate.sent, false);
        const denied = (0, rules_1.measurementEvent)({
            consent: "denied",
            measurementId: "G-TESTINTL1",
            name: "generate_lead",
            dedupeKey: "q2",
            alreadySent: [],
            params: { lead_type: "contact" },
        });
        strict_1.default.equal(denied.sent, false);
    });
});
