import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import type { Booking } from "../types/types";

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => null })) as unknown as typeof fetch;
});

function booking(overrides: Partial<Booking>): Booking {
  return {
    bookingNumber: "SP1",
    dateTime: "2026-11-10T09:00:00Z",
    hirerName: "Customer",
    hirerAddress: "Oxford",
    hirerPhone: "07000000000",
    bookingMethod: "telephone",
    pickupTime: "2026-11-10T09:00:00Z",
    pickupLocation: "Oxford",
    destination: "Heathrow",
    status: "completed",
    actualFare: 40,
    amountReceivedPence: 4000,
    ...overrides,
  };
}

test("keeps the existing dashboard and adds marketing performance for an admin", () => {
  const onOpenAdvertising = jest.fn();
  render(
    <Dashboard
      activeDriversCount={2}
      availableVehiclesCount={3}
      totalBookings={1}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={0}
      bookings={[booking({ bookingNumber: "SP9" })]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
      showMarketingPerformance
      onOpenAdvertising={onOpenAdvertising}
    />
  );

  expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Upcoming jobs" })).toBeTruthy();
  expect(screen.getByText("Each journey in the next 7 days. A return is listed on its own pickup time.")).toBeTruthy();
  expect(screen.getByText("No upcoming jobs in the next week.")).toBeTruthy();
  expect(screen.getByText("Active Drivers")).toBeTruthy();
  expect(screen.getByText("Active Drivers").parentElement?.textContent).toContain("2/3");
  expect(screen.getByText("Available Vehicles").parentElement?.textContent).toContain("3");
  expect(screen.getByText("Total Bookings").parentElement?.textContent).toContain("1");
  expect(screen.getByText("Today's Bookings").parentElement?.textContent).toContain("0");
  expect(screen.getByRole("heading", { name: "Oxford City Council Compliance" })).toBeTruthy();
  expect(screen.getByText("Operator License Status")).toBeTruthy();
  expect(screen.getByText("✓ Active")).toBeTruthy();
  expect(screen.getByText("✓ 12 Month Retention")).toBeTruthy();
  expect(screen.getByText("Desktop reminders")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Marketing performance" })).toBeTruthy();
  expect(screen.getByText("Booking frequency")).toBeTruthy();
  expect(screen.getAllByText("Seasonality, repeat customers, referrals and other marketing activities may affect these results.").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Before and after advertising" })).toBeTruthy();
  expect(screen.getByText(/Overall business growth after advertising started is separate/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Objective" })).toBeTruthy();
  expect(screen.getByText(/See whether introducing Google Ads increased the number of bookings/)).toBeTruthy();
  expect(screen.getByText(/Google Ads start date: not recorded/)).toBeTruthy();
  expect(screen.getByText(/Not calculated/)).toBeTruthy();
  expect(screen.queryByText("Visual comparison")).toBeNull();
  expect(screen.getAllByText(/Google Ads reporting is not available/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/existing Firebase booking records/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/not modified merely to produce a comparison/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Incomplete historical records" })).toBeTruthy();
  expect(screen.getByText(/Where a historical booking record is incomplete, the limitation is shown here/)).toBeTruthy();
  expect(screen.getByText(/no recorded source/)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Incomplete records in the before and after comparison" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open Advertising results" }));
  expect(onOpenAdvertising).toHaveBeenCalledTimes(1);
});

test("leaves marketing performance hidden when the account is not an admin", () => {
  render(
    <Dashboard
      activeDriversCount={1}
      availableVehiclesCount={1}
      totalBookings={0}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={0}
      bookings={[]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
    />
  );
  expect(screen.getByRole("heading", { name: "Upcoming jobs" })).toBeTruthy();
  expect(screen.getByText("Active Drivers")).toBeTruthy();
  expect(screen.getByText("Active Drivers").parentElement?.textContent).toContain("1/3");
  expect(screen.getByText("Available Vehicles").parentElement?.textContent).toContain("1");
  expect(screen.getByText("Total Bookings").parentElement?.textContent).toContain("0");
  expect(screen.getByText("Today's Bookings").parentElement?.textContent).toContain("0");
  expect(screen.getByRole("heading", { name: "Oxford City Council Compliance" })).toBeTruthy();
  expect(screen.getByText("Record Keeping")).toBeTruthy();
  expect(screen.getByText("Desktop reminders")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Marketing performance" })).toBeNull();
  expect(screen.queryByText("Booking frequency")).toBeNull();
  expect(screen.queryByText("Seasonality, repeat customers, referrals and other marketing activities may affect these results.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Before and after advertising" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Incomplete historical records" })).toBeNull();
});

test("keeps the pending review alert and the fuel price note", async () => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({ available: true, petrolPence: 134.5, dieselPence: 141.2, weekCommencing: "02/11/2026" }),
  })) as unknown as typeof fetch;
  render(
    <Dashboard
      activeDriversCount={1}
      availableVehiclesCount={1}
      totalBookings={4}
      todaysBookingsCount={1}
      pendingCustomerBookingsCount={2}
      bookings={[]}
      desktopRemindersEnabled={true}
      onDesktopRemindersChange={() => undefined}
    />
  );
  expect(screen.getByRole("heading", { name: "2 New Customer Bookings Pending Review" })).toBeTruthy();
  expect(screen.getByText(/Go to the Bookings page to review and confirm customer bookings with pricing/)).toBeTruthy();
  expect(await screen.findByRole("heading", { name: "UK average fuel prices" })).toBeTruthy();
  expect(screen.getByText(/Petrol 134.5p\/L/)).toBeTruthy();
  expect(screen.getByText(/informational only, not linked to fares/)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Marketing performance" })).toBeNull();
});

test("shows before and after performance once an administrator confirms the start date", () => {
  render(
    <Dashboard
      activeDriversCount={1}
      availableVehiclesCount={1}
      totalBookings={2}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={0}
      bookings={[
        booking({ bookingNumber: "BEFORE", pickupTime: "2024-05-15T09:00:00Z", dateTime: "2024-05-15T09:00:00Z", amountReceivedPence: 1000 }),
        booking({ bookingNumber: "AFTER", pickupTime: "2024-06-15T09:00:00Z", dateTime: "2024-06-15T09:00:00Z", amountReceivedPence: 2000 }),
      ]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
      showMarketingPerformance
      advertisingStartedOn="2024-06-01"
      advertisingStartConfirmed
    />
  );
  expect(screen.getByRole("heading", { name: "Before" })).toBeTruthy();
  expect(screen.getByText(/Before ads:/)).toBeTruthy();
  expect(screen.getByText(/After ads:/)).toBeTruthy();
  expect(screen.getAllByText("Increase: 0%").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "After" })).toBeTruthy();
  expect(screen.getAllByText(/Total bookings: 1/).length).toBe(2);
  expect(screen.getAllByText(/Confirmed bookings: 1/).length).toBe(2);
  expect(screen.getAllByText(/Completed bookings: 1/).length).toBe(2);
  expect(screen.getAllByText(/Bookings per day:/).length).toBe(2);
  expect(screen.getAllByText(/Bookings per week:/).length).toBe(2);
  expect(screen.getAllByText(/Gross booking revenue: £40\.00/).length).toBe(2);
  expect(screen.getAllByText(/Average booking value: £40\.00/).length).toBe(2);
  expect(screen.getAllByText(/Enquiry volume: no enquiry records/).length).toBe(2);
  expect(screen.getAllByText(/Enquiry to booking conversion rate: not measurable/).length).toBe(2);
  expect(screen.getByText(/Returning customers: 0/)).toBeTruthy();
  expect(screen.getByText(/New customers: 1/)).toBeTruthy();
  expect(screen.getByText(/Returning customers: 1/)).toBeTruthy();
  expect(screen.getByText(/New customers: 0/)).toBeTruthy();
  expect(screen.getByText("Visual comparison")).toBeTruthy();
  expect(screen.getByText(/not drawn as zero/)).toBeTruthy();
  expect(screen.getByText(/The confirmed Google Ads start date is 2024-06-01/)).toBeTruthy();
  expect(screen.getByText(/not a finished day on this chart/)).toBeTruthy();
  expect(screen.getAllByText(/does not claim that all additional bookings were caused by Google Ads/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/existing Firebase booking records/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/not modified merely to produce a comparison/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Incomplete records in the before and after comparison" })).toBeTruthy();
  expect(screen.getByText(/no recorded source/)).toBeTruthy();
  expect(screen.getAllByText(/no creation time/).length).toBeGreaterThan(0);
});

test("lists a future return once when the outbound is already completed", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  const row = booking({
    id: "sp355017",
    bookingNumber: "SP355017",
    status: "completed",
    bookingType: "return",
    pickupTime: "2026-10-30T17:25:00Z",
    dateTime: "2026-10-30T17:25:00Z",
    pickupLocation: "10 Beech Crescent OX5 1DN",
    destination: "London Heathrow Terminal 2",
    returnPickupTime: "2026-11-15T19:05:00Z",
    returnPickupLocation: "London Heathrow Terminal 2",
    returnDestination: "10 Beech Crescent OX5 1DN",
    actualFare: 180,
    paymentStatus: "paid",
    amountReceivedPence: 18000,
  });
  render(
    <Dashboard
      activeDriversCount={1}
      availableVehiclesCount={1}
      totalBookings={1}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={0}
      bookings={[row]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
    />
  );
  try {
    expect(screen.getAllByText(/SP355017/)).toHaveLength(1);
    expect(screen.getByText(/· Return/)).toBeTruthy();
    expect(screen.getByText("London Heathrow Terminal 2 → 10 Beech Crescent OX5 1DN")).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Driver not confirmed")).toBeTruthy();
    expect(screen.queryByText("10 Beech Crescent OX5 1DN → London Heathrow Terminal 2")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Returns to review" })).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
