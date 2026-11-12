"use strict";
/** Spires International booking rules. Missing brand stays Spires Taxis. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCTION_GA4 = exports.INTERNATIONAL_BRAND = exports.TAXIBRAND = void 0;
exports.brandOf = brandOf;
exports.internationalEnabled = internationalEnabled;
exports.chargeableFare = chargeableFare;
exports.vehicleDecision = vehicleDecision;
exports.newQuote = newQuote;
exports.approveFare = approveFare;
exports.applyPaymentNotice = applyPaymentNotice;
exports.confirmAfterPayment = confirmAfterPayment;
exports.skipsTaxisSideEffects = skipsTaxisSideEffects;
exports.skipsTaxisPaymentReceipt = skipsTaxisPaymentReceipt;
exports.measurementStream = measurementStream;
exports.measurementEvent = measurementEvent;
exports.TAXIBRAND = "spires_taxis";
exports.INTERNATIONAL_BRAND = "spires_international";
exports.PRODUCTION_GA4 = "G-RSE4NNBP64";
function brandOf(record) {
    return record?.brand === exports.INTERNATIONAL_BRAND ? exports.INTERNATIONAL_BRAND : exports.TAXIBRAND;
}
function internationalEnabled(flag) {
    return flag === true || flag === "true";
}
/** No International fare is approved. Client amount and brand are ignored. */
function chargeableFare(client) {
    void client;
    return {
        chargeable: false,
        fareApproved: false,
        farePence: null,
        reason: "No approved International fare. Ask for a quote. Nothing is charged.",
    };
}
function vehicleDecision(passengers, luggage, vehicle) {
    if (!Number.isInteger(passengers) || passengers < 1) {
        return { ok: false, error: "Enter at least 1 passenger." };
    }
    if (!Number.isInteger(luggage) || luggage < 0 || luggage > 12) {
        return { ok: false, error: "Enter luggage from 0 to 12 pieces." };
    }
    if (vehicle === "standard") {
        if (passengers > 4) {
            return { ok: false, error: "A Standard Car takes up to 4 passengers. Choose the 8 seater for a larger group." };
        }
        if (luggage > 4) {
            return { ok: false, error: "That amount of luggage needs the 8 seater." };
        }
        return { ok: true };
    }
    if (vehicle !== "vito_8")
        return { ok: false, error: "Choose a Standard Car or an 8 seater." };
    if (passengers > 8)
        return { ok: false, error: "The 8 seater takes up to 8 passengers." };
    if (luggage > 8)
        return { ok: false, error: "The 8 seater can take up to 8 large bags. Ask us to quote extra luggage." };
    return { ok: true };
}
function newQuote() {
    return {
        brand: exports.INTERNATIONAL_BRAND,
        status: "quote_requested",
        paymentStatus: "not_required",
        fareApproved: false,
        farePence: null,
        appliedEventIds: [],
        driverNotified: false,
        confirmationSent: false,
    };
}
/** Staff can attach an approved fare later. A preview or client amount cannot. */
function approveFare(booking, farePence, approvedByStaff) {
    if (!approvedByStaff)
        return { error: "Only staff can approve a fare." };
    if (!Number.isInteger(farePence) || farePence < 50)
        return { error: "An approved fare must be at least 50 pence." };
    if (booking.status === "cancelled" || booking.status === "confirmed")
        return { error: "This booking can no longer take a new fare." };
    return {
        ...booking,
        fareApproved: true,
        farePence,
        status: "awaiting_payment",
        paymentStatus: "awaiting_payment",
        driverNotified: false,
        confirmationSent: false,
    };
}
function applyPaymentNotice(booking, notice) {
    if (booking.brand !== exports.INTERNATIONAL_BRAND) {
        return { state: booking, duplicate: false, accepted: false, reason: "Not an International booking." };
    }
    if (!notice.id)
        return { state: booking, duplicate: false, accepted: false, reason: "Payment notice has no id." };
    if (booking.appliedEventIds.includes(notice.id)) {
        return { state: booking, duplicate: true, accepted: true };
    }
    if (!booking.fareApproved || booking.farePence == null) {
        return { state: booking, duplicate: false, accepted: false, reason: "No approved fare. Nothing was charged." };
    }
    if (booking.status === "cancelled") {
        return { state: booking, duplicate: false, accepted: false, reason: "This booking is cancelled." };
    }
    if (notice.type === "payment_intent.succeeded") {
        if (notice.amountPence !== booking.farePence) {
            return { state: booking, duplicate: false, accepted: false, reason: "The paid amount does not match the approved fare." };
        }
        if (booking.paymentStatus === "paid") {
            return {
                state: { ...booking, appliedEventIds: [...booking.appliedEventIds, notice.id] },
                duplicate: true,
                accepted: true,
            };
        }
        return {
            state: {
                ...booking,
                status: "payment_received",
                paymentStatus: "paid",
                appliedEventIds: [...booking.appliedEventIds, notice.id],
                driverNotified: false,
                confirmationSent: false,
            },
            duplicate: false,
            accepted: true,
        };
    }
    if (notice.type === "payment_intent.payment_failed") {
        if (booking.paymentStatus === "paid") {
            return { state: { ...booking, appliedEventIds: [...booking.appliedEventIds, notice.id] }, duplicate: false, accepted: true };
        }
        return {
            state: {
                ...booking,
                status: "awaiting_payment",
                paymentStatus: "failed",
                appliedEventIds: [...booking.appliedEventIds, notice.id],
                driverNotified: false,
                confirmationSent: false,
            },
            duplicate: false,
            accepted: true,
        };
    }
    if (notice.type === "checkout.session.expired") {
        if (booking.paymentStatus === "paid") {
            return { state: { ...booking, appliedEventIds: [...booking.appliedEventIds, notice.id] }, duplicate: false, accepted: true };
        }
        return {
            state: {
                ...booking,
                status: "awaiting_payment",
                paymentStatus: "abandoned",
                appliedEventIds: [...booking.appliedEventIds, notice.id],
                driverNotified: false,
                confirmationSent: false,
            },
            duplicate: false,
            accepted: true,
        };
    }
    if (booking.paymentStatus !== "paid" && booking.status !== "payment_received" && booking.status !== "confirmed") {
        return { state: booking, duplicate: false, accepted: false, reason: "There is no payment to refund." };
    }
    return {
        state: {
            ...booking,
            status: booking.status === "confirmed" ? "confirmed" : "payment_received",
            paymentStatus: "refunded",
            appliedEventIds: [...booking.appliedEventIds, notice.id],
            driverNotified: false,
            confirmationSent: booking.confirmationSent,
        },
        duplicate: false,
        accepted: true,
    };
}
/** Payment received is not a confirmation. Staff confirm only after the approved fare is paid. */
function confirmAfterPayment(booking) {
    if (booking.paymentStatus !== "paid" || booking.status !== "payment_received") {
        return { state: booking, error: "Confirm only after the approved fare has been paid. A driver is still not allocated." };
    }
    return {
        state: { ...booking, status: "confirmed", driverNotified: false, confirmationSent: true },
    };
}
function skipsTaxisSideEffects(data) {
    if (brandOf(data) !== exports.INTERNATIONAL_BRAND)
        return false;
    const status = String(data?.status || "");
    return status !== "confirmed" && status !== "allocated" && status !== "completed";
}
function skipsTaxisPaymentReceipt(data) {
    return brandOf(data) === exports.INTERNATIONAL_BRAND;
}
function measurementStream(data) {
    return brandOf(data) === exports.INTERNATIONAL_BRAND ? "international_unconfigured" : "taxis";
}
const LEAD_TYPES = new Set(["contact", "quote", "booking_request"]);
const MEASUREMENT_EVENTS = new Set(["generate_lead", "purchase", "refund", "booking_confirmed"]);
/** Preview analytics stay local. Production Spires Taxis GA4 is refused. */
function measurementEvent(input) {
    if (input.consent !== "granted")
        return { sent: false, reason: "consent" };
    if (!input.measurementId || !/^G-[A-Z0-9]+$/.test(input.measurementId))
        return { sent: false, reason: "no_stream" };
    if (input.measurementId === exports.PRODUCTION_GA4)
        return { sent: false, reason: "production_stream_blocked" };
    if (!MEASUREMENT_EVENTS.has(input.name))
        return { sent: false, reason: "event" };
    if (input.name === "generate_lead" && !LEAD_TYPES.has(String(input.params.lead_type)))
        return { sent: false, reason: "lead_type" };
    const key = `${input.name}:${input.dedupeKey}`;
    if (input.alreadySent.includes(key))
        return { sent: false, reason: "duplicate" };
    const params = { brand: exports.INTERNATIONAL_BRAND };
    if (input.name === "generate_lead")
        params.lead_type = input.params.lead_type;
    if (input.name === "purchase" || input.name === "refund") {
        params.currency = "GBP";
        params.value = input.params.value;
        params.transaction_id = input.params.transaction_id;
        params.payment_kind = input.params.payment_kind;
    }
    return { sent: true, event: { name: input.name, params } };
}
