import {
  adsAttributionCategory,
  buildRoutePerformanceReport,
  classifyRouteService,
  summariseRouteLegs,
} from "./routePerformance";
import { buildGoogleAdsPeriodReport } from "./googleAdsPeriod";

const PERIOD = { from: "2026-11-01", to: "2026-11-18" } as const;
const NOW = new Date("2026-11-15T12:00:00Z");

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    bookingNumber: "SP1",
    enquiryAt: "2026-11-05",
    createdAt: "2026-11-05",
    status: "confirmed",
    actualFare: 100,
    amountReceivedPence: 0,
    staffReportedSource: "google_ads",
    pickupLocation: "Oxford",
    destination: "Heathrow Airport",
    ...overrides,
  };
}

describe("classifyRouteService", () => {
  test("classifies named airports including transfers that do not start in Oxford", () => {
    expect(classifyRouteService(booking({ pickupLocation: "Didcot", destination: "Heathrow Terminal 5" }))).toBe("Heathrow Airport");
    expect(classifyRouteService(booking({ destination: "Gatwick South Terminal" }))).toBe("Gatwick Airport");
    expect(classifyRouteService(booking({ destination: "Stansted Airport" }))).toBe("Stansted Airport");
    expect(classifyRouteService(booking({ destination: "Luton Airport" }))).toBe("Luton Airport");
    expect(classifyRouteService(booking({ destination: "Birmingham Airport" }))).toBe("Birmingham Airport");
    expect(classifyRouteService(booking({ destination: "London City Airport" }))).toBe("London City Airport");
    expect(classifyRouteService(booking({ destination: "Bristol Airport" }))).toBe("Bristol Airport");
  });

  test("recognises IATA codes and avoids bare city names for Birmingham and Bristol", () => {
    expect(classifyRouteService(booking({ destination: "LHR T5" }))).toBe("Heathrow Airport");
    expect(classifyRouteService(booking({ destination: "BHX" }))).toBe("Birmingham Airport");
    expect(classifyRouteService(booking({ destination: "Birmingham city centre" }))).toBe("Other Journeys");
    expect(classifyRouteService(booking({ destination: "Bristol Temple Meads" }))).toBe("Other Journeys");
  });

  test("classifies Cotswolds tours and unknown work safely", () => {
    expect(classifyRouteService(booking({ journeyType: "cotswolds", destination: "Bourton" }))).toBe("Cotswolds Tours");
    expect(classifyRouteService(booking({ destination: "Manchester Airport" }))).toBe("Other Airport Transfers");
    expect(classifyRouteService(booking({ destination: "Abingdon" }))).toBe("Other Journeys");
  });
});

describe("return and leg counting", () => {
  test("counts a Heathrow return as one booking, one return, two legs", () => {
    const row = booking({
      bookingType: "return",
      returnTrip: true,
      returnPickupTime: "2026-11-20T18:00:00Z",
      returnPickupLocation: "Heathrow Terminal 5",
      returnDestination: "Oxford",
      actualFare: 235,
      amountReceivedPence: 3500,
    });
    const legs = summariseRouteLegs(row, NOW);
    expect(legs.isReturn).toBe(true);
    expect(legs.legCount).toBe(2);

    const report = buildRoutePerformanceReport([row], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(1);
    expect(report.totals.returns).toBe(1);
    expect(report.totals.oneWay).toBe(0);
    expect(report.totals.journeyLegs).toBe(2);
    expect(report.rows[0].route).toBe("Heathrow Airport");
    expect(report.rows[0].agreedFarePence).toBe(23500);
  });

  test("counts a one-way Stansted booking as one leg", () => {
    const report = buildRoutePerformanceReport([
      booking({ destination: "Stansted Airport", bookingNumber: "ST1" }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(1);
    expect(report.totals.oneWay).toBe(1);
    expect(report.totals.returns).toBe(0);
    expect(report.totals.journeyLegs).toBe(1);
  });

  test("does not invent a return from two similar separate bookings", () => {
    const report = buildRoutePerformanceReport([
      booking({ id: "1", bookingNumber: "A", destination: "Heathrow" }),
      booking({
        id: "2",
        bookingNumber: "B",
        pickupLocation: "Heathrow",
        destination: "Oxford",
        enquiryAt: "2026-11-06",
      }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(2);
    expect(report.totals.returns).toBe(0);
    expect(report.totals.journeyLegs).toBe(2);
  });

  test("skips a linked return document when the parent is in the period", () => {
    const report = buildRoutePerformanceReport([
      booking({
        id: "parent",
        bookingNumber: "P1",
        bookingType: "return",
        returnTrip: true,
        returnPickupTime: "2026-11-21T10:00:00Z",
        actualFare: 235,
      }),
      booking({
        id: "child",
        bookingNumber: "P1-R",
        returnOfBookingNumber: "P1",
        notes: "Return for booking P1",
        pickupLocation: "Heathrow",
        destination: "Oxford",
        actualFare: 120,
      }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(1);
    expect(report.totals.agreedFarePence).toBe(23500);
  });

  test("completed outbound with upcoming return is not fully completed", () => {
    const legs = summariseRouteLegs(booking({
      bookingType: "return",
      returnTrip: true,
      outboundStatus: "completed",
      returnStatus: "confirmed",
      returnPickupTime: "2026-11-20T18:00:00Z",
      pickupTime: "2026-11-10T08:00:00Z",
    }), NOW);
    expect(legs.completedLegs).toBe(1);
    expect(legs.bookingFullyCompleted).toBe(false);
    expect(legs.upcomingLegs).toBe(1);
  });

  test("cancelled return leg does not inflate completed legs", () => {
    const legs = summariseRouteLegs(booking({
      bookingType: "return",
      returnTrip: true,
      outboundStatus: "completed",
      returnStatus: "cancelled",
      returnPickupTime: "2026-11-20T18:00:00Z",
      pickupTime: "2026-11-10T08:00:00Z",
    }), NOW);
    expect(legs.completedLegs).toBe(1);
    expect(legs.cancelledLegs).toBe(1);
    expect(legs.bookingFullyCompleted).toBe(true);
  });
});

describe("attribution categories", () => {
  test("keeps verified and likely distinct", () => {
    const verified = booking({
      staffReportedSource: "",
      marketingAttribution: {
        consent: "granted",
        gclid: "click-1",
        expiresAt: Date.parse("2026-12-01T00:00:00Z"),
      },
    });
    const likely = booking({ staffReportedSource: "google_ads" });
    const unknown = booking({ staffReportedSource: "", customerReportedSource: "", heardAbout: "" });
    expect(adsAttributionCategory(verified, NOW)).toBe("verified");
    expect(adsAttributionCategory(likely, NOW)).toBe("likely");
    expect(adsAttributionCategory(unknown, NOW)).toBe("other");

    const verifiedOnly = buildRoutePerformanceReport([verified, likely, unknown], {
      ...PERIOD,
      now: NOW,
      attributionFilter: "verified",
    });
    expect(verifiedOnly.totals.bookings).toBe(1);
    expect(verifiedOnly.jobs[0].attributionLabel).toBe("Verified Google Ads");

    const likelyOnly = buildRoutePerformanceReport([verified, likely, unknown], {
      ...PERIOD,
      now: NOW,
      attributionFilter: "likely",
    });
    expect(likelyOnly.totals.bookings).toBe(1);
    expect(likelyOnly.jobs[0].attributionLabel).toBe("Likely Google Ads");
  });
});

describe("edge cases and overview consistency", () => {
  test("cancelled bookings appear in counts but not confirmed fares", () => {
    const report = buildRoutePerformanceReport([
      booking({ id: "ok", bookingNumber: "OK", actualFare: 100 }),
      booking({ id: "cx", bookingNumber: "CX", status: "cancelled", actualFare: 90 }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(2);
    expect(report.totals.cancelledBookings).toBe(1);
    expect(report.totals.confirmedBookings).toBe(1);
    expect(report.totals.agreedFarePence).toBe(10000);
  });

  test("deposit and outstanding balance use bookingMoney without doubling returns", () => {
    const report = buildRoutePerformanceReport([
      booking({
        actualFare: 235,
        amountReceivedPence: 3500,
        depositRequired: true,
        depositStatus: "paid",
        depositAmount: 35,
        bookingType: "return",
        returnTrip: true,
        returnPickupTime: "2026-11-22T12:00:00Z",
      }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.agreedFarePence).toBe(23500);
    expect(report.totals.paymentsReceivedPence).toBe(3500);
    expect(report.totals.outstandingPence).toBe(20000);
  });

  test("historic booking without confirmation timestamp still uses enquiry or createdAt", () => {
    const report = buildRoutePerformanceReport([
      booking({ confirmedAt: undefined, enquiryAt: undefined, createdAt: "2026-11-04" }),
    ], { ...PERIOD, now: NOW });
    expect(report.totals.bookings).toBe(1);
    expect(report.jobs[0].acquisitionDate).toBe("2026-11-04");
  });

  test("Route Performance confirmed fares stay aligned with Google Ads period totals", () => {
    const bookings = [
      booking({ id: "1", bookingNumber: "SP108", actualFare: 108, destination: "Heathrow", customerReportedSource: "google_advert", staffReportedSource: "" }),
      booking({ id: "2", bookingNumber: "SP195", enquiryAt: "2026-11-08", actualFare: 195, destination: "Gatwick", staffReportedSource: "google_ads" }),
      booking({ id: "3", bookingNumber: "SP150", enquiryAt: "2026-11-12", status: "completed", actualFare: 150, destination: "Luton Airport", customerReportedSource: "google_ads", staffReportedSource: "" }),
    ];
    const ads = buildGoogleAdsPeriodReport(bookings, { ...PERIOD, spend: [], now: NOW });
    const routes = buildRoutePerformanceReport(bookings, { ...PERIOD, now: NOW });
    expect(routes.totals.confirmedBookings).toBe(ads.confirmedCount);
    expect(routes.totals.agreedFarePence).toBe(ads.confirmedFarePence);
  });
});
