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
  it("shows TBC on a confirmation without treating it as card payment", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      paymentMethod: "tbc",
      paymentStatus: "pending",
    });
    expect(html).toContain("Payment method: TBC");
    expect(html).not.toContain("Pay by bank transfer");
    expect(html).not.toContain("card payment");
  });

  it("shows Not decided yet when the customer has not chosen", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      paymentMethod: "undecided",
      paymentStatus: "pending",
    });
    expect(html).toContain("Payment method: NOT DECIDED YET");
  });

  it("keeps a one way booking on a single journey block", () => {
    const html = buildBookingConfirmationHtml(baseBooking);
    expect(html).toContain("Journey Details");
    expect(html).not.toContain("Outbound Journey");
    expect(html).not.toContain("Return Journey");
    expect(html).not.toContain("Airport Collection");
    expect(html).not.toContain("Payment Schedule");
    expect(html).toContain("Standard airport charge included");
  });

  it("does not show the waiting policy for Oxford to Heathrow drop off only", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      airportCollection: false,
      destination: "Heathrow T5",
    });
    expect(html).not.toContain("Airport Collection");
    expect(html).not.toContain("actual landing time");
    expect(html).toContain("Standard airport charge included");
  });

  it("shows the waiting policy for Heathrow to Oxford", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      pickupLocation: "Heathrow T5",
      destination: "Oxford",
      airportCollection: true,
      flightNumber: "BA249",
    });
    expect(html).toContain("Airport Collection");
    expect(html).toContain("actual landing time");
    expect(html).toContain("50 minutes");
    expect(html).toContain("£10 per additional 30 minutes");
    expect(html).toContain("standard airport pickup charge is included");
    expect(html).toContain("BA249");
    expect(html).not.toContain("complimentary");
  });

  it("shows the waiting policy for Gatwick to Oxford", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      pickupLocation: "Gatwick North",
      destination: "Oxford",
      airportCollection: true,
    });
    expect(html).toContain("Airport Collection");
    expect(html).toContain("actual landing time");
  });

  it("does not show the waiting policy for Oxford to Gatwick drop off only", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      destination: "Gatwick South",
      airportCollection: false,
    });
    expect(html).not.toContain("Airport Collection");
  });

  it("does not show the waiting policy for a non airport journey", () => {
    const html = buildBookingConfirmationHtml({
      ...baseBooking,
      pickupLocation: "Marston",
      destination: "Summertown",
      airportCollection: false,
    });
    expect(html).not.toContain("Airport Collection");
    expect(html).not.toContain("Standard airport charge included");
  });

  it("associates the waiting policy with the return collection on a return booking", () => {
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
    expect(html).toContain("return journey (airport collection)");
    expect(html).toContain("does not apply to the outbound drop off");
    expect(html).toContain("actual landing time");
    expect(html).toContain("50 minutes");
  });
});
