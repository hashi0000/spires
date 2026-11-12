import { advertisingDateRange, afterAdsBookingsPerDay, averageBookingValueChange, beforeAdsBookingsPerDay, bookingFrequencyChange, bookingPaceChange, buildAdvertisingReport, confirmedBookingRateChange, formatGbp, formatPace, formatRate, formatReturn, interpretAttribution, percentageChange, revenuePerDayChange, sourceLabel, type AdvertisingBookingInput, type SpendEntryInput } from "./advertisingResults";

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
    expect(report.contribution.label).toBe("Profit after advertising and recorded journey costs");
    expect(report.returnOnSpend.ratio).toBeNull();
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
    expect(report.returnOnSpend.ratio).toBeNull();
    expect(report.returnOnSpend.detail).toMatch(/No tracked Google Ads/);
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

  it("uses tracked payments for return on spend and keeps other bookings in profit", () => {
    const costs = { driverPaymentPence: 1000, fuelPence: 1000, parkingPence: 1000, airportChargesPence: 1000, paymentFeesPence: 1000 };
    const report = buildAdvertisingReport([
      booking({
        id: "ads",
        bookingNumber: "ADS",
        amountReceivedPence: 9200,
        marketingAttribution: { consent: "granted", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") },
        jobCosts: costs,
      }),
      booking({ id: "phone", bookingNumber: "PHONE", amountReceivedPence: 5000, bookingMethod: "telephone", jobCosts: costs }),
    ], { ...period, manualSpendIsComplete: true, spend: [{ id: "s", date: "2026-11-03", amountPence: 1350, source: "manual", label: "Manual entry" }] });
    expect(report.costPerConfirmed.pence).toBe(675);
    expect(report.returnOnSpend.ratio).toBeCloseTo(9200 / 1350);
    expect(formatReturn(report.returnOnSpend.ratio)).toBe("£6.81 for each £1 spent");
    expect(report.contribution.pence).toBe(9200 + 5000 - 10000 - 1350);
  });

  it("does not calculate return on spend from an unknown payment or zero spend", () => {
    const unknownPayment = buildAdvertisingReport([
      booking({
        id: "ads",
        bookingNumber: "ADS",
        amountReceivedPence: null,
        marketingAttribution: { consent: "granted", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") },
      }),
    ], { ...period, manualSpendIsComplete: true, spend: [{ id: "s", date: "2026-11-03", amountPence: 1350, source: "manual", label: "Manual entry" }] });
    expect(unknownPayment.returnOnSpend.ratio).toBeNull();
    expect(unknownPayment.returnOnSpend.detail).toMatch(/unrecorded payment/);
    const zeroSpend = buildAdvertisingReport([
      booking({ marketingAttribution: { consent: "granted", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") } }),
    ], { ...period, manualSpendIsComplete: true, spend: [{ id: "s", date: "2026-11-03", amountPence: 0, source: "manual", label: "Manual entry" }] });
    expect(zeroSpend.returnOnSpend.ratio).toBeNull();
    expect(zeroSpend.costPerConfirmed.pence).toBe(0);
  });

  it("compares bookings a day with the same number of earlier days", () => {
    const costs = { driverPaymentPence: 0, fuelPence: 0, parkingPence: 0, airportChargesPence: 0, paymentFeesPence: 0 };
    const onDay = (id: string, day: string, fare: number) => booking({
      id,
      bookingNumber: id,
      pickupTime: `${day}T12:00:00Z`,
      actualFare: fare,
      amountReceivedPence: fare * 100,
      jobCosts: costs,
    });
    const report = buildAdvertisingReport([
      onDay("a1", "2026-11-09", 40),
      onDay("a2", "2026-11-09", 60),
      onDay("b1", "2026-11-10", 80),
      onDay("b2", "2026-11-10", 90),
      onDay("b3", "2026-11-10", 100),
      onDay("ask", "2026-11-10", 10),
    ].map((row, index) => index === 5 ? { ...row, status: "pending" as const, actualFare: undefined, amountReceivedPence: 0, finalFarePence: undefined, issuedQuote: null } : row), {
      from: "2026-11-10",
      to: "2026-11-10",
      dateBasis: "journey",
      manualSpendIsComplete: false,
      adsConnected: false,
      spend: [],
      now: new Date("2026-11-15T12:00:00Z"),
    });
    expect(formatPace(report.earlierPace.bookingsPerDay)).toBe("2");
    expect(formatPace(report.selectedPace.bookingsPerDay)).toBe("3");
    expect(bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay)).toBe("Increase: 50%");
    expect(report.earlierPace.from).toBe("2026-11-09");
    expect(report.earlierPace.to).toBe("2026-11-09");
    expect(report.revenuePerDay.pence).toBe(27000);
    expect(report.averageBookingValue.pence).toBe(9000);
    expect(formatRate(report.confirmedRate)).toBe("75%");
    expect(report.confirmedRateLabel).toMatch(/3 of 4/);
  });

  it("keeps revenue per day unknown when a confirmed payment was not recorded", () => {
    const report = buildAdvertisingReport([
      booking({ id: "paid", bookingNumber: "P", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: 4000, actualFare: 40 }),
      booking({ id: "missing", bookingNumber: "M", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: null, actualFare: 50 }),
      booking({ id: "cancelled", bookingNumber: "X", status: "cancelled", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: undefined, actualFare: undefined, finalFarePence: undefined, issuedQuote: null }),
    ], { ...period, from: "2026-11-10", to: "2026-11-10", now: new Date("2026-11-15T12:00:00Z") });
    expect(report.revenuePerDay.pence).toBeNull();
    expect(report.revenuePerDay.detail).toMatch(/not counted as zero/);
    expect(report.averageBookingValue.pence).toBe(4500);
    expect(formatRate(report.confirmedRate)).toBe("100%");
  });

  it("does not let a cancellation with no payment become zero revenue", () => {
    const report = buildAdvertisingReport([
      booking({ id: "paid", bookingNumber: "P", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: 5000, actualFare: 50 }),
      booking({ id: "cancelled", bookingNumber: "X", status: "cancelled", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: undefined, actualFare: undefined, finalFarePence: undefined, issuedQuote: null }),
    ], { ...period, from: "2026-11-10", to: "2026-11-10", now: new Date("2026-11-15T12:00:00Z") });
    expect(report.revenuePerDay.pence).toBe(5000);
    expect(report.confirmedRateLabel).toMatch(/1 of 1/);
    expect(report.confirmedRateLabel).toMatch(/1 cancellation is counted separately/);
    expect(formatRate(report.confirmedRate)).toBe("100%");
  });

  it("does not calculate a daily rate for a day that is not finished", () => {
    const report = buildAdvertisingReport([
      booking({ id: "yesterday", bookingNumber: "Y", pickupTime: "2026-11-09T12:00:00Z" }),
      booking({ id: "today", bookingNumber: "T", pickupTime: "2026-11-10T12:00:00Z" }),
    ], { ...period, from: "2026-11-10", to: "2026-11-10", now: new Date("2026-11-10T12:00:00Z") });
    expect(report.selectedPace.bookingsPerDay).toBeNull();
    expect(report.revenuePerDay.pence).toBeNull();
    expect(report.revenuePerDay.detail).toMatch(/no finished day/);
    expect(bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay)).toBe("Change: not calculated");
    expect(report.confirmedRateLabel).toMatch(/left out of this comparison/);
    const mixed = buildAdvertisingReport([
      booking({ id: "yesterday", bookingNumber: "Y2", pickupTime: "2026-11-09T12:00:00Z", actualFare: 40, amountReceivedPence: 4000 }),
      booking({ id: "today", bookingNumber: "T2", pickupTime: "2026-11-10T12:00:00Z", actualFare: 80, amountReceivedPence: 8000 }),
    ], { ...period, from: "2026-11-09", to: "2026-11-10", now: new Date("2026-11-10T15:00:00Z") });
    expect(mixed.selectedPace.confirmed).toBe(1);
    expect(mixed.selectedPace.to).toBe("2026-11-09");
    expect(mixed.averageBookingValue.pence).toBe(4000);
    expect(mixed.frequency.map((point) => point.date)).toEqual(["2026-11-09"]);
    expect(mixed.frequency[0].confirmed).toBe(1);
    expect(report.frequency).toEqual([]);
  });

  it("keeps a missing payment unknown, leaves a cancellation out of the confirmed pace, drops the unfinished day, and does not turn a zero earlier pace into a percentage", () => {
    const blankFare = { actualFare: undefined, finalFarePence: undefined, issuedQuote: null, amountReceivedPence: undefined };
    const report = buildAdvertisingReport([
      booking({ id: "earlier-cancel", bookingNumber: "EC", status: "cancelled", pickupTime: "2026-11-09T12:00:00Z", ...blankFare }),
      booking({ id: "selected", bookingNumber: "S", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: null, actualFare: 40 }),
      booking({ id: "today", bookingNumber: "T", pickupTime: "2026-11-11T12:00:00Z", amountReceivedPence: 8000, actualFare: 80 }),
    ], { ...period, from: "2026-11-10", to: "2026-11-11", now: new Date("2026-11-11T12:00:00Z") });
    expect(report.selectedPace.from).toBe("2026-11-10");
    expect(report.selectedPace.to).toBe("2026-11-10");
    expect(report.selectedPace.confirmed).toBe(1);
    expect(report.earlierPace.bookingsPerDay).toBe(0);
    expect(report.earlierPace.included).toBe(1);
    expect(bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay)).toBe("Change: not calculated. The earlier period had no confirmed bookings");
    expect(report.frequencyChange).toBe("Increase: 0%");
    expect(report.revenuePerDay.pence).toBeNull();
    expect(report.revenuePerDayChange).toBe("Change: not calculated");
    expect(report.averageBookingValue.pence).toBe(4000);
    expect(report.confirmedRate).toBe(1);
    expect(report.frequency.map((point) => point.date)).toEqual(["2026-11-10"]);
    expect(report.frequency[0].bookings).toBe(1);
    const bothQuiet = buildAdvertisingReport([
      booking({ id: "only-cancel", bookingNumber: "OC", status: "cancelled", pickupTime: "2026-11-10T12:00:00Z", ...blankFare }),
    ], { ...period, from: "2026-11-10", to: "2026-11-10", now: new Date("2026-11-15T12:00:00Z") });
    expect(bookingPaceChange(bothQuiet.earlierPace.bookingsPerDay, bothQuiet.selectedPace.bookingsPerDay)).toBe("No change. Both periods had no confirmed bookings");
    expect(bothQuiet.confirmedRate).toBeNull();
    expect(bothQuiet.revenuePerDay.pence).toBeNull();
  });

  it("draws booking frequency from confirmed bookings on finished days", () => {
    const report = buildAdvertisingReport([
      booking({ id: "earlier", bookingNumber: "R", pickupTime: "2026-11-03T12:00:00Z" }),
      booking({ id: "quiet", bookingNumber: "Q", pickupTime: "2026-11-08T12:00:00Z" }),
      booking({ id: "kept", bookingNumber: "K", status: "confirmed", pickupTime: "2026-11-09T12:00:00Z" }),
      booking({ id: "cancelled", bookingNumber: "X", status: "cancelled", pickupTime: "2026-11-09T13:00:00Z" }),
      booking({ id: "enquiry", bookingNumber: "E", status: "pending", pickupTime: "2026-11-09T14:00:00Z", amountReceivedPence: undefined, actualFare: undefined }),
      booking({ id: "today", bookingNumber: "T", pickupTime: "2026-11-10T12:00:00Z" }),
      booking({ id: "created", bookingNumber: "C", status: "allocated", pickupTime: "2026-12-01T12:00:00Z", createdAt: "2026-11-08T08:00:00Z" }),
    ], { ...period, from: "2026-11-08", to: "2026-11-10", now: new Date("2026-11-10T15:00:00Z") });
    expect(report.frequency).toEqual([
      { date: "2026-11-08", bookings: 1, confirmed: 1, rollingAverage: 2 / 7, grossBookingRevenuePence: 9200, grossRollingAveragePence: 18400 / 7, spendPence: null },
      { date: "2026-11-09", bookings: 3, confirmed: 1, rollingAverage: 5 / 7, grossBookingRevenuePence: 9200, grossRollingAveragePence: 27600 / 7, spendPence: null },
    ]);
    const byEnquiry = buildAdvertisingReport([
      booking({ id: "created", bookingNumber: "C", status: "allocated", pickupTime: "2026-12-01T12:00:00Z", createdAt: "2026-11-08T08:00:00Z" }),
      booking({ id: "today", bookingNumber: "T", pickupTime: "2026-11-08T12:00:00Z", createdAt: "2026-11-10T08:00:00Z" }),
    ], { ...period, from: "2026-11-08", to: "2026-11-10", dateBasis: "enquiry", now: new Date("2026-11-10T15:00:00Z") });
    expect(byEnquiry.frequency).toEqual([
      { date: "2026-11-08", bookings: 1, confirmed: 1, rollingAverage: 1 / 7, grossBookingRevenuePence: 9200, grossRollingAveragePence: 9200 / 7, spendPence: null },
      { date: "2026-11-09", bookings: 0, confirmed: 0, rollingAverage: 1 / 7, grossBookingRevenuePence: 0, grossRollingAveragePence: 9200 / 7, spendPence: null },
    ]);
    expect(report.frequencyChange).toBe("Change: not calculated. The earlier period had no daily bookings");
  });

  it("overlays only dated Google Ads spend and leaves a missing day unknown", () => {
    const report = buildAdvertisingReport([
      booking({ id: "kept", bookingNumber: "K", pickupTime: "2026-11-09T12:00:00Z" }),
    ], {
      ...period,
      from: "2026-11-08",
      to: "2026-11-10",
      now: new Date("2026-11-10T15:00:00Z"),
      spend: [
        { id: "ads", date: "2026-11-09", amountPence: 250, source: "google_ads", label: "Google Ads" },
        { id: "zero", date: "2026-11-08", amountPence: 0, source: "google_ads", label: "Google Ads" },
        { id: "manual", date: "2026-11-08", amountPence: 900, source: "manual", label: "Manual" },
        { id: "today", date: "2026-11-10", amountPence: 500, source: "google_ads", label: "Google Ads" },
      ],
    });
    expect(report.frequency).toEqual([
      { date: "2026-11-08", bookings: 0, confirmed: 0, rollingAverage: 0, grossBookingRevenuePence: 0, grossRollingAveragePence: 0, spendPence: 0 },
      { date: "2026-11-09", bookings: 1, confirmed: 1, rollingAverage: 1 / 7, grossBookingRevenuePence: 9200, grossRollingAveragePence: 9200 / 7, spendPence: 250 },
    ]);
  });

  it("leaves gross booking revenue unknown when a confirmed fare is missing", () => {
    const report = buildAdvertisingReport([
      booking({ id: "known", bookingNumber: "K", pickupTime: "2026-11-08T12:00:00Z", actualFare: 40 }),
      booking({ id: "cancelled", bookingNumber: "X", status: "cancelled", pickupTime: "2026-11-08T13:00:00Z", actualFare: 200 }),
      booking({ id: "missing", bookingNumber: "M", pickupTime: "2026-11-09T12:00:00Z", actualFare: undefined, finalFarePence: undefined, issuedQuote: null }),
    ], { ...period, from: "2026-11-08", to: "2026-11-09", now: new Date("2026-11-12T12:00:00Z") });
    expect(report.frequency.map((point) => ({ date: point.date, gross: point.grossBookingRevenuePence, average: point.grossRollingAveragePence }))).toEqual([
      { date: "2026-11-08", gross: 4000, average: 4000 / 7 },
      { date: "2026-11-09", gross: null, average: null },
    ]);
  });

  it("leaves a percentage change uncalculated when the earlier finished period has no bookings", () => {
    const report = buildAdvertisingReport([
      booking({ id: "one", bookingNumber: "A", pickupTime: "2026-11-10T12:00:00Z" }),
      booking({ id: "two", bookingNumber: "B", pickupTime: "2026-11-10T13:00:00Z" }),
      booking({ id: "three", bookingNumber: "C", pickupTime: "2026-11-10T14:00:00Z" }),
    ], { ...period, from: "2026-11-10", to: "2026-11-10", now: new Date("2026-11-15T12:00:00Z") });
    expect(report.earlierPace.bookingsPerDay).toBe(0);
    expect(report.selectedPace.bookingsPerDay).toBe(3);
    expect(bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay)).toBe("Change: not calculated. The earlier period had no confirmed bookings");
    expect(bookingPaceChange(0, 0)).toBe("No change. Both periods had no confirmed bookings");
    expect(bookingPaceChange(4, 2)).toBe("Decrease: 50%");
    expect(bookingPaceChange(2, 2)).toBe("Increase: 0%");
    expect(bookingPaceChange(null, 0)).toBe("Change: not calculated");
    expect(percentageChange(null, 4000, "gross booking revenue")).toBe("Change: not calculated");
    expect(percentageChange(0, 0, "gross booking revenue")).toBe("No change. Both periods had no gross booking revenue");
    expect(percentageChange(0, 4000, "gross booking revenue")).toBe("Change: not calculated. The earlier period had no gross booking revenue");
    expect(percentageChange(4000, 2000, "gross booking revenue")).toBe("Decrease: 50%");
    expect(percentageChange(null, null, "enquiry records")).toBe("Change: not calculated");
    expect(bookingFrequencyChange(1, 1, 2, 1)).toBe("Increase: 100%");
    expect(bookingFrequencyChange(0, 1, 2, 1)).toBe("Change: not calculated. The earlier period had no daily bookings");
    expect(bookingFrequencyChange(0, 1, 0, 1)).toBe("No change. Both periods had no daily bookings");
    expect(bookingFrequencyChange(0, 0, 1, 1)).toBe("Change: not calculated");
    expect(revenuePerDayChange(null, 5000)).toBe("Change: not calculated");
    expect(revenuePerDayChange(0, 0)).toBe("No change. Both periods had no recorded revenue");
    expect(revenuePerDayChange(0, 5000)).toBe("Change: not calculated. The earlier period had no recorded revenue");
    expect(revenuePerDayChange(4000, 2000)).toBe("Decrease: 50%");
    expect(revenuePerDayChange(2000, 3000)).toBe("Increase: 50%");
    expect(averageBookingValueChange(null, 9200)).toBe("Change: not calculated");
    expect(averageBookingValueChange(0, 0)).toBe("No change. Both periods had no average booking value");
    expect(averageBookingValueChange(0, 9200)).toBe("Change: not calculated. The earlier period had no average booking value");
    expect(averageBookingValueChange(9200, 4600)).toBe("Decrease: 50%");
    expect(averageBookingValueChange(4600, 9200)).toBe("Increase: 100%");
    expect(confirmedBookingRateChange(null, 1)).toBe("Change: not calculated");
    expect(confirmedBookingRateChange(0, 0)).toBe("No change. Both periods had no confirmed booking rate");
    expect(confirmedBookingRateChange(0, 1)).toBe("Change: not calculated. The earlier period had no confirmed booking rate");
    expect(confirmedBookingRateChange(0.5, 0.25)).toBe("Decrease: 50%");
    expect(confirmedBookingRateChange(0.5, 1)).toBe("Increase: 100%");
  });

  it("keeps directly attributed bookings separate from customer reports, cancellations and enquiries", () => {
    const click = { consent: "granted" as const, gclid: "stored", expiresAt: Date.parse("2026-12-01T00:00:00Z") };
    const report = buildAdvertisingReport([
      booking({ id: "direct", bookingNumber: "D", marketingAttribution: click }),
      booking({ id: "said", bookingNumber: "S", staffReportedSource: "google_ads" }),
      booking({ id: "cancelled", bookingNumber: "X", status: "cancelled", marketingAttribution: click }),
      booking({ id: "asked", bookingNumber: "E", status: "pending", marketingAttribution: click }),
      booking({ id: "expired", bookingNumber: "OLD", marketingAttribution: { consent: "granted", gclid: "old", expiresAt: Date.parse("2026-11-01T00:00:00Z") } }),
      booking({ id: "refused", bookingNumber: "NO", marketingAttribution: { consent: "denied", gclid: "stored", expiresAt: Date.parse("2026-12-01T00:00:00Z") } }),
    ], { ...period, now: new Date("2026-11-15T12:00:00Z") });
    expect(report.directAds.confirmed).toBe(1);
    expect(report.directAds.customerReported).toBe(1);
    expect(report.directAds.cancelled).toBe(1);
    expect(report.directAds.enquiries).toBe(1);
    expect(report.otherSources.confirmed).toBe(1);
    expect(report.otherSources.customerReportedAds).toBe(1);
    expect(report.unknownAttribution.confirmed).toBe(2);
    expect(report.directAds.confirmed + report.otherSources.confirmed + report.unknownAttribution.confirmed).toBe(4);
    expect(report.directAds.detail).toMatch(/kept on its own/);
    expect(report.directAds.detail).not.toMatch(/reported by the customer/);
    expect(report.otherSources.detail).toMatch(/reported as Google Ads/);
    expect(report.businessGrowth.text).toBe("Not calculated");
    const todayLeftOut = buildAdvertisingReport([
      booking({ id: "yesterday", bookingNumber: "Y", pickupTime: "2026-11-09T12:00:00Z", marketingAttribution: click }),
      booking({ id: "today", bookingNumber: "TODAY", pickupTime: "2026-11-10T12:00:00Z", marketingAttribution: click }),
    ], { ...period, from: "2026-11-09", to: "2026-11-10", now: new Date("2026-11-10T15:00:00Z") });
    expect(todayLeftOut.directAds.confirmed).toBe(1);
    expect(todayLeftOut.attribution.included).toBe(1);
  });

  it("does not treat a stored click or the selected dates as the advertising start", () => {
    const report = buildAdvertisingReport([
      booking({
        id: "clicked",
        bookingNumber: "CLICK",
        pickupTime: "2026-11-09T12:00:00Z",
        marketingAttribution: { consent: "granted", gclid: "stored", expiresAt: Date.parse("2026-12-09T12:00:00Z") },
      }),
    ], { ...period, now: new Date("2026-11-15T12:00:00Z") });
    expect(report.businessGrowth.text).toBe("Not calculated");
    expect(report.businessGrowth.detail).toMatch(/No Google Ads start date is recorded/);
    expect(report.businessGrowth.detail).toMatch(/revenue stays unknown/);
    expect(report.businessGrowth.detail).toMatch(/stored Google click is not used/);
    expect(report.businessGrowth.detail).toMatch(/campaign creation date is not used/);
  });

  it("measures overall confirmed bookings before and after a recorded start date", () => {
    const onDay = (id: string, day: string, status: AdvertisingBookingInput["status"] = "completed") => booking({
      id,
      bookingNumber: id,
      status,
      pickupTime: `${day}T12:00:00Z`,
    });
    const options = {
      ...period,
      from: "2026-11-01",
      to: "2026-11-01",
      advertisingStartedOn: "2026-11-10",
      advertisingStartConfirmed: true,
      now: new Date("2026-11-11T15:00:00Z"),
    };
    const report = buildAdvertisingReport([
      onDay("a", "2026-11-09"),
      onDay("b", "2026-11-09"),
      onDay("c", "2026-11-10"),
      onDay("d", "2026-11-10"),
      onDay("e", "2026-11-10"),
      onDay("x", "2026-11-10", "cancelled"),
      onDay("today", "2026-11-11"),
    ], options);
    expect(report.businessGrowth.text).toBe("Increase: 50%");
    expect(report.businessGrowth.before?.days).toBe(report.businessGrowth.after?.days);
    expect(report.businessGrowth.before?.from).toBe("2026-11-09");
    expect(report.businessGrowth.after?.to).toBe("2026-11-10");
    expect(report.businessGrowth.detail).toMatch(/same number of days immediately before advertising started/);
    const partial = buildAdvertisingReport([
      booking({ id: "too-early", bookingNumber: "EARLY", pickupTime: "2026-10-21T12:00:00Z" }),
      booking({ id: "partial-before", bookingNumber: "PB", pickupTime: "2026-10-22T12:00:00Z" }),
      booking({ id: "partial-after", bookingNumber: "PA", pickupTime: "2026-11-10T12:00:00Z" }),
      booking({ id: "today-after", bookingNumber: "TODAY", pickupTime: "2026-11-11T12:00:00Z" }),
    ], { ...options, advertisingStartedOn: "2026-11-01", now: new Date("2026-11-11T12:00:00Z") });
    expect(partial.businessGrowth.before).toMatchObject({ from: "2026-10-22", to: "2026-10-31", days: 10, confirmed: 1 });
    expect(partial.businessGrowth.after).toMatchObject({ from: "2026-11-01", to: "2026-11-10", days: 10, confirmed: 1 });
    const thirty = buildAdvertisingReport([
      booking({ id: "before-edge", bookingNumber: "BE", pickupTime: "2026-09-01T12:00:00Z" }),
      booking({ id: "before-out", bookingNumber: "BO", pickupTime: "2026-08-31T12:00:00Z" }),
      booking({ id: "after-edge", bookingNumber: "AE", pickupTime: "2026-10-30T12:00:00Z" }),
      booking({ id: "after-out", bookingNumber: "AO", pickupTime: "2026-10-31T12:00:00Z" }),
    ], { ...options, advertisingStartedOn: "2026-10-01", now: new Date("2026-12-15T12:00:00Z") });
    expect(thirty.businessGrowth.before).toMatchObject({ from: "2026-09-01", to: "2026-09-30", days: 30, confirmed: 1 });
    expect(thirty.businessGrowth.after).toMatchObject({ from: "2026-10-01", to: "2026-10-30", days: 30, confirmed: 1 });
    expect(report.businessGrowth.before?.summary).toMatch(/Total bookings: 2/);
    expect(report.businessGrowth.before?.summary).toMatch(/Confirmed bookings: 2/);
    expect(report.businessGrowth.after?.summary).toMatch(/Total bookings: 4/);
    expect(report.businessGrowth.after?.summary).toMatch(/Confirmed bookings: 3/);
    expect(report.businessGrowth.before?.summary).toMatch(/Completed bookings: 2/);
    expect(report.businessGrowth.after?.summary).toMatch(/Completed bookings: 3/);
    expect(report.businessGrowth.before?.summary).toMatch(/Bookings per day: 2/);
    expect(beforeAdsBookingsPerDay(report.businessGrowth.before?.days || 0, report.businessGrowth.before?.bookingsPerDay ?? null)).toBe("Before ads: 2 bookings per day.");
    expect(afterAdsBookingsPerDay(report.businessGrowth.after?.days || 0, report.businessGrowth.after?.bookingsPerDay ?? null)).toBe("After ads: 3 bookings per day.");
    expect(bookingPaceChange(report.businessGrowth.before?.bookingsPerDay ?? null, report.businessGrowth.after?.bookingsPerDay ?? null)).toBe("Increase: 50%");
    expect(report.businessGrowth.after?.summary).toMatch(/Bookings per day: 3/);
    expect(report.businessGrowth.before?.summary).toMatch(/Bookings per week: 14/);
    expect(report.businessGrowth.after?.summary).toMatch(/Bookings per week: 21/);
    expect(report.businessGrowth.before?.grossBookingRevenuePence).toBe(18400);
    expect(report.businessGrowth.after?.grossBookingRevenuePence).toBe(27600);
    expect(report.businessGrowth.before?.summary).toMatch(/Gross booking revenue: £184\.00/);
    expect(report.businessGrowth.before?.averageBookingPence).toBe(9200);
    expect(report.businessGrowth.after?.averageBookingPence).toBe(9200);
    expect(report.businessGrowth.before?.summary).toMatch(/Average booking value: £92\.00/);
    expect(report.businessGrowth.before?.enquiryVolume).toBeNull();
    expect(report.businessGrowth.after?.enquiryVolume).toBeNull();
    expect(report.businessGrowth.before?.summary).toMatch(/Enquiry volume: no enquiry records/);
    expect(report.businessGrowth.before?.summary).toMatch(/Returning customers: not identifiable/);
    expect(report.businessGrowth.before?.summary).toMatch(/New customers: not identifiable/);
    expect(report.businessGrowth.before?.returningCustomers).toBeNull();
    expect(report.businessGrowth.detail).not.toMatch(/New customers: 0/);
    expect(report.businessGrowth.after?.enquiryConversionRate).toBeNull();
    expect(report.businessGrowth.detail).not.toMatch(/Enquiry volume: 0/);
    expect(report.businessGrowth.after?.revenuePence).toBe(27600);
    expect(report.businessGrowth.detail).toMatch(/were 2 before 2026-11-10 and 3 from 2026-11-10 to 2026-11-10/);
    expect(report.businessGrowth.detail).toMatch(/Revenue increase: 50%/);
    expect(report.businessGrowth.detail).toMatch(/does not claim that all additional bookings were caused by Google Ads/);
    const missingPayment = buildAdvertisingReport([
      onDay("a", "2026-11-09"),
      booking({ id: "gap", bookingNumber: "GAP", pickupTime: "2026-11-10T12:00:00Z", amountReceivedPence: null }),
    ], options);
    expect(missingPayment.businessGrowth.before?.revenuePence).toBe(9200);
    expect(missingPayment.businessGrowth.after?.revenuePence).toBeNull();
    expect(missingPayment.businessGrowth.after?.grossBookingRevenuePence).toBe(9200);
    expect(missingPayment.businessGrowth.detail).toMatch(/Revenue change: not calculated/);
    expect(missingPayment.businessGrowth.limitations.join(" ")).toMatch(/no recorded payment/);
    expect(missingPayment.businessGrowth.limitations.join(" ")).toMatch(/not treated as zero/);
    const unconfirmed = buildAdvertisingReport([onDay("c", "2026-11-10")], { ...options, advertisingStartConfirmed: false });
    expect(unconfirmed.businessGrowth.text).toBe("Not calculated");
    expect(unconfirmed.businessGrowth.before).toBeNull();
    expect(unconfirmed.businessGrowth.detail).toMatch(/has not confirmed the Google Ads start date/);
    expect(unconfirmed.businessGrowth.limitations).toEqual([]);
    const withEnquiries = buildAdvertisingReport([
      onDay("a", "2026-11-09"),
      booking({ id: "enq-before", bookingNumber: "EB", status: "pending", createdAt: "2026-11-09T12:00:00Z", pickupTime: "2026-12-01T12:00:00Z" }),
      booking({ id: "enq-after", bookingNumber: "EA", status: "pending", createdAt: "2026-11-10T12:00:00Z", pickupTime: undefined, dateTime: undefined }),
      booking({ id: "enq-missing", bookingNumber: "EM", status: "awaiting_customer_confirmation", createdAt: undefined, pickupTime: "2026-11-09T12:00:00Z", dateTime: "2026-11-09T12:00:00Z" }),
    ], options);
    expect(withEnquiries.businessGrowth.before?.enquiryVolume).toBe(1);
    expect(withEnquiries.businessGrowth.after?.enquiryVolume).toBe(1);
    expect(withEnquiries.businessGrowth.before?.summary).toMatch(/Enquiry volume: 1/);
    expect(withEnquiries.businessGrowth.detail).toMatch(/1 enquiry record has no creation time/);
    expect(withEnquiries.businessGrowth.detail).toMatch(/The journey date is not used in its place/);
    expect(withEnquiries.businessGrowth.before?.enquiryConversionRate).toBeNull();
    expect(withEnquiries.businessGrowth.before?.summary).toMatch(/Enquiry to booking conversion rate: not measurable/);
    const measurable = buildAdvertisingReport([
      booking({ id: "enq", bookingNumber: "ENQ", status: "pending", createdAt: "2026-11-09T12:00:00Z", pickupTime: "2026-11-20T12:00:00Z" }),
      booking({ id: "booked", bookingNumber: "BOOKED", status: "completed", createdAt: "2026-11-09T15:00:00Z", pickupTime: "2026-11-09T12:00:00Z" }),
    ], options);
    expect(measurable.businessGrowth.before?.enquiryVolume).toBe(1);
    expect(measurable.businessGrowth.before?.enquiryConversionRate).toBe(0.5);
    expect(measurable.businessGrowth.before?.summary).toMatch(/Enquiry to booking conversion rate: 50%/);
    expect(measurable.businessGrowth.after?.enquiryConversionRate).toBeNull();
    expect(measurable.businessGrowth.after?.summary).toMatch(/Enquiry to booking conversion rate: not measurable/);
    const customers = buildAdvertisingReport([
      booking({ id: "first", bookingNumber: "FIRST", pickupTime: "2026-11-09T12:00:00Z", hirerPhone: "07776 897772", hirerName: "Alex" }),
      booking({ id: "again", bookingNumber: "AGAIN", pickupTime: "2026-11-10T12:00:00Z", hirerPhone: "447776897772" }),
      booking({ id: "named", bookingNumber: "NAMED", pickupTime: "2026-11-10T15:00:00Z", hirerName: "Alex", hirerPhone: "", email: "" }),
    ], options);
    expect(customers.businessGrowth.before?.newCustomers).toBe(1);
    expect(customers.businessGrowth.before?.returningCustomers).toBe(0);
    expect(customers.businessGrowth.after?.returningCustomers).toBe(1);
    expect(customers.businessGrowth.after?.newCustomers).toBe(0);
    expect(customers.businessGrowth.after?.unidentifiedCustomers).toBe(1);
    expect(customers.businessGrowth.after?.summary).toMatch(/Not identifiable: 1/);
    expect(customers.businessGrowth.after?.summary).not.toMatch(/07776/);
    const noBaseline = buildAdvertisingReport([onDay("c", "2026-11-10")], options);
    expect(noBaseline.businessGrowth.text).toMatch(/no confirmed bookings/);
    const unfinished = buildAdvertisingReport([onDay("c", "2026-11-10")], { ...options, advertisingStartedOn: "2026-11-11" });
    expect(unfinished.businessGrowth.text).toBe("Not calculated");
    expect(unfinished.businessGrowth.detail).toMatch(/no finished day/);
  });

  it("does not attribute a change in bookings a day to advertising", () => {
    const none = interpretAttribution({
      trackedGoogleAds: 0,
      customerReported: 1,
      unknown: 2,
      included: 3,
      telephoneWithoutSource: 1,
      whatsappWithoutSource: 0,
      earlierPerDay: 2,
      selectedPerDay: 3,
    });
    expect(none.join(" ")).toMatch(/No booking in this period can be attributed to Google Ads/);
    expect(none.join(" ")).toMatch(/Increase: 50%/);
    expect(none.join(" ")).toMatch(/were 2 in the earlier period and 3 in the selected period/);
    expect(none.join(" ")).toMatch(/not an attribution to Google Ads/);
    expect(none.join(" ")).toMatch(/does not claim that all additional bookings were caused by Google Ads/);
    expect(none.join(" ")).toMatch(/Seasonality, repeat customers, referrals and other marketing activities may affect these results/);
    const tracked = interpretAttribution({
      trackedGoogleAds: 1,
      customerReported: 1,
      unknown: 0,
      included: 2,
      telephoneWithoutSource: 0,
      whatsappWithoutSource: 0,
      earlierPerDay: null,
      selectedPerDay: null,
    });
    expect(tracked.join(" ")).toMatch(/kept separate/);
    expect(tracked.join(" ")).toMatch(/not confirmed in a GA4 report/);
  });

  it("sets today and the last 7 London days", () => {
    expect(advertisingDateRange("today", new Date("2026-11-12T00:30:00Z"))).toEqual({ from: "2026-11-12", to: "2026-11-12" });
    expect(advertisingDateRange("last_7", new Date("2026-11-12T00:30:00Z"))).toEqual({ from: "2026-11-05", to: "2026-11-11" });
    expect(advertisingDateRange("today", new Date("2026-06-01T23:30:00Z"))).toEqual({ from: "2026-06-02", to: "2026-06-02" });
    expect(advertisingDateRange("last_7", new Date("2026-03-01T12:00:00Z"))).toEqual({ from: "2026-02-22", to: "2026-02-28" });
  });

  it("does not change historical bookings to produce a comparison", () => {
    const records: AdvertisingBookingInput[] = [
      booking({ id: "old", bookingNumber: "OLD", createdAt: "2026-10-01T09:00:00Z", pickupTime: "2026-10-02T09:00:00Z", updatedAt: "2026-10-02T18:00:00Z", amountReceivedPence: 5000 }),
      booking({ id: "recent", bookingNumber: "RECENT", createdAt: "2026-11-08T09:00:00Z", pickupTime: "2026-11-10T09:00:00Z", marketingAttribution: { consent: "granted", gclid: "click", expiresAt: Date.parse("2026-12-01T00:00:00Z") } }),
      booking({ id: "missing", bookingNumber: "MISS", createdAt: undefined, pickupTime: "2026-11-11T09:00:00Z", dateTime: "2026-11-11T09:00:00Z" }),
    ];
    records.forEach((record) => {
      if (record.marketingAttribution) Object.freeze(record.marketingAttribution);
      Object.freeze(record);
    });
    const before = JSON.parse(JSON.stringify(records));
    const report = buildAdvertisingReport(records, {
      ...period,
      dateBasis: "enquiry",
      now: new Date("2026-11-15T12:00:00Z"),
      advertisingStartedOn: "2026-11-01",
    });
    expect(JSON.parse(JSON.stringify(records))).toEqual(before);
    expect(report.earlierPace.days).toBeGreaterThan(0);
    expect(report.businessGrowth.text).not.toBe("");
    expect(records[2].createdAt).toBeUndefined();
    expect(records[0].pickupTime).toBe("2026-10-02T09:00:00Z");
  });

  it("states the limitation when historical booking records are incomplete", () => {
    const incomplete = booking({
      id: "gap",
      bookingNumber: "GAP",
      createdAt: undefined,
      pickupTime: "2026-11-10T09:00:00Z",
      dateTime: "2026-11-10T09:00:00Z",
      actualFare: undefined,
      finalFarePence: undefined,
      issuedQuote: null,
      amountReceivedPence: undefined,
      jobCosts: { driverPaymentPence: 1000 },
    });
    const before = JSON.parse(JSON.stringify(incomplete));
    const journey = buildAdvertisingReport([incomplete], { ...period, now: new Date("2026-11-15T12:00:00Z") });
    expect(JSON.parse(JSON.stringify(incomplete))).toEqual(before);
    expect(journey.limitations).toEqual([
      "1 confirmed booking has no recorded payment. Revenue from that booking stays unknown, and the missing payment is not treated as zero.",
      "1 confirmed booking has no quoted fare. Average booking value stays unknown, and the missing fare is not treated as zero.",
      "1 confirmed booking has no recorded source. Attribution for that booking stays unknown.",
      "1 completed job has a journey cost that was not recorded. Profit stays unknown while that cost is missing.",
      "1 booking in this comparison has no creation time. An enquiry date comparison leaves it out. A journey date is not substituted for the booking creation date.",
    ]);
    const enquiry = buildAdvertisingReport([incomplete], { ...period, dateBasis: "enquiry", now: new Date("2026-11-15T12:00:00Z") });
    expect(enquiry.completed).toBe(0);
    expect(enquiry.limitations).toEqual([
      "1 booking has no creation time. It is left out of this enquiry date comparison. A journey date is not substituted for the booking creation date.",
    ]);
    const noJourney = booking({
      id: "nodate",
      bookingNumber: "NODATE",
      pickupTime: undefined,
      dateTime: undefined,
      createdAt: "2026-11-04T09:00:00Z",
    });
    const byJourney = buildAdvertisingReport([noJourney], period);
    expect(byJourney.completed).toBe(0);
    expect(byJourney.excluded.missingJourneyDate).toBe(1);
    expect(byJourney.limitations.join(" ")).toMatch(/no journey date/);
    expect(byJourney.limitations.join(" ")).toMatch(/creation time is not used/);
    const complete = buildAdvertisingReport([booking({
      id: "whole",
      bookingNumber: "WHOLE",
      staffReportedSource: "repeat",
      jobCosts: { driverPaymentPence: 1000, fuelPence: 100, parkingPence: 0, airportChargesPence: 0, paymentFeesPence: 0 },
    })], { ...period, now: new Date("2026-11-15T12:00:00Z") });
    expect(complete.limitations).toEqual([]);
    expect(journey.businessGrowth.limitations).toEqual([]);
    expect(complete.reportingBasis).toMatch(/Google Ads reporting is not available/);
    expect(complete.reportingBasis).toMatch(/No advertising spend is stored/);
  });

  it("does not use a journey date when the booking creation time is missing", () => {
    const storedLater = booking({
      id: "later",
      bookingNumber: "LATER",
      createdAt: "2026-11-20T09:00:00Z",
      pickupTime: "2026-10-02T09:00:00Z",
      dateTime: "2026-10-02T09:00:00Z",
    });
    const missingCreation = booking({
      id: "missing",
      bookingNumber: "MISSING",
      createdAt: undefined,
      pickupTime: "2026-11-10T09:00:00Z",
      dateTime: "2026-11-10T09:00:00Z",
    });
    const enquiry = buildAdvertisingReport([storedLater, missingCreation], { ...period, dateBasis: "enquiry" });
    expect(enquiry.completed).toBe(1);
    expect(enquiry.excluded.missingCreationDate).toBe(1);
    const enquiryOnly = buildAdvertisingReport([missingCreation], { ...period, dateBasis: "enquiry", now: new Date("2026-11-15T12:00:00Z") });
    expect(enquiryOnly.completed).toBe(0);
    expect(enquiryOnly.frequency.find((point) => point.date === "2026-11-10")?.bookings).toBe(0);
    expect(enquiryOnly.limitations.join(" ")).toMatch(/A journey date is not substituted for the booking creation date/);
    const journey = buildAdvertisingReport([storedLater, missingCreation], period);
    expect(journey.completed).toBe(1);
    expect(journey.excluded.missingCreationDate).toBe(0);
    expect(journey.confirmedForCost).toBe(1);
    const lateSave = buildAdvertisingReport([
      booking({ id: "late", bookingNumber: "LATE", pickupTime: "2026-11-10T09:00:00Z", createdAt: "2026-11-12T09:00:00Z" }),
    ], { ...period, now: new Date("2026-11-15T12:00:00Z") });
    expect(lateSave.limitations.join(" ")).toMatch(/1 booking was saved after the journey/);
    expect(lateSave.limitations.join(" ")).toMatch(/not treated as the customer enquiry time/);
    expect(lateSave.limitations.join(" ")).toMatch(/not used as the journey date/);
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
