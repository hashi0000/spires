import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingResultsView } from "./AdvertisingResults";
import { ComparisonBars } from "./ComparisonBars";
import { BookingFrequencyChart } from "./BookingFrequencyChart";
import { advertisingDateRange, advertisingPreviewBookings, buildAdvertisingReport, currentLondonMonth } from "../utils/advertisingResults";

jest.mock("firebase/functions", () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }));
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(() => () => undefined),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock("../utils/firebase", () => ({ db: {}, functions: {} }));

test("preview hides passenger details and labels missing costs as unknown", () => {
  const range = currentLondonMonth(new Date("2026-11-10T12:00:00Z"));
  const report = buildAdvertisingReport(advertisingPreviewBookings, {
    ...range,
    dateBasis: "journey",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now: new Date("2026-11-12T15:00:00Z"),
  });
  const onDates = jest.fn();
  render(
    <AdvertisingResultsView
      report={report}
      preview
      connectionNote="Google Ads is not connected. No advertising credentials are available to the server."
      onDates={onDates}
      onManualComplete={() => undefined}
      onSaveStartDate={() => undefined}
      onAddSpend={() => undefined}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  expect(screen.getByRole("heading", { name: "Advertising results" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Contribution after direct costs and advertising" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Cost per confirmed booking" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Advertising return on spend" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Selected period against the days before it" })).toBeTruthy();
  expect(screen.getAllByText(/Revenue per day/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Average booking value/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Confirmed booking rate/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Change: not calculated/).length).toBeGreaterThan(0);
  expect(screen.getByText(/This compares daily bookings on finished days/)).toBeTruthy();
  expect(screen.getByText(/This compares recorded payments on finished days/)).toBeTruthy();
  expect(screen.getByText(/This compares the average quoted fare/)).toBeTruthy();
  expect(screen.getByText(/This compares the confirmed booking rate on finished days/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Objective" })).toBeTruthy();
  expect(screen.getByText(/See whether introducing Google Ads increased the number of bookings/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Google Ads start date" })).toBeTruthy();
  expect(screen.getByText(/first date of impressions or spend cannot be identified/)).toBeTruthy();
  expect(screen.getAllByText(/campaign creation date is not used/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Spires Taxis — before and after Google Ads performance comparison" })).toBeTruthy();
  expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Bookings directly attributed to Google Ads" })).toBeTruthy();
  expect(screen.getByText(/directly attributed to Google Ads only when it has a consented Google click id/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Overall business growth after advertising started" })).toBeTruthy();
  expect(screen.getByText(/It is not one of those attribution counts/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Bookings from other sources" })).toBeTruthy();
  expect(screen.getByText(/That report is not a stored Google click/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Bookings with unknown attribution" })).toBeTruthy();
  expect(screen.getByText(/A booking has unknown attribution when no source was recorded/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Attribution and interpretation" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Historical data integrity" })).toBeTruthy();
  expect(screen.getByText(/existing Firebase booking records/)).toBeTruthy();
  expect(screen.getAllByText(/A journey date is not substituted for a booking creation date/).length).toBeGreaterThan(0);
  expect(screen.getByText(/reliable as the time the booking record was saved/)).toBeTruthy();
  expect(screen.getAllByText(/Historical bookings are not modified merely to produce a comparison/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Incomplete historical records" })).toBeTruthy();
  expect(screen.getByText(/Where a historical booking record is incomplete, the limitation is shown here/)).toBeTruthy();
  expect(screen.getAllByText(/Google Ads reporting is not available/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/does not claim that all additional bookings were caused by Google Ads/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Seasonality, repeat customers, referrals and other marketing activities may affect these results/).length).toBeGreaterThan(0);
  expect(screen.getByText("Visual comparison")).toBeTruthy();
  expect(screen.getByText("Confirmed bookings a day")).toBeTruthy();
  expect(screen.getByText("Booking frequency")).toBeTruthy();
  expect(screen.getAllByText("Daily bookings").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Seven day rolling average").length).toBeGreaterThan(0);
  expect(screen.getByText(/no start date marker is drawn/)).toBeTruthy();
  expect(screen.getByText("Tracked Google Ads")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm Google Ads start date" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Change Google Ads start date" })).toBeDisabled();
  expect(screen.getByText("Sample preview. These are not live bookings.")).toBeTruthy();
  expect(screen.getByText(/£135/)).toBeTruthy();
  expect(screen.queryByText("07000000000")).toBeNull();
  expect(screen.queryByText("Do not show this note")).toBeNull();
  expect(screen.getByText("8 seater")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Last 7 finished days" }));
  const today = advertisingDateRange("today");
  const week = advertisingDateRange("last_7");
  expect(onDates).toHaveBeenNthCalledWith(1, today.from, today.to, "journey");
  expect(onDates).toHaveBeenNthCalledWith(2, week.from, week.to, "journey");
});

test("lets an administrator confirm the recorded date or change it", () => {
  const range = currentLondonMonth(new Date("2026-11-10T12:00:00Z"));
  const report = buildAdvertisingReport([], {
    ...range,
    dateBasis: "journey",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now: new Date("2026-11-12T15:00:00Z"),
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
      onAddSpend={() => undefined}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  expect(screen.getByText(/An administrator has not confirmed this date/)).toBeTruthy();
  expect(screen.queryByText(/The marker shows the confirmed Google Ads start date/)).toBeNull();
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
  expect(screen.getByText("Google Ads start date")).toBeTruthy();
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
  expect(screen.getByText(/Google Ads spend is optional and is not shown/)).toBeTruthy();
  expect(container.querySelector(".frequency-chart__spend")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show Google Ads spend" }));
  expect(container.querySelector(".frequency-chart__spend")).toBeTruthy();
  expect(screen.getByText(/dated Google Ads spend on finished days/)).toBeTruthy();
  expect(screen.getAllByText("Google Ads spend").length).toBeGreaterThan(0);
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
  expect(screen.getByText("Bookings")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Gross booking revenue" }));
  expect(screen.getByText(/quoted fare of confirmed, allocated and completed bookings/)).toBeTruthy();
  expect(screen.getByText(/not money received/)).toBeTruthy();
  expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  const gross = container.querySelector(".frequency-chart__gross");
  expect(gross).toBeTruthy();
  expect(gross?.getAttribute("points")?.trim().split(" ").length).toBe(1);
});
