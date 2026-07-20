"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPIRES_BANK_DETAILS = void 0;
exports.isBankTransferMethod = isBankTransferMethod;
exports.bankTransferDetailsPlainText = bankTransferDetailsPlainText;
exports.normalizeBookingForEmail = normalizeBookingForEmail;
/** Bank transfer details for Cloud Function PDFs / emails */
exports.SPIRES_BANK_DETAILS = {
    accountName: "Spires Taxis LTD",
    sortCode: "04-06-05",
    accountNumber: "27751218",
};
function isBankTransferMethod(method) {
    if (!method)
        return false;
    const n = method.toLowerCase().replace(/_/g, " ").trim();
    return n === "bank transfer" || n.includes("bank");
}
function bankTransferDetailsPlainText() {
    const { accountName, sortCode, accountNumber } = exports.SPIRES_BANK_DETAILS;
    return [
        "Pay by bank transfer:",
        `Account name: ${accountName}`,
        `Sort code: ${sortCode}`,
        `Account number: ${accountNumber}`,
        "Please use your booking number as the payment reference.",
    ].join("\n");
}
/** Normalize customer-app and admin field names for emails/PDFs */
function normalizeBookingForEmail(booking, bookingId) {
    const pickupTime = booking.pickupTime || booking.dateTime || "";
    let pickupLabel = pickupTime;
    try {
        if (pickupTime && typeof pickupTime === "object" && typeof pickupTime.toDate === "function") {
            pickupLabel = pickupTime.toDate().toLocaleString("en-GB", { timeZone: "Europe/London" });
        }
        else if (pickupTime) {
            const d = new Date(pickupTime);
            if (!Number.isNaN(d.getTime())) {
                pickupLabel = d.toLocaleString("en-GB", { timeZone: "Europe/London" });
            }
        }
    }
    catch {
        /* keep raw */
    }
    return {
        ...booking,
        id: booking.id || bookingId,
        bookingNumber: booking.bookingNumber ||
            (bookingId ? `CUST${String(bookingId).slice(0, 6).toUpperCase()}` : "Pending"),
        hirerName: booking.hirerName || booking.name || "Customer",
        hirerPhone: booking.hirerPhone || booking.phone || "",
        hirerEmail: booking.hirerEmail || booking.email || "",
        email: booking.email || booking.hirerEmail || "",
        pickupLocation: booking.pickupLocation || booking.pickup || "",
        destination: booking.destination || "",
        pickupTime: pickupLabel,
        dateTime: booking.dateTime || pickupTime,
        paymentMethod: booking.paymentMethod || "",
        paymentStatus: booking.paymentStatus || "pending",
        actualFare: booking.actualFare,
        status: booking.status || "pending",
        notes: booking.notes || "",
        flightNumber: booking.flightNumber || "",
        terminal: booking.terminal || "",
        returnTrip: booking.returnTrip || false,
        returnDateTime: booking.returnDateTime || "",
        vehicleType: booking.vehicleType || "",
        passengers: booking.passengers,
        luggage: booking.luggage,
        depositRequired: booking.depositRequired === true,
        depositAmount: booking.depositAmount,
        depositStatus: booking.depositStatus || (booking.depositRequired ? "pending" : "not_required"),
    };
}
