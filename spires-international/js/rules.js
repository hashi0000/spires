(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SpiresInternational = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var INTERNATIONAL = "spires_international";
  var PRODUCTION_GA4 = "G-RSE4NNBP64";

  function brandOf(record) {
    return record && record.brand === INTERNATIONAL ? INTERNATIONAL : "spires_taxis";
  }

  function chargeableFare() {
    return {
      chargeable: false,
      fareApproved: false,
      farePence: null,
      reason: "No approved International fare. Ask for a quote. Nothing is charged.",
    };
  }

  function vehicleDecision(passengers, luggage, vehicle) {
    if (!Number.isInteger(passengers) || passengers < 1) return { ok: false, error: "Enter at least 1 passenger." };
    if (!Number.isInteger(luggage) || luggage < 0 || luggage > 12) return { ok: false, error: "Enter luggage from 0 to 12 pieces." };
    if (vehicle === "standard") {
      if (passengers > 4) return { ok: false, error: "A Standard Car takes up to 4 passengers. Choose the 8 seater for a larger group." };
      if (luggage > 4) return { ok: false, error: "That amount of luggage needs the 8 seater." };
      return { ok: true };
    }
    if (vehicle !== "vito_8") return { ok: false, error: "Choose a Standard Car or an 8 seater." };
    if (passengers > 8) return { ok: false, error: "The 8 seater takes up to 8 passengers." };
    if (luggage > 8) return { ok: false, error: "The 8 seater can take up to 8 large bags. Ask us to quote extra luggage." };
    return { ok: true };
  }

  function newQuote() {
    return {
      brand: INTERNATIONAL,
      status: "quote_requested",
      paymentStatus: "not_required",
      fareApproved: false,
      farePence: null,
      appliedEventIds: [],
      driverNotified: false,
      confirmationSent: false,
    };
  }

  function approveFare(booking, farePence, approvedByStaff) {
    if (!approvedByStaff) return { error: "Only staff can approve a fare." };
    if (!Number.isInteger(farePence) || farePence < 50) return { error: "An approved fare must be at least 50 pence." };
    if (booking.status === "cancelled" || booking.status === "confirmed") return { error: "This booking can no longer take a new fare." };
    return Object.assign({}, booking, {
      fareApproved: true,
      farePence: farePence,
      status: "awaiting_payment",
      paymentStatus: "awaiting_payment",
      driverNotified: false,
      confirmationSent: false,
    });
  }

  function applyPaymentNotice(booking, notice) {
    if (booking.brand !== INTERNATIONAL) return { state: booking, duplicate: false, accepted: false, reason: "Not an International booking." };
    if (!notice.id) return { state: booking, duplicate: false, accepted: false, reason: "Payment notice has no id." };
    if (booking.appliedEventIds.indexOf(notice.id) !== -1) return { state: booking, duplicate: true, accepted: true };
    if (!booking.fareApproved || booking.farePence == null) {
      return { state: booking, duplicate: false, accepted: false, reason: "No approved fare. Nothing was charged." };
    }
    if (booking.status === "cancelled") return { state: booking, duplicate: false, accepted: false, reason: "This booking is cancelled." };
    function noted(extra) {
      return Object.assign({}, booking, extra, { appliedEventIds: booking.appliedEventIds.concat(notice.id), driverNotified: false });
    }
    if (notice.type === "payment_intent.succeeded") {
      if (notice.amountPence !== booking.farePence) {
        return { state: booking, duplicate: false, accepted: false, reason: "The paid amount does not match the approved fare." };
      }
      if (booking.paymentStatus === "paid") return { state: noted({}), duplicate: true, accepted: true };
      return {
        state: noted({ status: "payment_received", paymentStatus: "paid", confirmationSent: false }),
        duplicate: false,
        accepted: true,
      };
    }
    if (notice.type === "payment_intent.payment_failed") {
      if (booking.paymentStatus === "paid") return { state: noted({}), duplicate: false, accepted: true };
      return { state: noted({ status: "awaiting_payment", paymentStatus: "failed", confirmationSent: false }), duplicate: false, accepted: true };
    }
    if (notice.type === "checkout.session.expired") {
      if (booking.paymentStatus === "paid") return { state: noted({}), duplicate: false, accepted: true };
      return { state: noted({ status: "awaiting_payment", paymentStatus: "abandoned", confirmationSent: false }), duplicate: false, accepted: true };
    }
    if (booking.paymentStatus !== "paid" && booking.status !== "payment_received" && booking.status !== "confirmed") {
      return { state: booking, duplicate: false, accepted: false, reason: "There is no payment to refund." };
    }
    return {
      state: noted({
        status: booking.status === "confirmed" ? "confirmed" : "payment_received",
        paymentStatus: "refunded",
        confirmationSent: booking.confirmationSent,
      }),
      duplicate: false,
      accepted: true,
    };
  }

  function confirmAfterPayment(booking) {
    if (booking.paymentStatus !== "paid" || booking.status !== "payment_received") {
      return { state: booking, error: "Confirm only after the approved fare has been paid. A driver is still not allocated." };
    }
    return { state: Object.assign({}, booking, { status: "confirmed", driverNotified: false, confirmationSent: true }) };
  }

  function measurementEvent(input) {
    var leadTypes = { contact: 1, quote: 1, booking_request: 1 };
    var names = { generate_lead: 1, purchase: 1, refund: 1, booking_confirmed: 1 };
    if (input.consent !== "granted") return { sent: false, reason: "consent" };
    if (!input.measurementId || !/^G-[A-Z0-9]+$/.test(input.measurementId)) return { sent: false, reason: "no_stream" };
    if (input.measurementId === PRODUCTION_GA4) return { sent: false, reason: "production_stream_blocked" };
    if (!names[input.name]) return { sent: false, reason: "event" };
    if (input.name === "generate_lead" && !leadTypes[String(input.params.lead_type)]) return { sent: false, reason: "lead_type" };
    var key = input.name + ":" + input.dedupeKey;
    if (input.alreadySent.indexOf(key) !== -1) return { sent: false, reason: "duplicate" };
    var params = { brand: INTERNATIONAL };
    if (input.name === "generate_lead") params.lead_type = input.params.lead_type;
    if (input.name === "purchase" || input.name === "refund") {
      params.currency = "GBP";
      params.value = input.params.value;
      params.transaction_id = input.params.transaction_id;
      params.payment_kind = input.params.payment_kind;
    }
    return { sent: true, event: { name: input.name, params: params } };
  }

  function statusLabel(status) {
    return {
      quote_requested: "Quote requested",
      awaiting_payment: "Awaiting payment",
      payment_received: "Payment received",
      confirmed: "Confirmed",
      cancelled: "Cancelled",
    }[status] || status;
  }

  function paymentLabel(status) {
    return {
      not_required: "No payment yet",
      awaiting_payment: "Awaiting payment",
      paid: "Paid",
      failed: "Payment failed",
      abandoned: "Checkout left unfinished",
      refunded: "Refunded",
    }[status] || status;
  }

  return {
    INTERNATIONAL: INTERNATIONAL,
    PRODUCTION_GA4: PRODUCTION_GA4,
    brandOf: brandOf,
    chargeableFare: chargeableFare,
    vehicleDecision: vehicleDecision,
    newQuote: newQuote,
    approveFare: approveFare,
    applyPaymentNotice: applyPaymentNotice,
    confirmAfterPayment: confirmAfterPayment,
    measurementEvent: measurementEvent,
    statusLabel: statusLabel,
    paymentLabel: paymentLabel,
  };
});
