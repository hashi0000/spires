import {
  hasPaymentSchedule,
  parseMoney,
  paymentScheduleValidationError,
  resolveBookingType,
  bookingHasAirportCollection,
} from "./bookingJourney";
import { AIRPORT_WAITING_POLICY, airportWaitingDisclaimerBody } from "./airportWaitingPolicy";

describe("booking journey helpers", () => {
  it("treats missing fields as a one-way booking", () => {
    expect(resolveBookingType({})).toBe("one_way");
    expect(resolveBookingType({ returnTrip: true } as any)).toBe("one_way");
  });

  it("treats a stored return leg as a return booking", () => {
    expect(
      resolveBookingType({
        returnPickupLocation: "Heathrow T5",
        returnDestination: "Marston",
      })
    ).toBe("return");
    expect(resolveBookingType({ bookingType: "return" })).toBe("return");
  });

  it("only counts airport collection, not an airport drop-off", () => {
    expect(bookingHasAirportCollection({ airportCollection: false })).toBe(false);
    expect(bookingHasAirportCollection({ airportCollection: true })).toBe(true);
    expect(bookingHasAirportCollection({ returnAirportCollection: true })).toBe(true);
  });

  it("validates a return payment schedule against the total fare", () => {
    expect(paymentScheduleValidationError(174, 14, 120, 40)).toBeNull();
    expect(paymentScheduleValidationError(174, 14, 120, 30)).toMatch(/must equal the total fare/);
    expect(paymentScheduleValidationError(174, null, null, null)).toBeNull();
  });

  it("does not require a payment schedule", () => {
    expect(hasPaymentSchedule({})).toBe(false);
    expect(hasPaymentSchedule({ dueOnOutbound: 120, dueOnReturn: 40 })).toBe(true);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("14")).toBe(14);
  });

  it("builds waiting copy from the central policy", () => {
    const body = airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY);
    expect(body).toContain("50 minutes");
    expect(body).toContain("£10 per additional 30 minutes");
    expect(body).not.toContain("Heathrow");
    expect(body).not.toContain("complimentary");
  });
});
