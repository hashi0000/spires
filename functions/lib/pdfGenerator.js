"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBookingPDF = generateBookingPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
const bankDetails_1 = require("./bankDetails");
const airportWaitingPolicy_1 = require("./airportWaitingPolicy");
const vehicleTypes_1 = require("./vehicleTypes");
const documentTitleMap = {
    confirmation: "Booking Confirmation",
    booking_confirmation: "Booking Confirmation",
    payment: "Payment Receipt",
    payment_receipt: "Payment Receipt",
    payment_request: "Payment Request",
};
async function generateBookingPDF(booking, type = "booking_confirmation") {
    const doc = new pdfkit_1.default({ margin: 40 });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    // Header
    doc
        .fontSize(20)
        .text("Spires Taxis", { align: "center" })
        .moveDown(0.3)
        .fontSize(10)
        .text("07776 897772 | bookings@spires-taxis.com", { align: "center" })
        .text("www.spires-taxis.com", { align: "center" })
        .moveDown();
    const docTitle = documentTitleMap[type] || "Booking Confirmation";
    doc
        .fontSize(16)
        .fillColor("#0f172a")
        .text(docTitle.toUpperCase(), { align: "center", underline: true })
        .fillColor("black");
    doc.moveDown();
    let dateLabel = "N/A";
    try {
        const raw = booking.dateTime || booking.pickupTime || Date.now();
        const d = raw && typeof raw === "object" && typeof raw.toDate === "function"
            ? raw.toDate()
            : new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            dateLabel = (0, date_fns_1.format)(d, "PPPp");
        }
    }
    catch {
        /* keep N/A */
    }
    const paymentMethodLabel = (booking.paymentMethod || "To be confirmed")
        .toString()
        .replace(/_/g, " ");
    const writeWrapped = (label, value) => {
        doc.fontSize(11).text(`${label}: ${value || ""}`, { width: 500 });
    };
    writeWrapped("Booking Number", booking.bookingNumber || "N/A");
    writeWrapped("Customer", booking.hirerName || booking.name || "Customer");
    writeWrapped("Phone", booking.hirerPhone || booking.phone || "");
    writeWrapped("Email", booking.hirerEmail || booking.email || "");
    if ((0, airportWaitingPolicy_1.isReturnBooking)(booking)) {
        doc.moveDown(0.4).fontSize(12).text("OUTBOUND JOURNEY", { underline: true }).fontSize(11);
        writeWrapped("Date / pickup time", String(booking.pickupTime || dateLabel));
        writeWrapped("Pickup", booking.pickupLocation || booking.pickup || "");
        writeWrapped("Destination", booking.destination || "");
        writeWrapped("Airport collection", booking.airportCollection ? "Yes" : "No");
        if (booking.airportCollection && booking.flightNumber) {
            writeWrapped("Flight", booking.flightNumber);
        }
        doc.moveDown(0.4).fontSize(12).text("RETURN JOURNEY", { underline: true }).fontSize(11);
        writeWrapped("Date / pickup time", String(booking.returnPickupTime || booking.returnDateTime || ""));
        writeWrapped("Pickup", booking.returnPickupLocation || "");
        writeWrapped("Destination", booking.returnDestination || "");
        writeWrapped("Airport collection", booking.returnAirportCollection ? "Yes" : "No");
        if (booking.returnAirportCollection && booking.returnFlightNumber) {
            writeWrapped("Flight", booking.returnFlightNumber);
        }
    }
    else {
        writeWrapped("Pickup", booking.pickupLocation || booking.pickup || "");
        writeWrapped("Destination", booking.destination || "");
        writeWrapped("Pickup Time", String(booking.pickupTime || dateLabel));
        if (booking.airportCollection) {
            writeWrapped("Airport collection", "Yes");
        }
        if (booking.flightNumber) {
            writeWrapped("Flight", booking.flightNumber);
        }
        if (booking.returnTrip && booking.returnDateTime) {
            writeWrapped("Return", String(booking.returnDateTime));
        }
    }
    writeWrapped("Status", booking.status || "pending");
    if (booking.terminal) {
        writeWrapped("Terminal", booking.terminal);
    }
    if (booking.vehicleType) {
        writeWrapped("Vehicle Class", (0, vehicleTypes_1.formatVehicleTypeLabel)(booking.vehicleType));
        const examples = (0, vehicleTypes_1.vehicleClassExamples)(booking.vehicleType);
        if (examples) {
            doc.fontSize(10).fillColor("#555555").text(examples, { width: 500 }).fillColor("black");
        }
    }
    if (booking.passengers) {
        writeWrapped("Passengers", String(booking.passengers));
    }
    if ((0, airportWaitingPolicy_1.bookingHasAirportCollection)(booking)) {
        const scope = (0, airportWaitingPolicy_1.airportWaitingScopeNote)(booking);
        doc
            .moveDown(0.6)
            .fontSize(10)
            .fillColor("#334155")
            .text((0, airportWaitingPolicy_1.airportWaitingDisclaimerTitle)(), { underline: true })
            .fontSize(9)
            .fillColor("#4b5563");
        if (scope) {
            doc.text(scope, { width: 500, lineGap: 2 }).moveDown(0.2);
        }
        doc
            .text((0, airportWaitingPolicy_1.airportWaitingDisclaimerBody)(airportWaitingPolicy_1.AIRPORT_WAITING_POLICY), { width: 500, lineGap: 2 })
            .fillColor("black")
            .fontSize(11);
    }
    doc.moveDown();
    const fare = typeof booking.actualFare === "number"
        ? booking.actualFare
        : Number(booking.actualFare);
    const hasFare = Number.isFinite(fare);
    const isPaid = booking.paymentStatus === "paid";
    doc
        .text(`Payment Method: ${paymentMethodLabel}`)
        .text(`Payment Status: ${booking.paymentStatus || "pending"}`);
    const hasSchedule = (booking.dueOnOutbound != null && String(booking.dueOnOutbound) !== "") ||
        (booking.dueOnReturn != null && String(booking.dueOnReturn) !== "");
    if (hasFare) {
        doc.text(`Fare: £${fare.toFixed(2)}`);
    }
    else {
        doc.text("Fare: To be confirmed");
    }
    if ((0, airportWaitingPolicy_1.bookingLooksLikeAirportTransfer)(booking)) {
        doc.fontSize(10).text("Standard airport charge included").fontSize(11);
    }
    if (hasSchedule) {
        const deposit = Number(booking.depositAmount);
        const outbound = Number(booking.dueOnOutbound);
        const ret = Number(booking.dueOnReturn);
        doc.moveDown(0.4).fontSize(12).text("Payment Schedule", { underline: true }).fontSize(11);
        if (Number.isFinite(deposit))
            doc.text(`Deposit paid: £${deposit.toFixed(2)}`);
        if (Number.isFinite(outbound))
            doc.text(`Due on outbound journey: £${outbound.toFixed(2)}`);
        if (Number.isFinite(ret))
            doc.text(`Due on return journey: £${ret.toFixed(2)}`);
    }
    else if (booking.depositRequired) {
        const depAmt = Number(booking.depositAmount);
        const depLabel = booking.depositStatus === "paid"
            ? `Deposit: Paid${Number.isFinite(depAmt) ? ` (£${depAmt.toFixed(2)})` : ""}`
            : `Deposit required${Number.isFinite(depAmt) ? `: £${depAmt.toFixed(2)}` : ""}`;
        doc.text(depLabel);
    }
    if (type === "payment_request" && hasFare) {
        doc
            .moveDown(0.5)
            .fontSize(12)
            .fillColor("red")
            .text("Payment Required", { align: "center", underline: true })
            .fillColor("black")
            .fontSize(10)
            .text("Please arrange payment for the above fare amount.", {
            align: "center",
        })
            .moveDown();
    }
    if ((0, bankDetails_1.isBankTransferMethod)(booking.paymentMethod) && !isPaid) {
        const { accountName, sortCode, accountNumber } = bankDetails_1.SPIRES_BANK_DETAILS;
        doc
            .moveDown(0.5)
            .fontSize(11)
            .fillColor("#002147")
            .text("Pay by bank transfer", { underline: true })
            .fillColor("black")
            .fontSize(10)
            .text(`Account name: ${accountName}`)
            .text(`Sort code: ${sortCode}`)
            .text(`Account number: ${accountNumber}`)
            .text(`Please use booking number ${booking.bookingNumber || "as shown above"} as the payment reference.`)
            .moveDown();
    }
    if (booking.notes) {
        doc.moveDown(0.3).text(`Notes: ${booking.notes}`, { width: 500 });
    }
    doc
        .moveDown()
        .fontSize(10)
        .text("Thank you for choosing Spires Taxis.", { align: "center" })
        .moveDown(0.5)
        .text("We'd love your feedback!", { align: "center" })
        .moveDown(0.3)
        .fillColor("#4285F4")
        .text("Leave us a review on Google:", { align: "center" })
        .text("https://g.page/r/CWu0N7lUD-YKEAI/review", {
        align: "center",
        link: "https://g.page/r/CWu0N7lUD-YKEAI/review",
    })
        .fillColor("black")
        .moveDown(0.5)
        .fillColor("blue")
        .text("Or leave a review on Trustpilot:", { align: "center" })
        .text("https://uk.trustpilot.com/evaluate/spires-taxis.com", {
        align: "center",
        link: "https://uk.trustpilot.com/evaluate/spires-taxis.com",
    })
        .fillColor("black");
    doc.end();
    await new Promise((resolve, reject) => {
        doc.on("end", () => resolve());
        doc.on("error", reject);
    });
    return Buffer.concat(buffers);
}
