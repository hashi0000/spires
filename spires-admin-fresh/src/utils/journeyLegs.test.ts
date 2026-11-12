import { Booking } from "../types/types";
import { getUpcomingBookings, returnsToReview } from "./bookingSchedule";
import {
  applyRequestedLegStatus,
  hasTimedReturn,
  journeyLegs,
  legsForQuickView,
  londonDayKey,
  proposedLegacyReturnCorrection,
} from "./journeyLegs";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-12T12:00:00Z");

function booking(partial: Partial<Booking> & { returnDateTime?: string; returnStatus?: string; outboundStatus?: string; returnDriverId?: string; customerStatus?: string }): Booking {
  return {
    id: partial.id || "sp355017",
    bookingNumber: partial.bookingNumber || "SP355017",
    dateTime: partial.dateTime || "2026-10-30T17:25:00Z",
    hirerName: "Customer",
    hirerAddress: "",
    hirerPhone: "",
    bookingMethod: "telephone",
    pickupTime: partial.pickupTime || "2026-10-30T17:25:00Z",
    pickupLocation: partial.pickupLocation || "10 Beech Crescent OX5 1DN",
    destination: partial.destination || "London Heathrow Terminal 2",
    status: partial.status || "confirmed",
    actualFare: partial.actualFare ?? 180,
    paymentStatus: partial.paymentStatus || "paid",
    amountReceivedPence: partial.amountReceivedPence ?? 18000,
    ...partial,
  };
}

function legacyReturn(partial: Partial<Booking> = {}): Booking {
  return booking({
    status: "completed",
    bookingType: "return",
    returnPickupTime: "2026-11-15T19:05:00Z",
    returnDateTime: "2026-11-15T19:05:00Z",
    returnPickupLocation: "London Heathrow Terminal 2",
    returnDestination: "10 Beech Crescent OX5 1DN",
    ...partial,
  });
}

describe("journey legs", () => {
  it("shows the confirmed return on its own day when the outbound is already in the past", () => {
    const row = legacyReturn({ status: "confirmed", paymentStatus: "paid" });
    const legs = journeyLegs(row, NOW);
    expect(legs[0].status).toBe("confirmed");
    expect(legs[1].needsReview).toBe(false);
    expect(legs[1].status).toBe("confirmed");
    expect(getUpcomingBookings([row], NOW, { withinMs: WEEK_MS }).map((item) => item.leg)).toEqual(["return"]);
    expect(proposedLegacyReturnCorrection(row, NOW)).toBeNull();
    expect(row.status).toBe("confirmed");
    expect(row.actualFare).toBe(180);
  });

  it("shows a completed outbound with a return inside the next 7 days", () => {
    const row = legacyReturn();
    const legs = journeyLegs(row, NOW);
    expect(legs).toHaveLength(2);
    expect(legs[0].status).toBe("completed");
    expect(legs[1].label).toBe("Return");
    expect(legs[1].status).toBe("needs_review");
    expect(legs[1].needsReview).toBe(true);
    expect(legs[1].driverId).toBe("");
    expect(legs[1].pickupLocation).toBe("London Heathrow Terminal 2");
    expect(legs[1].destination).toBe("10 Beech Crescent OX5 1DN");
    expect(legs[1].pickupAt?.toISOString()).toBe("2026-11-15T19:05:00.000Z");

    const upcoming = getUpcomingBookings([row], NOW, { withinMs: WEEK_MS });
    expect(upcoming.map((item) => item.leg)).toEqual(["return"]);
    expect(upcoming.map((item) => item.booking.bookingNumber)).toEqual(["SP355017"]);
    expect(upcoming[0].statusLabel).toBe("Needs review");
    expect(returnsToReview([row], NOW, WEEK_MS)).toEqual([]);
    expect(legsForQuickView(row, "upcoming", NOW).map((leg) => leg.leg)).toEqual(["return"]);
  });

  it("keeps both completed legs off the upcoming list and leaves the fare on the booking", () => {
    const row = legacyReturn({
      outboundStatus: "completed",
      returnStatus: "completed",
      returnDriverId: "driver-b",
    });
    expect(journeyLegs(row, NOW).every((leg) => leg.status === "completed")).toBe(true);
    expect(getUpcomingBookings([row], NOW, { withinMs: WEEK_MS })).toEqual([]);
    expect(row.actualFare).toBe(180);
    expect(row.amountReceivedPence).toBe(18000);
  });

  it("leaves a cancelled return out of upcoming journeys", () => {
    const row = legacyReturn({ outboundStatus: "completed", returnStatus: "cancelled" });
    expect(journeyLegs(row, NOW).find((leg) => leg.leg === "return")?.status).toBe("cancelled");
    expect(getUpcomingBookings([row], NOW, { withinMs: WEEK_MS })).toEqual([]);
    expect(proposedLegacyReturnCorrection(row, NOW)).toBeNull();
  });

  it("uses a different driver for the return", () => {
    const row = legacyReturn({
      status: "allocated",
      driverId: "driver-a",
      returnDriverId: "driver-b",
      outboundStatus: "completed",
      returnStatus: "allocated",
    });
    const legs = journeyLegs(row, NOW);
    expect(legs[0].driverId).toBe("driver-a");
    expect(legs[1].driverId).toBe("driver-b");
    expect(legs[1].needsReview).toBe(false);
    expect(getUpcomingBookings([row], NOW, { withinMs: WEEK_MS })[0].driverId).toBe("driver-b");
  });

  it("keeps one way bookings and open returns on the outbound journey", () => {
    const oneWay = booking({ status: "confirmed", pickupTime: "2026-11-14T10:00:00Z" });
    expect(hasTimedReturn(oneWay)).toBe(false);
    expect(journeyLegs(oneWay, NOW)).toHaveLength(1);
    expect(getUpcomingBookings([oneWay], NOW, { withinMs: WEEK_MS }).map((item) => item.leg)).toEqual(["outbound"]);

    const openReturn = booking({
      status: "confirmed",
      bookingType: "return",
      openReturn: true,
      returnDate: "2026-11-20",
      pickupTime: "2026-11-14T10:00:00Z",
      returnPickupLocation: "London Heathrow Terminal 2",
      returnDestination: "10 Beech Crescent OX5 1DN",
    });
    expect(hasTimedReturn(openReturn)).toBe(false);
    expect(journeyLegs(openReturn, NOW)).toHaveLength(1);
    expect(getUpcomingBookings([openReturn], NOW, { withinMs: WEEK_MS })).toHaveLength(1);
  });

  it("respects the 7 day window and the London day boundary", () => {
    const onTheBoundary = legacyReturn({ returnPickupTime: new Date(NOW.getTime() + WEEK_MS).toISOString(), returnDateTime: new Date(NOW.getTime() + WEEK_MS).toISOString() });
    const afterTheBoundary = legacyReturn({
      id: "later",
      returnPickupTime: new Date(NOW.getTime() + WEEK_MS + 1).toISOString(),
      returnDateTime: new Date(NOW.getTime() + WEEK_MS + 1).toISOString(),
    });
    expect(getUpcomingBookings([onTheBoundary], NOW, { withinMs: WEEK_MS })).toHaveLength(1);
    expect(getUpcomingBookings([afterTheBoundary], NOW, { withinMs: WEEK_MS })).toEqual([]);
    expect(returnsToReview([afterTheBoundary], NOW, WEEK_MS)).toHaveLength(1);
    expect(returnsToReview([onTheBoundary], NOW, WEEK_MS)).toEqual([]);

    const midnight = new Date("2026-11-12T23:30:00Z");
    const nextDay = legacyReturn({ returnPickupTime: "2026-11-13T00:00:00Z", returnDateTime: "2026-11-13T00:00:00Z" });
    expect(londonDayKey(midnight)).toBe("2026-11-12");
    expect(londonDayKey("2026-11-13T00:00:00Z")).toBe("2026-11-13");
    expect(legsForQuickView(nextDay, "today", midnight).map((leg) => leg.leg)).toEqual([]);
    expect(legsForQuickView(nextDay, "tomorrow", midnight).map((leg) => leg.leg)).toEqual(["return"]);
  });

  it("does not complete the return when the outbound is completed", () => {
    const previous = legacyReturn({ status: "allocated", driverId: "driver-a", returnStatus: undefined });
    const saved = applyRequestedLegStatus(previous, { ...previous, status: "completed" });
    expect(saved.outboundStatus).toBe("completed");
    expect(saved.returnStatus).toBe("needs_review");
    expect(saved.status).toBe("allocated");
    expect(saved.actualFare).toBe(180);
    expect(saved.amountReceivedPence).toBe(18000);
    expect(saved.paymentStatus).toBe("paid");
    expect(journeyLegs(saved, NOW).find((leg) => leg.leg === "return")?.status).toBe("needs_review");
  });

  it("completes the booking only when every required leg is resolved", () => {
    const previous = legacyReturn({ status: "allocated", outboundStatus: "completed", returnStatus: "allocated" });
    const completed = applyRequestedLegStatus(previous, { ...previous, returnStatus: "completed", status: "allocated" });
    expect(completed.status).toBe("completed");
    const cancelled = applyRequestedLegStatus(previous, { ...previous, returnStatus: "cancelled", status: "allocated" });
    expect(cancelled.status).toBe("completed");
    expect(cancelled.actualFare).toBe(previous.actualFare);
  });

  it("prepares a legacy correction without rewriting the stored booking", () => {
    const row = legacyReturn();
    const correction = proposedLegacyReturnCorrection(row, NOW);
    expect(correction).toMatchObject({
      bookingNumber: "SP355017",
      storedStatus: "completed",
      apply: false,
      proposed: {
        outboundStatus: "completed",
        returnStatus: "needs_review",
        status: "confirmed",
        returnDriverId: "",
      },
    });
    expect(row.status).toBe("completed");
    expect((row as { returnStatus?: string }).returnStatus).toBeUndefined();
    expect(correction?.unchanged).toEqual(["actualFare", "amountReceivedPence", "paymentStatus", "driverId"]);
  });

  it("does not assume a past return was completed", () => {
    const row = legacyReturn({ returnPickupTime: "2026-11-01T19:05:00Z", returnDateTime: "2026-11-01T19:05:00Z" });
    const ret = journeyLegs(row, NOW).find((leg) => leg.leg === "return");
    expect(ret?.status).toBe("needs_review");
    expect(getUpcomingBookings([row], NOW, { withinMs: WEEK_MS })).toEqual([]);
    expect(returnsToReview([row], NOW, WEEK_MS)).toHaveLength(1);
    expect(applyRequestedLegStatus(row, { ...row, notes: "Called the customer" }).status).toBe("completed");
  });
});
