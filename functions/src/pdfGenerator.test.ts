import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateBookingPDF, __pdfTest } from "./pdfGenerator";

function decodePdfHex(hex: string): string {
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const fromHex = [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => decodePdfHex(m[1]));
  const fromParen = [...raw.matchAll(/\(([^\\)]*(?:\\.[^\\)]*)*)\)/g)].map((m) =>
    m[1].replace(/\\n/g, "\n").replace(/\\(.)/g, "$1")
  );
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

describe("branded booking confirmation PDF", () => {
  it("formats dates and payment labels like the admin generator", () => {
    assert.equal(__pdfTest.formatPdfDate("2026-10-17T04:00:00.000Z"), "17/10/2026");
    assert.match(__pdfTest.formatPdfTime("2026-10-17T04:00:00.000Z"), /^\d{2}:\d{2}$/);
    assert.equal(__pdfTest.formatPaymentMethod("cash"), "CASH");
    assert.equal(__pdfTest.formatPaymentMethod(""), "TO BE CONFIRMED");
  });

  it("uses the branded confirmation layout instead of a plain text dump", async () => {
    const buf = await generateBookingPDF(sample, "confirmation");
    assert.ok(buf.length > 1500);
    const text = pdfText(buf);
    assert.match(text, /SPIRES TAXIS/);
    assert.match(text, /BOOKING CONFIRMATION/);
    assert.match(text, /Your Oxford Journey Starts Here/);
    assert.match(text, /CUSTPMWWJ5/);
    assert.match(text, /Trip Information/);
    assert.match(text, /Customer Details/);
    assert.match(text, /Journey Details/);
    assert.match(text, /Kerry Wald/);
    assert.match(text, /HB Allen Centre Oxford/);
    assert.match(text, /London Heathrow/);
    assert.match(text, /Standard Car/);
    assert.match(text, /£87.00/);
    assert.match(text, /To be paid by CASH/);
    assert.match(text, /Standard airport charge included/);
    assert.match(text, /Student rate/);
    assert.match(text, /Leave a Review on Google/);
    assert.doesNotMatch(text, /Status: confirmed/);
  });

  it("does not show the waiting policy for an Oxford to Heathrow drop off", async () => {
    const buf = await generateBookingPDF(
      { ...sample, airportCollection: false, destination: "Heathrow T5" },
      "confirmation"
    );
    const text = pdfText(buf);
    assert.doesNotMatch(text, /actual landing time/);
    assert.match(text, /Standard airport charge included/);
  });

  it("shows the waiting policy for an airport collection", async () => {
    const buf = await generateBookingPDF(
      {
        ...sample,
        pickupLocation: "Heathrow T5",
        destination: "Oxford",
        airportCollection: true,
        flightNumber: "BA249",
      },
      "confirmation"
    );
    const text = pdfText(buf);
    assert.match(text, /Airport Collection/);
    assert.match(text, /actual landing time/);
    assert.match(text, /BA249/);
  });
});
