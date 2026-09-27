import {
  AIRPORT_WAITING_POLICY,
  airportWaitingDisclaimerBody,
  airportWaitingDisclaimerTitle,
  airportWaitingScopeNote,
  bookingHasAirportCollection,
  bookingLooksLikeAirportTransfer,
  calculateAirportWaitingCharge,
} from "./airportWaitingPolicy";

describe("airport waiting charge", () => {
  it("does not charge at or before the 50 minute allowance", () => {
    expect(calculateAirportWaitingCharge(45)).toBe(0);
    expect(calculateAirportWaitingCharge(50)).toBe(0);
  });

  it("charges £10 for the first additional 30 minutes or part thereof", () => {
    expect(calculateAirportWaitingCharge(51)).toBe(10);
    expect(calculateAirportWaitingCharge(55)).toBe(10);
    expect(calculateAirportWaitingCharge(75)).toBe(10);
    expect(calculateAirportWaitingCharge(80)).toBe(10);
  });

  it("charges £20 once the next 30 minute block begins", () => {
    expect(calculateAirportWaitingCharge(81)).toBe(20);
    expect(calculateAirportWaitingCharge(90)).toBe(20);
    expect(calculateAirportWaitingCharge(110)).toBe(20);
    expect(calculateAirportWaitingCharge(111)).toBe(30);
  });
});

describe("airport waiting copy", () => {
  it("uses actual landing time and the current charge", () => {
    const body = airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY);
    expect(airportWaitingDisclaimerTitle()).toBe("Airport Collection");
    expect(body).toContain("actual landing time");
    expect(body).toContain("50 minutes");
    expect(body).toContain("£10 per additional 30 minutes");
    expect(body).toContain("standard airport pickup charge is included");
    expect(body).not.toContain("complimentary");
    expect(body).not.toContain("£5 per 15");
    expect(body).not.toContain("Heathrow");
  });

  it("associates the policy with the return collection on a return booking", () => {
    const note = airportWaitingScopeNote({
      bookingType: "return",
      airportCollection: false,
      returnAirportCollection: true,
      returnPickupLocation: "Heathrow T5",
      returnDestination: "Oxford",
    });
    expect(note).toContain("return journey");
    expect(note).toContain("outbound drop off");
  });
});

describe("airport collection detection", () => {
  it("ignores outbound drop offs", () => {
    expect(bookingHasAirportCollection({ airportCollection: false })).toBe(false);
    expect(bookingLooksLikeAirportTransfer({ destination: "Heathrow T5" })).toBe(true);
    expect(bookingLooksLikeAirportTransfer({ pickupLocation: "Marston", destination: "Summertown" })).toBe(false);
  });
});
