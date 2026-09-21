import { buildBookingConfirmationHtml } from "./pdfGenerator";
import { Booking } from "../types/types";

const baseBooking: Booking = {
  bookingNumber: "ST-TEST-1",
  dateTime: "2026-09-29T08:00:00.000Z",
  hirerName: "Alex Taylor",
  hirerAddress: "1 Example Street, Oxford",
  hirerPhone: "07700900000",
  bookingMethod: "telephone",
  pickupTime: "2026-09-29T08:00:00.000Z",
  pickupLocation: "Marston",
  destination: "Heathrow T5",
  status: "confirmed",
  actualFare: 174,
  paymentMethod: "cash",
  paymentStatus: "pending",
};

describe("booking confirmation PDF", () => {
  it("keeps a one-way booking on a single journey block", () => {
    const html = buildBookingConfirmationHtml(baseBooking);
    expect(html).toContain("Journey Details");
    expect(html).not.toContain("Outbound Journey");
    expect(html).not.toContain("Return Journey");
    expect(html).not.toContain("Waiting Time");
    expect(html).not.toContain("Payment Schedule");
  });

  it("separates outbound and return on a return booking", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      bookingType: "return",
      airportCollection: false,
      returnPickupTime: "2026-09-30T18:00:00.000Z",
      returnPickupLocation: "Heathrow T5",
      returnDestination: "Marston",
      returnAirportCollection: true,
      returnFlightNumber: "BA123",
      dueOnOutbound: 120,
      dueOnReturn: 40,
      depositAmount: 14,
    });
    expect(html).toContain("Outbound Journey");
    expect(html).toContain("Return Journey");
    expect(html).toContain("BA123");
    expect(html).toContain("Payment Schedule");
    expect(html).toContain("Due on outbound journey");
    expect(html).toContain("Airport Collection");
    expect(html).toContain("Waiting Time");
    expect(html).toContain("50 minutes");
  });

  it("does not show the waiting disclaimer for an airport drop-off only", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      airportCollection: false,
      destination: "Heathrow T5",
    });
    expect(html).not.toContain("Waiting Time");
  });
});
