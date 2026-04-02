"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBookingPDF = generateBookingPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
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
    doc.on("data", buffers.push.bind(buffers));
    // Header
    doc
        .fontSize(20)
        .text("Spires Taxis", { align: "center" })
        .moveDown(0.3)
        .fontSize(10)
        .text("📱 07776 897772 | 📧 bookings@spires-taxis.com", { align: "center" })
        .text("🌐 www.spires-taxis.com", { align: "center" })
        .moveDown();
    doc.moveDown();
    const docTitle = documentTitleMap[type] || "Booking Confirmation";
    doc
        .fontSize(16)
        .fillColor("#0f172a")
        .text(docTitle.toUpperCase(), { align: "center", underline: true })
        .fillColor("black");
    doc.moveDown();
    // Booking details
    const date = (0, date_fns_1.format)(new Date(booking.dateTime || Date.now()), "PPPp");
    doc
        .fontSize(11)
        .text(`Booking Number: ${booking.bookingNumber || "N/A"}`)
        .text(`Customer: ${booking.hirerName}`)
        .text(`Phone: ${booking.hirerPhone}`)
        .text(`Pickup: ${booking.pickupLocation}`)
        .text(`Destination: ${booking.destination}`)
        .text(`Pickup Time: ${booking.pickupTime}`)
        .text(`Status: ${booking.status}`)
        .text(`Date Created: ${date}`)
        .moveDown();
    const isPaymentType = type === "payment" || type === "payment_request" || type === "payment_receipt";
    if (isPaymentType) {
        doc
            .text(`Payment Method: ${booking.paymentMethod || "To be confirmed"}`)
            .text(`Payment Status: ${booking.paymentStatus || "pending"}`)
            .text(`Fare: £${booking.actualFare || 0}`)
            .moveDown();
        if (type === "payment_request") {
            doc
                .moveDown(0.5)
                .fontSize(12)
                .fillColor("red")
                .text("Payment Required", { align: "center", underline: true })
                .fillColor("black")
                .fontSize(10)
                .text("Please arrange payment for the above fare amount.", { align: "center" })
                .text("You can pay by cash, card, or contact us to arrange payment.", { align: "center" })
                .moveDown();
        }
    }
    doc
        .moveDown()
        .fontSize(10)
        .text("Thank you for choosing Spires Taxis.", { align: "center" })
        .moveDown(0.5)
        .text("⭐ We'd love your feedback!", { align: "center" })
        .moveDown(0.3)
        .fillColor("#4285F4")
        .text("📝 Leave us a review on Google:", { align: "center" })
        .text("https://g.page/r/CWu0N7lUD-YKEAI/review", { align: "center", link: "https://g.page/r/CWu0N7lUD-YKEAI/review" })
        .fillColor("black")
        .moveDown(0.5)
        .fillColor("blue")
        .text("⭐ Or leave a review on Trustpilot:", { align: "center" })
        .text("https://uk.trustpilot.com/evaluate/spires-taxis.com", { align: "center", link: "https://uk.trustpilot.com/evaluate/spires-taxis.com" })
        .fillColor("black");
    doc.end();
    const pdfBuffer = Buffer.concat(buffers);
    return pdfBuffer;
}
