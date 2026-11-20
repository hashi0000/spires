import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingResultsView } from "./AdvertisingResults";
import { ComparisonBars } from "./ComparisonBars";
import { BookingFrequencyChart } from "./BookingFrequencyChart";
import { advertisingDateRange, advertisingPreviewBookings, buildAdvertisingReport, thisMonthThroughYesterday } from "../utils/advertisingResults";
import { buildGoogleAdsPeriodReport } from "../utils/googleAdsPeriod";

jest.mock("firebase/functions", () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }));
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(() => () => undefined),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));
jest.mock("../utils/firebase", () => ({ db: {}, functions: {} }));

function openMoreDetail() {
  const details = screen.getByText("More detail").closest("details");
  if (details) details.open = true;
  return details as HTMLDetailsElement;
}

test("main view shows November fixture spend, bookings, fares and ratios", () => {
  const range = { from: "2026-11-01", to: "2026-11-18" };
  const bookings = [
    { id: "1", bookingNumber: "A", enquiryAt: "2026-11-02", createdAt: "2026-11-02", status: "confirmed", actualFare: 108, amountReceivedPence: 0, customerReportedSource: "google_advert", pickupLocation: "Oxford", destination: "Heathrow" },
    { id: "2", bookingNumber: "B", enquiryAt: "2026-11-03", createdAt: "2026-11-03", status: "allocated", actualFare: 195, amountReceivedPence: 5000, staffReportedSource: "google_ads", pickupLocation: "Oxford", destination: "Gatwick" },
    { id: "3", bookingNumber: "C", enquiryAt: "2026-11-04", createdAt: "2026-11-04", status: "completed", actualFare: 150, amountReceivedPence: 15000, customerReportedSource: "google_ads", pickupLocation: "Witney", destination: "Oxford" },
  ];
  const spend = [{ id: "s", date: "2026-11-01", dateEnd: "2026-11-18", amountPence: 7965, source: "manual" as const, label: "Manual", replacesImported: true }];
  const report = buildAdvertisingReport(bookings as any, {
    ...range,
    dateBasis: "enquiry",
    spend,
    manualSpendIsComplete: true,
    adsConnected: false,
    now: new Date("2026-11-19T15:00:00Z"),
  });
  const googleAdsReport = buildGoogleAdsPeriodReport(bookings as any, { ...range, spend });
  const onOpenBooking = jest.fn();
  render(
    <AdvertisingResultsView
      report={report}
      preview
      connectionNote="Google Ads is not connected."
      onDates={() => undefined}
      onManualComplete={() => undefined}
      onSaveStartDate={() => undefined}
      onSaveSpend={() => undefined}
      spendEntries={spend}
      googleAdsReport={googleAdsReport}
      routeBookings={bookings as any}
      onOpenBooking={onOpenBooking}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  expect(screen.getByRole("heading", { name: "Advertising results" })).toBeTruthy();
  expect(screen.getAllByText(/Reporting 2026-11-01 to 2026-11-18/).length).toBeGreaterThan(0);
  const summary = screen.getByLabelText("Period summary");
  expect(summary.textContent).toMatch(/£79\.65/);
  expect(summary.textContent).toMatch(/Confirmed ad bookings/);
  expect(summary.textContent).toMatch(/3/);
  expect(summary.textContent).toMatch(/£453\.00/);
  expect(summary.textContent).toMatch(/£26\.55/);
  expect(summary.textContent).toMatch(/£5\.69/);
  expect(screen.getByRole("heading", { name: "Route Performance" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Booking details" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: "Advertising spend" }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "2026-11-02" }));
  expect(onOpenBooking).toHaveBeenCalledWith("1");
  fireEvent.click(screen.getByRole("button", { name: "Add ad spend" }));
  expect(screen.getByRole("heading", { name: "Add ad spend" })).toBeTruthy();
  expect(screen.getAllByLabelText(/Replace imported spend for these dates/).length).toBeGreaterThan(0);
});

test("preview hides passenger details and keeps legacy metrics under More detail", () => {
  const range = thisMonthThroughYesterday(new Date("2026-11-19T12:00:00Z"));
  const report = buildAdvertisingReport(advertisingPreviewBookings, {
    ...range,
    dateBasis: "enquiry",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now: new Date("2026-11-19T15:00:00Z"),
  });
  const onDates = jest.fn();
  const googleAdsReport = buildGoogleAdsPeriodReport(advertisingPreviewBookings, { ...range, spend: [] });
  render(
    <AdvertisingResultsView
      report={report}
      preview
      connectionNote="Google Ads is not connected. No advertising credentials are available to the server."
      onDates={onDates}
      onManualComplete={() => undefined}
      onSaveStartDate={() => undefined}
      onSaveSpend={() => undefined}
      googleAdsReport={googleAdsReport}
      routeBookings={advertisingPreviewBookings as any}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  expect(screen.getByRole("heading", { name: "Advertising results" })).toBeTruthy();
  expect(screen.getAllByText(/No ad spend recorded/).length).toBeGreaterThan(0);
  expect(screen.getByText("More detail")).toBeTruthy();
  openMoreDetail();
  expect(screen.getByRole("heading", { name: "Google Ads" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Contribution after direct costs and advertising" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Selected period against the days before it" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Objective" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Google Ads start date" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Bookings directly attributed to Google Ads" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Overall business growth after advertising started" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Historical data integrity" })).toBeTruthy();
  expect(screen.getByText("Sample preview. These are not live bookings.")).toBeTruthy();
  expect(screen.queryByText("07000000000")).toBeNull();
  expect(screen.queryByText("Do not show this note")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
  const today = advertisingDateRange("today");
  const week = advertisingDateRange("last_7");
  expect(onDates).toHaveBeenNthCalledWith(1, today.from, today.to, "enquiry");
  expect(onDates).toHaveBeenNthCalledWith(2, week.from, week.to, "enquiry");
});

test("lets an administrator confirm the recorded date or change it", () => {
  const range = thisMonthThroughYesterday(new Date("2026-11-19T12:00:00Z"));
  const report = buildAdvertisingReport([], {
    ...range,
    dateBasis: "enquiry",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now: new Date("2026-11-19T15:00:00Z"),
  });
  const onSaveStartDate = jest.fn();
  render(
    <AdvertisingResultsView
      report={report}
      advertisingStartedOn="2026-11-01"
      connectionNote="Google Ads is not connected."
      onDates={() => undefined}
      onManualComplete={() => undefined}
      onSaveStartDate={onSaveStartDate}
      onSaveSpend={() => undefined}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  openMoreDetail();
  expect(screen.getByText(/An administrator has not confirmed this date/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm Google Ads start date" }));
  expect(onSaveStartDate).toHaveBeenCalledWith("2026-11-01");
  fireEvent.change(screen.getByLabelText("Google Ads start date"), { target: { value: "2026-11-03" } });
  expect(screen.getByRole("button", { name: "Confirm Google Ads start date" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Change Google Ads start date" }));
  expect(onSaveStartDate).toHaveBeenLastCalledWith("2026-11-03");
});

test("does not draw a bar when one side of a comparison is unknown", () => {
  const { container } = render(
    <ComparisonBars
      earlierName="Before"
      laterName="After"
      items={[{ label: "Gross booking revenue", earlier: null, later: 100, earlierText: "Unknown", laterText: "£1.00" }]}
    />
  );
  expect(screen.getByText("Unknown")).toBeTruthy();
  expect(screen.getByText("£1.00")).toBeTruthy();
  expect(container.querySelector(".comparison-bars__fill")).toBeNull();
});

test("draws the Google Ads start date marker on that finished day", () => {
  const { container } = render(
    <BookingFrequencyChart
      points={[
        { date: "2026-11-08", bookings: 1, confirmed: 1, rollingAverage: 1 / 7, grossBookingRevenuePence: 0, grossRollingAveragePence: 0, spendPence: null },
        { date: "2026-11-09", bookings: 0, confirmed: 0, rollingAverage: 1 / 7, grossBookingRevenuePence: 0, grossRollingAveragePence: 0, spendPence: null },
      ]}
      dateLabel="journey date"
      startDate="2026-11-09"
    />
  );
  expect(screen.getByText(/The marker shows the confirmed Google Ads start date, 2026-11-09/)).toBeTruthy();
  expect(container.querySelector(".frequency-chart__marker")).toBeTruthy();
});

test("shows Google Ads spend only after it is chosen", () => {
  const { container } = render(
    <BookingFrequencyChart
      points={[
        { date: "2026-11-08", bookings: 0, confirmed: 0, rollingAverage: 0, grossBookingRevenuePence: 0, grossRollingAveragePence: 0, spendPence: null },
        { date: "2026-11-09", bookings: 1, confirmed: 1, rollingAverage: 1 / 7, grossBookingRevenuePence: 4000, grossRollingAveragePence: 4000 / 7, spendPence: 250 },
      ]}
      dateLabel="journey date"
    />
  );
  expect(container.querySelector(".frequency-chart__spend")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show Google Ads spend" }));
  expect(container.querySelector(".frequency-chart__spend")).toBeTruthy();
});

test("does not draw Google Ads spend when no daily figure was returned", () => {
  const { container } = render(
    <BookingFrequencyChart
      points={[{ date: "2026-11-09", bookings: 1, confirmed: 1, rollingAverage: 1 / 7, grossBookingRevenuePence: 0, grossRollingAveragePence: 0, spendPence: null }]}
      dateLabel="journey date"
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Show Google Ads spend" }));
  expect(screen.getByText(/Google Ads spend by day was not returned/)).toBeTruthy();
  expect(container.querySelector(".frequency-chart__spend")).toBeNull();
});

test("switches the chart from booking count to gross booking revenue", () => {
  const { container } = render(
    <BookingFrequencyChart
      points={[
        { date: "2026-11-08", bookings: 2, confirmed: 1, rollingAverage: 1, grossBookingRevenuePence: 4000, grossRollingAveragePence: 4000 / 7, spendPence: null },
        { date: "2026-11-09", bookings: 1, confirmed: 1, rollingAverage: 1, grossBookingRevenuePence: null, grossRollingAveragePence: null, spendPence: null },
      ]}
      dateLabel="journey date"
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Gross booking revenue" }));
  expect(screen.getByText(/quoted fare of confirmed, allocated and completed bookings/)).toBeTruthy();
  const gross = container.querySelector(".frequency-chart__gross");
  expect(gross).toBeTruthy();
  expect(gross?.getAttribute("points")?.trim().split(" ").length).toBe(1);
});

test("shows Refresh Spend, sync timestamp and imported campaign rows", () => {
  const range = thisMonthThroughYesterday(new Date("2026-11-19T15:00:00Z"));
  const report = buildAdvertisingReport(advertisingPreviewBookings, {
    from: range.from,
    to: range.to,
    dateBasis: "enquiry",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: true,
    adsSpendPence: 1500,
    now: new Date("2026-11-19T15:00:00Z"),
  });
  const googleAdsReport = buildGoogleAdsPeriodReport(advertisingPreviewBookings, {
    ...range,
    spend: [],
    adsSpendPence: 1500,
  });
  const onRefreshAds = jest.fn();
  render(
    <AdvertisingResultsView
      report={report}
      preview={false}
      connectionNote="Google Ads account report in GBP."
      onDates={() => undefined}
      onManualComplete={() => undefined}
      onSaveStartDate={() => undefined}
      onSaveSpend={() => undefined}
      googleAdsReport={googleAdsReport}
      onRefreshAds={onRefreshAds}
      adsSync={{
        status: "ready",
        lastSuccessAtMs: Date.parse("2026-11-19T12:00:00Z"),
        attemptedAtMs: Date.parse("2026-11-19T12:00:00Z"),
        reason: null,
        from: "2026-08-22",
        to: "2026-11-18",
        campaigns: 2,
      }}
      importedCampaignSpend={[
        { campaignId: "111", campaignName: "Heathrow Standard", spendPence: 900 },
        { campaignId: "222", campaignName: "Heathrow 8 Seater", spendPence: 600 },
      ]}
    />
  );
  openMoreDetail();
  expect(screen.getByRole("heading", { name: "Imported Google Ads spend by campaign" })).toBeTruthy();
  expect(screen.getByText("Heathrow Standard")).toBeTruthy();
  expect(screen.getByText("Heathrow 8 Seater")).toBeTruthy();
  expect(screen.getByText(/Last successful synchronisation/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh Spend" }));
  expect(onRefreshAds).toHaveBeenCalled();
});
