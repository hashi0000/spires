import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { Booking } from "../types/types";

jest.mock("firebase/functions", () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: () => () => undefined,
  query: jest.fn(),
  where: jest.fn(),
}));
jest.mock("../utils/firebase", () => ({ db: {}, functions: {} }));

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

test("shows Today sections and marketing inside reports snapshot for an admin", () => {
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

  expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "New enquiries" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Today's jobs" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Tomorrow's jobs" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Unassigned" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Exceptions" })).toBeTruthy();
  expect(screen.getByText("Desktop reminders")).toBeTruthy();
  expect(screen.getByText("Reports snapshot")).toBeTruthy();
  fireEvent.click(screen.getByText("Reports snapshot"));
  expect(screen.getByRole("heading", { name: "Marketing performance" })).toBeTruthy();
  expect(screen.getByText("Booking frequency")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Before and after advertising" })).toBeTruthy();
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
  expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Today's jobs" })).toBeTruthy();
  expect(screen.getByText("Desktop reminders")).toBeTruthy();
  fireEvent.click(screen.getByText("Reports snapshot"));
  expect(screen.queryByRole("heading", { name: "Marketing performance" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Before and after advertising" })).toBeNull();
});

test("keeps the pending review alert and the fuel price note in reports snapshot", async () => {
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
  fireEvent.click(screen.getByText("Reports snapshot"));
  expect(await screen.findByRole("heading", { name: "UK average fuel prices" })).toBeTruthy();
  expect(screen.getByText(/Petrol 134.5p\/L/)).toBeTruthy();
  expect(screen.getByText(/informational only, not linked to fares/)).toBeTruthy();
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
  fireEvent.click(screen.getByText("Reports snapshot"));
  expect(screen.getByRole("heading", { name: "Before" })).toBeTruthy();
  expect(screen.getByText(/Before ads:/)).toBeTruthy();
  expect(screen.getByText(/After ads:/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "After" })).toBeTruthy();
  expect(screen.getByText("Visual comparison")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Incomplete records in the before and after comparison" })).toBeTruthy();
});

test("lists a future return in exceptions when the outbound is already completed", () => {
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
    expect(screen.getAllByText(/SP355017/).length).toBeGreaterThan(0);
    expect(screen.getByText(/· Return/)).toBeTruthy();
    expect(screen.getByText("London Heathrow Terminal 2 → 10 Beech Crescent OX5 1DN")).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Driver not confirmed")).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test("opens a booking when a Today row is clicked", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-24T10:00:00Z"));
  const onOpenBooking = jest.fn();
  const row = booking({
    id: "pending1",
    bookingNumber: "SP-PENDING",
    status: "pending",
    pickupTime: "2026-11-25T09:00:00Z",
    dateTime: "2026-11-25T09:00:00Z",
  });
  render(
    <Dashboard
      activeDriversCount={1}
      availableVehiclesCount={1}
      totalBookings={1}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={1}
      bookings={[row]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
      onOpenBooking={onOpenBooking}
    />
  );
  try {
    fireEvent.click(screen.getAllByRole("button", { name: /SP-PENDING/ })[0]);
    expect(onOpenBooking).toHaveBeenCalledWith(expect.objectContaining({ id: "pending1" }));
  } finally {
    jest.useRealTimers();
  }
});
