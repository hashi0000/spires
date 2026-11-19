import {
  buildGoogleAdsPeriodReport,
  filterGoogleAdsJobs,
  findSpendOverlaps,
  isGoogleAdsAttributed,
  periodManualSpend,
  resolvePeriodSpend,
} from "./googleAdsPeriod";
import { thisMonthThroughYesterday } from "./advertisingResults";

const NOV = { from: "2026-11-01", to: "2026-11-18" } as const;

const spend7965 = [{
  id: "spend-nov",
  date: "2026-11-01",
  dateEnd: "2026-11-18",
  amountPence: 7965,
  source: "manual" as const,
  label: "Manual",
  replacesImported: true,
}];

const threeAdBookings = [
  {
    id: "b1",
    bookingNumber: "SP108",
    enquiryAt: "2026-11-03",
    createdAt: "2026-11-03",
    status: "confirmed",
    actualFare: 108,
    amountReceivedPence: 0,
    customerReportedSource: "google_advert",
    pickupLocation: "Oxford",
    destination: "Heathrow",
  },
  {
    id: "b2",
    bookingNumber: "SP195",
    enquiryAt: "2026-11-08",
    createdAt: "2026-11-08",
    status: "allocated",
    actualFare: 195,
    amountReceivedPence: 5000,
    staffReportedSource: "google_ads",
    pickupLocation: "Witney",
    destination: "Gatwick",
  },
  {
    id: "b3",
    bookingNumber: "SP150",
    enquiryAt: "2026-11-12",
    createdAt: "2026-11-12",
    status: "completed",
    actualFare: 150,
    amountReceivedPence: 15000,
    customerReportedSource: "google_ads",
    pickupLocation: "Oxford",
    destination: "Luton",
  },
];

describe("spend overlaps and period inclusion", () => {
  test("flags overlapping weekly and monthly totals for the same campaign", () => {
    const overlaps = findSpendOverlaps([
      { id: "w", date: "2026-11-01", dateEnd: "2026-11-07", amountPence: 5000, source: "manual", label: "Manual", campaign: "Search" },
      { id: "m", date: "2026-11-01", dateEnd: "2026-11-30", amountPence: 20000, source: "manual", label: "Manual", campaign: "Search" },
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].detail).toMatch(/weekly and a monthly/i);
  });

  test("excludes partial period overlaps from the spend total", () => {
    const summary = periodManualSpend(
      [
        { id: "full", date: "2026-11-16", amountPence: 1000, source: "manual", label: "Manual" },
        { id: "partial", date: "2026-11-01", dateEnd: "2026-11-30", amountPence: 9000, source: "manual", label: "Manual", campaign: "Brand" },
      ],
      "2026-11-15",
      "2026-11-20"
    );
    expect(summary.includedPence).toBe(1000);
    expect(summary.partial).toHaveLength(1);
    expect(summary.partial[0].id).toBe("partial");
  });

  test("keeps missing spend distinct from genuine zero", () => {
    const missing = resolvePeriodSpend({ from: NOV.from, to: NOV.to, spend: [] });
    expect(missing.displaySpendPence).toBeNull();
    expect(missing.spendSource).toBe("unavailable");

    const zero = resolvePeriodSpend({
      from: NOV.from,
      to: NOV.to,
      spend: [{ id: "z", date: "2026-11-01", dateEnd: "2026-11-18", amountPence: 0, source: "manual", label: "Manual", replacesImported: true }],
    });
    expect(zero.displaySpendPence).toBe(0);
    expect(zero.spendSource).toBe("manual");
    expect(zero.spendSourceLabel).toMatch(/£0\.00/);
  });

  test("uses imported spend unless a period manual replacement is set", () => {
    const imported = resolvePeriodSpend({
      from: NOV.from,
      to: NOV.to,
      spend: [{ id: "m", date: "2026-11-01", dateEnd: "2026-11-18", amountPence: 5000, source: "manual", label: "Manual" }],
      adsSpendPence: 7965,
    });
    expect(imported.displaySpendPence).toBe(7965);
    expect(imported.spendSource).toBe("imported");
    expect(imported.spendImportedConflict).toMatch(/manual/i);

    const replaced = resolvePeriodSpend({
      from: NOV.from,
      to: NOV.to,
      spend: [{ id: "m", date: "2026-11-01", dateEnd: "2026-11-18", amountPence: 5000, source: "manual", label: "Manual", replacesImported: true }],
      adsSpendPence: 7965,
    });
    expect(replaced.displaySpendPence).toBe(5000);
    expect(replaced.spendSource).toBe("manual");
  });
});

describe("November 2026 fixture maths", () => {
  test("shows £79.65 spend, 3 ad bookings, £453 fares, £26.55 per booking and £5.69 per £1", () => {
    const report = buildGoogleAdsPeriodReport(threeAdBookings as any, {
      ...NOV,
      spend: spend7965,
    });
    expect(report.displaySpendPence).toBe(7965);
    expect(report.confirmedCount).toBe(3);
    expect(report.confirmedFarePence).toBe(45300);
    expect(report.costPerConfirmedPence).toBe(2655);
    expect(report.bookedFarePerPoundPence).toBe(569);
    expect(report.paymentsReceivedPence).toBe(20000);
    expect(report.reportingDatesLabel).toMatch(/2026-11-01 to 2026-11-18/);
  });

  test("does not inflate totals for organic, cancelled, return or double attribution", () => {
    const report = buildGoogleAdsPeriodReport([
      ...threeAdBookings,
      {
        id: "organic",
        bookingNumber: "ORG1",
        enquiryAt: "2026-11-05",
        createdAt: "2026-11-05",
        status: "confirmed",
        actualFare: 90,
        amountReceivedPence: 9000,
        customerReportedSource: "website",
        pickupLocation: "Oxford",
        destination: "Banbury",
      },
      {
        id: "cancelled",
        bookingNumber: "CX1",
        enquiryAt: "2026-11-06",
        createdAt: "2026-11-06",
        status: "cancelled",
        actualFare: 200,
        amountReceivedPence: 0,
        staffReportedSource: "google_ads",
        pickupLocation: "Oxford",
        destination: "Heathrow",
      },
      {
        id: "return",
        bookingNumber: "SP108-R",
        returnOfBookingNumber: "SP108",
        enquiryAt: "2026-11-03",
        createdAt: "2026-11-03",
        status: "confirmed",
        actualFare: 108,
        amountReceivedPence: 0,
        customerReportedSource: "google_advert",
        pickupLocation: "Heathrow",
        destination: "Oxford",
      },
      {
        id: "b1-dup-tag",
        bookingNumber: "SP108",
        enquiryAt: "2026-11-03",
        createdAt: "2026-11-03",
        status: "confirmed",
        actualFare: 108,
        amountReceivedPence: 0,
        customerReportedSource: "google_advert",
        staffReportedSource: "google_ads",
        marketingAttribution: {
          consent: "granted",
          gclid: "click-1",
          expiresAt: Date.parse("2099-01-01"),
        },
        pickupLocation: "Oxford",
        destination: "Heathrow",
      },
      {
        id: "synthetic-measurement-1",
        bookingNumber: "SYN1",
        enquiryAt: "2026-11-04",
        createdAt: "2026-11-04",
        status: "confirmed",
        actualFare: 999,
        syntheticMeasurementTest: true,
        customerReportedSource: "google_ads",
        pickupLocation: "Synthetic test pickup",
        destination: "Nowhere",
      },
    ] as any, { ...NOV, spend: spend7965 });

    expect(report.confirmedCount).toBe(3);
    expect(report.confirmedFarePence).toBe(45300);
    expect(report.costPerConfirmedPence).toBe(2655);
    expect(report.bookedFarePerPoundPence).toBe(569);
    expect(report.cancelledCount).toBe(1);
    expect(report.jobs.some((job) => job.bookingNumber === "CX1" && job.cancelled)).toBe(true);
    expect(report.jobs.filter((job) => job.bookingNumber === "SP108")).toHaveLength(1);
  });

  test("normalises google_ads and google_advert for attribution without requiring both", () => {
    expect(isGoogleAdsAttributed({ customerReportedSource: "google_advert" } as any)).toBe(true);
    expect(isGoogleAdsAttributed({ staffReportedSource: "google_ads" } as any)).toBe(true);
    expect(isGoogleAdsAttributed({ customerReportedSource: "repeat" } as any)).toBe(false);
  });
});

describe("list filters and date defaults", () => {
  test("filters the job list without changing headline totals", () => {
    const report = buildGoogleAdsPeriodReport(threeAdBookings as any, { ...NOV, spend: spend7965 });
    const filtered = filterGoogleAdsJobs(report.jobs, { route: "Oxford → Heathrow" });
    expect(filtered).toHaveLength(1);
    expect(report.confirmedCount).toBe(3);
    expect(report.displaySpendPence).toBe(7965);
  });

  test("defaults this month through yesterday in Europe/London", () => {
    const range = thisMonthThroughYesterday(new Date("2026-11-19T12:00:00Z"));
    expect(range).toEqual({ from: "2026-11-01", to: "2026-11-18" });
    const onFirst = thisMonthThroughYesterday(new Date("2026-11-01T12:00:00Z"));
    expect(onFirst.from).toBe("2026-10-01");
    expect(onFirst.to).toBe("2026-10-31");
  });
});

describe("Google Ads period jobs", () => {
  test("defaults to booked date, counts a return once, and lists cancellations separately", () => {
    const report = buildGoogleAdsPeriodReport(
      [
        {
          id: "a",
          bookingNumber: "SP1",
          enquiryAt: "2026-11-05T10:00:00Z",
          createdAt: "2026-11-05T10:00:00Z",
          pickupTime: "2026-12-01T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Heathrow",
          status: "confirmed",
          actualFare: 120,
          amountReceivedPence: 4000,
          customerReportedSource: "google_advert",
        },
        {
          id: "b",
          bookingNumber: "SP1-R",
          returnOfBookingNumber: "SP1",
          enquiryAt: "2026-11-05T10:05:00Z",
          createdAt: "2026-11-05T10:05:00Z",
          pickupTime: "2026-12-08T10:00:00Z",
          pickupLocation: "Heathrow",
          destination: "Oxford",
          status: "confirmed",
          actualFare: 120,
          amountReceivedPence: 0,
          customerReportedSource: "google_advert",
        },
        {
          id: "c",
          bookingNumber: "SP2",
          enquiryAt: "2026-11-08T10:00:00Z",
          createdAt: "2026-11-08T10:00:00Z",
          pickupTime: "2026-11-20T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Gatwick",
          status: "cancelled",
          actualFare: 90,
          amountReceivedPence: 0,
          staffReportedSource: "google_ads",
        },
        {
          id: "d",
          bookingNumber: "SP3",
          enquiryAt: "2026-11-09T10:00:00Z",
          createdAt: "2026-11-09T10:00:00Z",
          pickupTime: "2026-11-22T10:00:00Z",
          pickupLocation: "Witney",
          destination: "Oxford",
          status: "completed",
          actualFare: 35,
          amountReceivedPence: 3500,
          customerReportedSource: "recommendation",
        },
      ],
      {
        from: "2026-11-01",
        to: "2026-11-30",
        spend: [{ id: "s", date: "2026-11-01", dateEnd: "2026-11-30", amountPence: 15000, source: "manual", label: "Manual", campaign: "Search", replacesImported: true }],
      }
    );
    expect(report.confirmedCount).toBe(1);
    expect(report.completedCount).toBe(0);
    expect(report.cancelledCount).toBe(1);
    expect(report.jobs.filter((job) => !job.cancelled)).toHaveLength(1);
    expect(report.jobs.some((job) => job.cancelled && job.bookingNumber === "SP2")).toBe(true);
    expect(report.jobs.find((job) => job.bookingNumber === "SP1")?.farePence).toBe(12000);
    expect(report.paymentsReceivedPence).toBe(4000);
    expect(report.displaySpendPence).toBe(15000);
    expect(report.hasManualSpend).toBe(true);
    expect(report.dateBasisLabel).toMatch(/enquiry date/i);
  });
});
