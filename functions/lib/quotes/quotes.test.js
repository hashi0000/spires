"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const halfTerm_1 = require("./halfTerm");
const londonTime_1 = require("./londonTime");
const invoiceVault_1 = require("./invoiceVault");
const paymentLink_1 = require("./paymentLink");
const quoteWorkflow_1 = require("./quoteWorkflow");
const BST_24_OCT_2330 = Date.parse("2026-10-24T22:30:00.000Z");
const LONDON_25_OCT_0030 = Date.parse("2026-10-24T23:30:00.000Z");
const LONDON_2_NOV_2330 = Date.parse("2026-11-02T23:30:00.000Z");
const LONDON_3_NOV_0000 = Date.parse("2026-11-03T00:00:00.000Z");
const LONDON_31_OCT_2330 = Date.parse("2026-10-31T23:30:00.000Z");
const LONDON_1_NOV_0000 = Date.parse("2026-11-01T00:00:00.000Z");
const NEXT_YEAR = Date.parse("2027-10-26T12:00:00.000Z");
const airportReturn = {
    source: "website",
    bookingType: "return",
    pickup: "Oxford",
    pickupLocation: "Oxford",
    destination: "Heathrow Airport",
    returnPickupLocation: "Heathrow Terminal 5",
    returnDestination: "Oxford",
    vehicleType: "standard",
};
(0, node_test_1.describe)("2026 half term and Halloween windows", () => {
    (0, node_test_1.it)("uses Europe/London calendar dates", () => {
        strict_1.default.equal((0, londonTime_1.londonYmd)(BST_24_OCT_2330), "2026-10-24");
        strict_1.default.equal((0, londonTime_1.londonYmd)(LONDON_25_OCT_0030), "2026-10-25");
        strict_1.default.equal((0, londonTime_1.londonYmd)(LONDON_3_NOV_0000), "2026-11-03");
    });
    (0, node_test_1.it)("includes 25 October through 2 November 2026 and stops at 3 November", () => {
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(BST_24_OCT_2330), false);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(LONDON_25_OCT_0030), true);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(LONDON_2_NOV_2330), true);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(LONDON_3_NOV_0000), false);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(NEXT_YEAR), false);
    });
    (0, node_test_1.it)("shows Halloween decorations only through 31 October 2026", () => {
        strict_1.default.equal((0, halfTerm_1.isHalloweenDecorWindow)(LONDON_25_OCT_0030), true);
        strict_1.default.equal((0, halfTerm_1.isHalloweenDecorWindow)(LONDON_31_OCT_2330), true);
        strict_1.default.equal((0, halfTerm_1.isHalloweenDecorWindow)(LONDON_1_NOV_0000), false);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(LONDON_1_NOV_0000), true);
        strict_1.default.equal((0, halfTerm_1.isHalloweenDecorWindow)(NEXT_YEAR), false);
    });
});
(0, node_test_1.describe)("half term discount", () => {
    (0, node_test_1.it)("applies £5 once to an eligible airport return and never to a one way", () => {
        const decision = (0, halfTerm_1.decideHalfTermPromotion)(airportReturn, LONDON_25_OCT_0030);
        strict_1.default.equal(decision.eligible, true);
        strict_1.default.equal(decision.code, "HALFTERM");
        const priced = (0, halfTerm_1.quoteTotals)({
            normalFarePence: (0, halfTerm_1.poundsToPence)("180"),
            promotionEligible: decision.eligible,
            stillQualifyingReturn: true,
        });
        strict_1.default.equal(priced.normalFarePence, 18000);
        strict_1.default.equal(priced.discountPence, halfTerm_1.HALF_TERM_DISCOUNT_PENCE);
        strict_1.default.equal(priced.finalFarePence, 17500);
        const again = (0, halfTerm_1.quoteTotals)({
            normalFarePence: priced.normalFarePence,
            promotionEligible: true,
            stillQualifyingReturn: true,
        });
        strict_1.default.equal(again.discountPence, 500);
        strict_1.default.equal(again.finalFarePence, 17500);
        const oneWay = (0, halfTerm_1.quoteTotals)({
            normalFarePence: 9200,
            promotionEligible: true,
            stillQualifyingReturn: false,
        });
        strict_1.default.equal(oneWay.discountPence, 0);
        strict_1.default.equal(oneWay.finalFarePence, 9200);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)({ ...airportReturn, bookingType: "one_way", returnTrip: false }, LONDON_25_OCT_0030).eligible, false);
    });
    (0, node_test_1.it)("keeps a captured discount after the campaign ends and does not invent one for other fares", () => {
        const captured = (0, halfTerm_1.decideHalfTermPromotion)(airportReturn, LONDON_2_NOV_2330);
        strict_1.default.equal(captured.eligible, true);
        const later = (0, halfTerm_1.quoteTotals)({
            normalFarePence: (0, halfTerm_1.poundsToPence)("270.50"),
            promotionEligible: captured.eligible,
            stillQualifyingReturn: true,
        });
        strict_1.default.equal(later.discountPence, 500);
        strict_1.default.equal(later.finalFarePence, 26550);
        strict_1.default.equal((0, halfTerm_1.isHalfTermRequestWindow)(LONDON_3_NOV_0000), false);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)(airportReturn, LONDON_3_NOV_0000).eligible, false);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)({ ...airportReturn, vehicleType: "executive" }, LONDON_25_OCT_0030).eligible, false);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)({ ...airportReturn, vehicleType: "8_seater" }, LONDON_25_OCT_0030).eligible, true);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)({ ...airportReturn, source: "admin" }, LONDON_25_OCT_0030).eligible, false);
        strict_1.default.equal((0, halfTerm_1.decideHalfTermPromotion)({ ...airportReturn, otherOfferCode: "STUDENT" }, LONDON_25_OCT_0030).eligible, false);
    });
});
(0, node_test_1.describe)("quote acceptance and payment", () => {
    const base = {
        status: "awaiting_customer_confirmation",
        quoteIssuedVersion: 2,
        requestedVersion: 2,
        nowMs: LONDON_25_OCT_0030,
        authorised: true,
        paymentRequirement: "later",
    };
    (0, node_test_1.it)("accepts only an explicit authorised action for the issued version", () => {
        const accepted = (0, quoteWorkflow_1.decideAcceptance)(base);
        strict_1.default.equal(accepted.ok, true);
        if (accepted.ok) {
            strict_1.default.equal(accepted.nextStatus, "confirmed");
            strict_1.default.equal(accepted.substatus, "");
        }
        const again = (0, quoteWorkflow_1.decideAcceptance)({ ...base, quoteAcceptedVersion: 2, status: "confirmed" });
        strict_1.default.equal(again.ok && again.already, true);
        strict_1.default.equal((0, quoteWorkflow_1.decideAcceptance)({ ...base, requestedVersion: 1 }).ok, false);
        strict_1.default.equal((0, quoteWorkflow_1.decideAcceptance)({ ...base, status: "cancelled" }).ok, false);
        strict_1.default.equal((0, quoteWorkflow_1.decideAcceptance)({ ...base, validUntilMs: base.nowMs - 1 }).ok, false);
        strict_1.default.equal((0, quoteWorkflow_1.decideAcceptance)({ ...base, authorised: false }).ok, false);
    });
    (0, node_test_1.it)("keeps advance payment awaiting confirmation until payment is verified", () => {
        const waiting = (0, quoteWorkflow_1.decideAcceptance)({ ...base, paymentRequirement: "advance" });
        strict_1.default.equal(waiting.ok, true);
        if (waiting.ok)
            strict_1.default.equal(waiting.substatus, "awaiting_payment");
        strict_1.default.equal((0, quoteWorkflow_1.shouldMoveToConfirmedAfterPayment)({
            acceptedVersion: 2,
            issuedVersion: 2,
            paymentVerified: false,
            status: "awaiting_customer_confirmation",
        }), false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldMoveToConfirmedAfterPayment)({
            acceptedVersion: 2,
            issuedVersion: 2,
            paymentVerified: true,
            status: "awaiting_customer_confirmation",
        }), true);
        strict_1.default.equal((0, quoteWorkflow_1.shouldMoveToConfirmedAfterPayment)({
            acceptedVersion: null,
            issuedVersion: 2,
            paymentVerified: true,
            status: "awaiting_customer_confirmation",
        }), false);
    });
    (0, node_test_1.it)("does not mark a booking paid because a payment link was opened", () => {
        strict_1.default.equal((0, paymentLink_1.paymentStatusAfterCustomerAction)("pending"), "pending");
        const deposit = (0, quoteWorkflow_1.paymentBuckets)({
            finalFarePence: 18000,
            amountReceivedPence: 5000,
            paymentRequirement: "advance",
        });
        strict_1.default.equal(deposit.stored, "partial");
        strict_1.default.equal(deposit.label, "Part paid");
        strict_1.default.equal(deposit.outstandingPence, 13000);
        const paid = (0, quoteWorkflow_1.paymentBuckets)({ finalFarePence: 18000, amountReceivedPence: 18000 });
        strict_1.default.equal(paid.stored, "paid");
    });
    (0, node_test_1.it)("rejects customer acceptance without a token or matching account", () => {
        strict_1.default.equal((0, quoteWorkflow_1.canCustomerAccept)({ authUid: "a", bookingUid: "b", tokenValid: false }), false);
        strict_1.default.equal((0, quoteWorkflow_1.canCustomerAccept)({ authUid: "a", bookingUid: "a", tokenValid: false }), true);
        strict_1.default.equal((0, quoteWorkflow_1.canCustomerAccept)({ tokenValid: true }), true);
        strict_1.default.equal((0, quoteWorkflow_1.isQuoteAdmin)("spirestaxis24@gmail.com"), true);
        strict_1.default.equal((0, quoteWorkflow_1.isQuoteAdmin)("customer@example.com"), false);
    });
});
(0, node_test_1.describe)("email jobs and status filters", () => {
    (0, node_test_1.it)("does not create a second job for the same event", () => {
        strict_1.default.equal((0, quoteWorkflow_1.emailEnqueueDecision)(null, "auto"), "create");
        strict_1.default.equal((0, quoteWorkflow_1.emailEnqueueDecision)({ status: "queued" }, "auto"), "skip");
        strict_1.default.equal((0, quoteWorkflow_1.emailEnqueueDecision)({ status: "sent" }, "auto"), "skip");
        strict_1.default.equal((0, quoteWorkflow_1.emailEnqueueDecision)({ status: "failed" }, "retry"), "requeue");
        strict_1.default.equal((0, quoteWorkflow_1.emailEnqueueDecision)({ status: "sent" }, "resend"), "create");
        strict_1.default.equal((0, quoteWorkflow_1.emailJobDocId)("b1", "quote", "3", 2), "b1__quote__3__resend_2");
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status: "confirmed" }), true);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "confirmed", confirmationEmailSentAt: "x" }, { status: "confirmed", confirmationEmailSentAt: "x" }), false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "confirmed" }, { status: "confirmed" }), false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "awaiting_customer_confirmation" }, { status: "confirmed" }), true);
    });
    (0, node_test_1.it)("keeps allocated and legacy paid rows in the existing filters", () => {
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "confirmed", adminStatus: "allocated" }, "allocated"), true);
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "confirmed", adminStatus: "allocated" }, "confirmed"), false);
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "paid" }, "completed"), true);
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "awaiting_customer_confirmation" }, "pending"), false);
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "awaiting_customer_confirmation" }, "awaiting_customer_confirmation"), true);
        strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status: "pending" }, "all"), true);
    });
});
(0, node_test_1.describe)("payment links", () => {
    const hosts = (0, paymentLink_1.paymentLinkAllowlist)("pay.example.test");
    (0, node_test_1.it)("allows configured https hosts and rejects unsafe or lookalike urls", () => {
        strict_1.default.equal((0, paymentLink_1.validatePaymentLinkUrl)("https://checkout.stripe.com/c/pay/cs_test_123", hosts).startsWith("https://checkout.stripe.com/"), true);
        strict_1.default.equal((0, paymentLink_1.validatePaymentLinkUrl)("https://pay.example.test/hosted", hosts), "https://pay.example.test/hosted");
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("http://checkout.stripe.com/pay", hosts));
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("https://user:pass@checkout.stripe.com/pay", hosts));
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("https://checkout.stripe.com.evil.test/pay", hosts));
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("https://checkout-stripe.com/pay", hosts));
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("javascript:alert(1)", hosts));
    });
});
(0, node_test_1.describe)("invoice paid state", () => {
    (0, node_test_1.it)("keeps paidAt when a later email write omits it", () => {
        const existing = [{ id: "ST-UKG-202610-002", invoiceNumber: "ST-UKG-202610-002", paidAt: "2026-10-20T12:00:00.000Z", lines: [] }];
        const staleEmail = [{ id: "ST-UKG-202610-002", invoiceNumber: "ST-UKG-202610-002", emailedAt: "2026-10-21T09:00:00.000Z", emailedTo: "a@example.com", emailStatus: "sent" }];
        const merged = (0, invoiceVault_1.mergeInvoiceRecords)(existing, staleEmail);
        strict_1.default.equal(merged[0].paidAt, "2026-10-20T12:00:00.000Z");
        strict_1.default.equal(merged[0].emailedTo, "a@example.com");
        const cleared = (0, invoiceVault_1.mergeInvoiceRecords)(merged, [{ id: "ST-UKG-202610-002", paidAt: null }]);
        strict_1.default.equal(cleared[0].paidAt, undefined);
        strict_1.default.equal(cleared[0].emailedTo, "a@example.com");
    });
    (0, node_test_1.it)("shows paid, unpaid or overdue without treating missing payment as paid", () => {
        const row = { id: "1", dueDate: "2026-10-01", lines: [{ quantity: 1, unitPrice: 10 }] };
        strict_1.default.equal((0, invoiceVault_1.invoicePaymentState)(row, "2026-10-20", 10), "overdue");
        strict_1.default.equal((0, invoiceVault_1.invoicePaymentState)({ ...row, paidAt: "2026-10-05" }, "2026-10-20", 10), "paid");
        strict_1.default.equal((0, invoiceVault_1.invoicePaymentState)({ ...row, dueDate: "" }, "2026-10-20", 10), "unpaid");
        strict_1.default.equal((0, invoiceVault_1.invoicePaymentState)(row, "2026-10-01", 10), "unpaid");
        strict_1.default.equal((0, invoiceVault_1.invoicePaymentState)(row, "2026-10-20", 0), "unpaid");
        strict_1.default.equal((0, invoiceVault_1.invoiceEmailState)({}), "not_sent");
        strict_1.default.equal((0, invoiceVault_1.invoiceEmailState)({ emailStatus: "queued" }), "queued");
        strict_1.default.equal((0, invoiceVault_1.invoiceEmailState)({ emailedAt: "2026-10-01" }), "sent");
        strict_1.default.equal((0, invoiceVault_1.invoiceEmailState)({ emailStatus: "failed", emailedAt: "2026-10-01" }), "failed");
        strict_1.default.equal((0, invoiceVault_1.invoicePaidDateLabel)("2026-10-20T12:00:00.000Z"), "2026-10-20");
        strict_1.default.equal((0, invoiceVault_1.invoicePaidDateLabel)(""), "");
    });
});
(0, node_test_1.describe)("booking reliability regressions", () => {
    (0, node_test_1.it)("confirms when a sufficient deposit was recorded before acceptance", () => {
        const result = (0, quoteWorkflow_1.decideAcceptance)({ status: "awaiting_customer_confirmation", quoteIssuedVersion: 3,
            requestedVersion: 3, nowMs: Date.now(), authorised: true, paymentRequirement: "advance", advancePaymentSatisfied: true });
        strict_1.default.equal(result.ok && result.nextStatus, "confirmed");
        strict_1.default.equal(result.ok && result.substatus, "");
        const insufficient = (0, quoteWorkflow_1.decideAcceptance)({ status: "awaiting_customer_confirmation", quoteIssuedVersion: 3,
            requestedVersion: 3, nowMs: Date.now(), authorised: true, paymentRequirement: "advance", advancePaymentSatisfied: false });
        strict_1.default.equal(insufficient.ok && insufficient.substatus, "awaiting_payment");
    });
    (0, node_test_1.it)("does not confirm a pending or cancelled job from stale legacy fields", () => {
        for (const status of ["pending", "awaiting_customer_confirmation", "cancelled"]) {
            strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)(null, { status, adminStatus: "confirmed", customerStatus: "confirmed" }), false);
            strict_1.default.equal((0, quoteWorkflow_1.effectiveWorkflowStatus)({ status, adminStatus: "confirmed" }), status);
            strict_1.default.equal((0, quoteWorkflow_1.bookingMatchesStatusFilter)({ status, customerStatus: "confirmed" }, "confirmed"), false);
        }
    });
    (0, node_test_1.it)("sends the first confirmation when a recipient is added later, but never resends a sent confirmation", () => {
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "confirmed" }, { status: "confirmed", email: "test@example.com" }), true);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "confirmed", email: "test@example.com" }, { status: "confirmed", email: "test@example.com" }), false);
        strict_1.default.equal((0, quoteWorkflow_1.shouldSendConfirmation)({ status: "confirmed" }, { status: "confirmed", email: "test@example.com", confirmationEmailSentAt: "sent" }), false);
    });
    (0, node_test_1.it)("allows the actual Shift4 payment host and rejects lookalikes", () => {
        const hosts = (0, paymentLink_1.paymentLinkAllowlist)();
        strict_1.default.equal((0, paymentLink_1.validatePaymentLinkUrl)("https://pay.shift4.com/link_example", hosts), "https://pay.shift4.com/link_example");
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("https://pay.shift4.com.evil.test/link_example", hosts));
        strict_1.default.throws(() => (0, paymentLink_1.validatePaymentLinkUrl)("https://pay-shift4.com/link_example", hosts));
    });
    (0, node_test_1.it)("keeps a 12.50 deposit against a 42.50 fare part paid with 30 outstanding", () => {
        strict_1.default.deepEqual((0, quoteWorkflow_1.paymentBuckets)({ finalFarePence: 4250, amountReceivedPence: 1250 }), {
            stored: "partial", label: "Part paid", outstandingPence: 3000,
        });
        strict_1.default.equal((0, quoteWorkflow_1.shouldMoveToConfirmedAfterPayment)({ acceptedVersion: 2, issuedVersion: 3, paymentVerified: true, status: "pending" }), false);
    });
});
