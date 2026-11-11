import { buildAdvertisingReport, formatGbp, sourceLabel, type AdvertisingBookingInput, type SpendEntryInput } from "./advertisingResults";

const period = { from: "2026-11-01", to: "2026-11-30", dateBasis: "journey" as const, manualSpendIsComplete: false, adsConnected: false, spend: [] as SpendEntryInput[] };

function booking(overrides: AdvertisingBookingInput): AdvertisingBookingInput {
  return {
    id: "b1",
    bookingNumber: "SP1",
    status: "completed",
    pickupTime: "2026-11-10T09:00:00Z",
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-10T18:00:00Z",
    pickupLocation: "Oxford",
    destination: "Heathrow Terminal 5",
    vehicleType: "standard",
    actualFare: 92,
    amountReceivedPence: 9200,
    ...overrides,
  };
}

describe("advertising results", () => {
  it("keeps enquiries, confirmed bookings, completed jobs and cancellations separate", () => {
    const report = buildAdvertisingReport([
      booking({ id: "e", bookingNumber: "E", status: "pending", amountReceivedPence: 0, actualFare: undefined, finalFarePence: undefined, issuedQuote: null }),
      booking({ id: "c", bookingNumber: "C", status: "confirmed", amountReceivedPence: 0 }),
      booking({ id: "a", bookingNumber: "A", status: "allocated", amountReceivedPence: 1000 }),
      booking({ id: "d", bookingNumber: "D", status: "completed" }),
      booking({ id: "x", bookingNumber: "X", status: "cancelled", amountReceivedPence: 0 }),
    ], period);
    expect(report.enquiries).toBe(1);
    expect(report.confirmed).toBe(2);
    expect(report.completed).toBe(1);
    expect(report.cancelled).toBe(1);
    expect(report.confirmedForCost).toBe(3);
  });

  it("does not treat a quoted fare as money received and does not turn a missing refund into zero", () => {
    const report = buildAdvertisingReport([
      booking({ id: "paid", bookingNumber: "P", actualFare: 100, amountReceivedPence: 4000 }),
      booking({ id: "refund", bookingNumber: "R", paymentStatus: "refunded", amountReceivedPence: 9200, amountRefundedPence: undefined }),
    ], period);
    expect(report.netPayments.pence).toBeNull();
    expect(report.netPayments.detail).toMatch(/not counted as zero/);
    expect(report.quoted.detail).toMatch(/separate from money received|Quoted fares/);
  });

  it("subtracts a recorded refund once and ignores a duplicate refund entry", () => {
    const report = buildAdvertisingReport([
      booking({
        amountReceivedPence: 9200,
        amountRefundedPence: 2000,
        paymentEntries: [
          { clientRequestId: "same", mode: "refund", amountPence: 2000 },
          { clientRequestId: "same", mode: "refund", amountPence: 2000 },
        ],
      }),
    ], period);
    expect(report.netPayments.pence).toBe(7200);
  });

  it("shows missing job costs as unknown and keeps contribution unknown", () => {
    const report = buildAdvertisingReport([
      booking({
        expenses: [{ type: "fuel", amount: 12 }],
        jobCosts: { driverPaymentPence: 4500, parkingPence: 0 },
      }),
    ], { ...period, manualSpendIsComplete: true, spend: [{ id: "s", date: "2026-11-03", amountPence: 4000, source: "manual", label: "Manual entry" }] });
    expect(report.costs.fuel.pence).toBe(1200);
    expect(report.costs.parking.pence).toBe(0);
    expect(report.costs.airport.pence).toBeNull();
    expect(report.costs.paymentFees.pence).toBeNull();
    expect(report.contribution.pence).toBeNull();
    expect(report.contribution.label).toBe("Contribution before overheads");
    expect(formatGbp(report.costs.airport.pence)).toBe("Unknown");
  });

  it("calculates contribution and costs only after every completed cost and the spend are known", () => {
    const report = buildAdvertisingReport([
      booking({
        jobCosts: { driverPaymentPence: 4000, fuelPence: 1000, parkingPence: 200, airportChargesPence: 500, paymentFeesPence: 300 },
      }),
    ], { ...period, manualSpendIsComplete: true, spend: [{ id: "s", date: "2026-11-03", amountPence: 1350, source: "manual", label: "Manual entry" }] });
    expect(report.netPayments.pence).toBe(9200);
    expect(report.contribution.pence).toBe(9200 - 6000 - 1350);
    expect(report.costPerConfirmed.pence).toBe(1350);
    expect(report.costPerCompletedPaid.pence).toBe(1350);
    expect(report.budgetLabel).toMatch(/£135/);
  });

  it("does not assume an unconnected ads account spent the monthly budget", () => {
    const report = buildAdvertisingReport([booking({})], period);
    expect(report.adsSpend.pence).toBeNull();
    expect(report.advertisingSpend.pence).toBeNull();
    expect(report.costPerConfirmed.pence).toBeNull();
    expect(report.manualSpend.pence).toBeNull();
  });

  it("excludes synthetic bookings, duplicate booking numbers and a priced return leg", () => {
    const report = buildAdvertisingReport([
      booking({ id: "live", bookingNumber: "SP9", bookingType: "return", returnTrip: true, actualFare: 180, amountReceivedPence: 18000 }),
      booking({ id: "leg", bookingNumber: "SP9R", notes: "Return for booking SP9", actualFare: 180, amountReceivedPence: 18000 }),
      booking({ id: "dup-old", bookingNumber: "SP9", status: "pending", updatedAt: "2026-11-01T00:00:00Z", amountReceivedPence: 0, actualFare: 1 }),
      booking({ id: "synthetic-measurement-1", bookingNumber: "SYN", syntheticMeasurementTest: true, hirerName: "Synthetic Measurement Test", pickupLocation: "Synthetic test pickup" }),
    ], period);
    expect(report.excluded.synthetic).toBe(1);
    expect(report.excluded.duplicate).toBe(1);
    expect(report.excluded.returnLegs).toBe(1);
    expect(report.completed).toBe(1);
    expect(report.netPayments.pence).toBe(18000);
    expect(report.quoted.pence).toBe(18000);
  });

  it("does not add the outbound and return amounts on top of the fare", () => {
    const report = buildAdvertisingReport([
      booking({ bookingType: "return", actualFare: 180, dueOnOutbound: 90, dueOnReturn: 90, amountReceivedPence: 18000 }),
    ], period);
    expect(report.quoted.pence).toBe(18000);
    expect(report.netPayments.pence).toBe(18000);
  });

  it("separates tracked Google Ads from customer reported and unknown sources", () => {
    const tracked = booking({
      id: "ads",
      bookingNumber: "ADS",
      marketingAttribution: { consent: "granted", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") },
      staffReportedSource: "google_ads",
    });
    const reported = booking({ id: "said", bookingNumber: "SAID", bookingMethod: "telephone", staffReportedSource: "google_ads" });
    const unknown = booking({ id: "who", bookingNumber: "WHO", bookingMethod: "whatsapp" });
    const report = buildAdvertisingReport([tracked, reported, unknown], period);
    expect(sourceLabel(tracked, new Date("2026-11-10T09:00:00Z"))).toBe("Tracked Google Ads");
    expect(sourceLabel(reported)).toBe("Customer reported Google Ads");
    expect(sourceLabel(unknown)).toBe("Unknown");
    expect(report.attribution).toMatchObject({ trackedGoogleAds: 1, customerReported: 1, unknown: 1, telephoneWithoutSource: 0, whatsappWithoutSource: 1 });
    expect(report.bySource.map((row) => row.label)).toEqual(expect.arrayContaining(["Tracked Google Ads", "Customer reported Google Ads", "Unknown"]));
    expect(report.byRoute[0].label).toBe("Heathrow and Oxford");
    expect(report.byVehicle[0].label).toBe("Standard");
    expect(report.sourcePrompts.map((row) => row.channel).sort()).toEqual(["telephone", "whatsapp"]);
  });

  it("does not count an expired click or a refused consent choice as Google Ads", () => {
    const expired = booking({ marketingAttribution: { consent: "granted", gclid: "old", expiresAt: Date.parse("2026-11-01T00:00:00Z") } });
    const refused = booking({ id: "no", bookingNumber: "NO", marketingAttribution: { consent: "denied", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") } });
    const report = buildAdvertisingReport([expired, refused], period);
    expect(report.attribution.trackedGoogleAds).toBe(0);
    expect(report.attribution.unknown).toBe(2);
  });

  it("uses Europe/London dates and leaves bookings outside the filter", () => {
    const report = buildAdvertisingReport([
      booking({ id: "in", bookingNumber: "IN", pickupTime: "2026-11-01T00:30:00Z" }),
      booking({ id: "out", bookingNumber: "OUT", pickupTime: "2026-10-31T22:30:00Z" }),
    ], period);
    expect(report.completed).toBe(1);
    expect(report.freshness).toMatch(/Europe\/London/);
  });

  it("groups an 8 seater without treating every booking as advertising", () => {
    const report = buildAdvertisingReport([
      booking({ vehicleType: "8_seater", bookingMethod: "telephone" }),
    ], period);
    expect(report.byVehicle[0].label).toBe("8 seater");
    expect(report.bySource[0].label).toBe("Unknown");
  });

  it("keeps a website quote separate from a portal request and does not treat an unpaid confirmation as revenue", () => {
    const report = buildAdvertisingReport([
      booking({ id: "web", bookingNumber: "WEB", status: "pending", source: "website", amountReceivedPence: 0 }),
      booking({ id: "app", bookingNumber: "APP", status: "pending", source: "customer_app", amountReceivedPence: 0 }),
      booking({ id: "open", bookingNumber: "OPEN", status: "confirmed", amountReceivedPence: 0 }),
    ], period);
    expect(report.byEnquiry.map((row) => row.label).sort()).toEqual(["Portal booking request", "Unknown", "Website quote"]);
    expect(report.unpaidConfirmed).toBe(1);
    expect(report.netPayments.pence).toBe(0);
  });
});
