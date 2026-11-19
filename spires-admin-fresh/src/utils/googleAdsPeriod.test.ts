import {
  buildGoogleAdsPeriodReport,
  findSpendOverlaps,
  periodManualSpend,
} from "./googleAdsPeriod";

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
        spend: [{ id: "s", date: "2026-11-01", dateEnd: "2026-11-30", amountPence: 15000, source: "manual", label: "Manual", campaign: "Search" }],
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
    expect(report.dateBasisLabel).toMatch(/date they were booked/i);
  });

  test("shows £100 spend, 3 confirmed jobs and £450 fares on the summary figures", () => {
    const report = buildGoogleAdsPeriodReport(
      [
        { id: "1", bookingNumber: "A", enquiryAt: "2026-11-02", createdAt: "2026-11-02", status: "confirmed", actualFare: 150, amountReceivedPence: 0, customerReportedSource: "google_advert", pickupLocation: "Oxford", destination: "Heathrow" },
        { id: "2", bookingNumber: "B", enquiryAt: "2026-11-03", createdAt: "2026-11-03", status: "allocated", actualFare: 150, amountReceivedPence: 5000, customerReportedSource: "google_advert", pickupLocation: "Oxford", destination: "Gatwick" },
        { id: "3", bookingNumber: "C", enquiryAt: "2026-11-04", createdAt: "2026-11-04", status: "completed", actualFare: 150, amountReceivedPence: 15000, staffReportedSource: "google_ads", pickupLocation: "Witney", destination: "Oxford" },
      ],
      {
        from: "2026-11-01",
        to: "2026-11-30",
        spend: [{ id: "s", date: "2026-11-01", dateEnd: "2026-11-30", amountPence: 10000, source: "manual", label: "Manual" }],
      }
    );
    expect(report.displaySpendPence).toBe(10000);
    expect(report.confirmedCount).toBe(3);
    expect(report.confirmedFarePence).toBe(45000);
  });

  test("shows no ad spend recorded when nothing is entered", () => {
    const report = buildGoogleAdsPeriodReport([], { from: "2026-11-01", to: "2026-11-30", spend: [] });
    expect(report.displaySpendPence).toBeNull();
    expect(report.hasManualSpend).toBe(false);
  });
});
