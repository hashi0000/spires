"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const pdfGenerator_1 = require("./pdfGenerator");
function decodePdfHex(hex) {
    let out = "";
    for (let i = 0; i + 1 < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return out;
}
function pdfText(buf) {
    const raw = buf.toString("latin1");
    const fromHex = [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => decodePdfHex(m[1]));
    const fromParen = [...raw.matchAll(/\(([^\\)]*(?:\\.[^\\)]*)*)\)/g)].map((m) => m[1].replace(/\\n/g, "\n").replace(/\\(.)/g, "$1"));
    return fromHex.concat(fromParen).join("");
}
const sample = {
    bookingNumber: "CUSTPMWWJ5",
    hirerName: "Kerry Wald",
    hirerPhone: "07845239475",
    hirerEmail: "kmerklwald@yahoo.com",
    pickupLocation: "HB Allen Centre Oxford",
    destination: "London Heathrow",
    pickupTime: "2026-10-17T04:00:00.000Z",
    dateTime: "2026-10-17T04:00:00.000Z",
    status: "confirmed",
    vehicleType: "standard",
    passengers: 1,
    paymentMethod: "cash",
    paymentStatus: "pending",
    actualFare: 87,
    notes: "Student rate",
    bookingMethod: "online",
};
(0, node_test_1.describe)("branded booking confirmation PDF", () => {
    (0, node_test_1.it)("formats dates and payment labels like the admin generator", () => {
        strict_1.default.equal(pdfGenerator_1.__pdfTest.formatPdfDate("2026-10-17T04:00:00.000Z"), "17/10/2026");
        strict_1.default.match(pdfGenerator_1.__pdfTest.formatPdfTime("2026-10-17T04:00:00.000Z"), /^\d{2}:\d{2}$/);
        strict_1.default.equal(pdfGenerator_1.__pdfTest.formatPaymentMethod("cash"), "CASH");
        strict_1.default.equal(pdfGenerator_1.__pdfTest.formatPaymentMethod(""), "TO BE CONFIRMED");
    });
    (0, node_test_1.it)("uses the branded confirmation layout instead of a plain text dump", async () => {
        const buf = await (0, pdfGenerator_1.generateBookingPDF)(sample, "confirmation");
        strict_1.default.ok(buf.length > 1500);
        const text = pdfText(buf);
        strict_1.default.match(text, /SPIRES TAXIS/);
        strict_1.default.match(text, /BOOKING CONFIRMATION/);
        strict_1.default.match(text, /Your Oxford Journey Starts Here/);
        strict_1.default.match(text, /CUSTPMWWJ5/);
        strict_1.default.match(text, /Trip Information/);
        strict_1.default.match(text, /Customer Details/);
        strict_1.default.match(text, /Journey Details/);
        strict_1.default.match(text, /Kerry Wald/);
        strict_1.default.match(text, /HB Allen Centre Oxford/);
        strict_1.default.match(text, /London Heathrow/);
        strict_1.default.match(text, /Standard Car/);
        strict_1.default.match(text, /£87.00/);
        strict_1.default.match(text, /To be paid by CASH/);
        strict_1.default.match(text, /Standard airport charge included/);
        strict_1.default.match(text, /Student rate/);
        strict_1.default.match(text, /Leave a Review on Google/);
        strict_1.default.doesNotMatch(text, /Status: confirmed/);
    });
    (0, node_test_1.it)("does not show the waiting policy for an Oxford to Heathrow drop off", async () => {
        const buf = await (0, pdfGenerator_1.generateBookingPDF)({ ...sample, airportCollection: false, destination: "Heathrow T5" }, "confirmation");
        const text = pdfText(buf);
        strict_1.default.doesNotMatch(text, /actual landing time/);
        strict_1.default.match(text, /Standard airport charge included/);
    });
    (0, node_test_1.it)("shows the waiting policy for an airport collection", async () => {
        const buf = await (0, pdfGenerator_1.generateBookingPDF)({
            ...sample,
            pickupLocation: "Heathrow T5",
            destination: "Oxford",
            airportCollection: true,
            flightNumber: "BA249",
        }, "confirmation");
        const text = pdfText(buf);
        strict_1.default.match(text, /Airport Collection/);
        strict_1.default.match(text, /actual landing time/);
        strict_1.default.match(text, /BA249/);
    });
});
