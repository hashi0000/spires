"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBookingPDF = generateBookingPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
const bankDetails_1 = require("./bankDetails");
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
    doc
        .fontSize(11)
        .text(`Booking Number: ${booking.bookingNumber || "N/A"}`)
        .text(`Customer: ${booking.hirerName || booking.name || "Customer"}`)
        .text(`Phone: ${booking.hirerPhone || booking.phone || ""}`)
        .text(`Email: ${booking.hirerEmail || booking.email || ""}`)
        .text(`Pickup: ${booking.pickupLocation || booking.pickup || ""}`)
        .text(`Destination: ${booking.destination || ""}`)
        .text(`Pickup Time: ${booking.pickupTime || dateLabel}`)
        .text(`Status: ${booking.status || "pending"}`);
    if (booking.flightNumber) {
        doc.text(`Flight: ${booking.flightNumber}`);
    }
    if (booking.terminal) {
        doc.text(`Terminal: ${booking.terminal}`);
    }
    if (booking.vehicleType) {
        const vt = booking.vehicleType === "8_seater" || booking.vehicleType === "8-seater"
            ? "8-seater"
            : booking.vehicleType === "standard"
                ? "Standard car"
                : String(booking.vehicleType);
        doc.text(`Vehicle requested: ${vt}`);
    }
    if (booking.passengers) {
        doc.text(`Passengers: ${booking.passengers}`);
    }
    if (booking.returnTrip && booking.returnDateTime) {
        doc.text(`Return: ${booking.returnDateTime}`);
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
    if (hasFare) {
        doc.text(`Fare: £${fare.toFixed(2)}`);
    }
    else {
        doc.text("Fare: To be confirmed");
    }
    if (booking.depositRequired) {
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
        doc.moveDown(0.3).text(`Notes: ${booking.notes}`);
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
