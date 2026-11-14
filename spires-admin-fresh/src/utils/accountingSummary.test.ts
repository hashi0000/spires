import { buildAccountingSummary } from "./accountingSummary";

const drivers = [
  { id: "d1", name: "Wasif Nawaz" },
  { id: "d2", name: "Sayyid Irfan Shah" },
];

test("known fares and payments stay visible when other completed jobs have no amount", () => {
  const summary = buildAccountingSummary([
    { status: "completed", actualFare: 165, amountReceivedPence: 16500, driverId: "d1", expenses: [{ amount: 20 }] },
    { status: "completed", actualFare: "89.50", amountReceivedPence: "4000", driverId: "d2" },
    { status: "completed", actualFare: undefined, amountReceivedPence: undefined, driverId: "d2" },
    { status: "pending", actualFare: 999, amountReceivedPence: 99900 },
  ], drivers);

  expect(summary.totalBookings).toBe(3);
  expect(summary.totalRevenue).toBe(254.5);
  expect(summary.faresMissing).toBe(1);
  expect(summary.totalExpenses).toBe(20);
  expect(summary.expensesMissing).toBe(2);
  expect(summary.paidAmount).toBe(205);
  expect(summary.recordedCount).toBe(2);
  expect(summary.unrecordedCount).toBe(1);
  expect(summary.driverRevenue).toEqual([
    { driver: "Wasif Nawaz", bookings: 1, knownFares: 1, revenue: 165 },
    { driver: "Sayyid Irfan Shah", bookings: 2, knownFares: 1, revenue: 89.5 },
  ]);
});

test("a missing amount is not turned into zero", () => {
  const summary = buildAccountingSummary([
    { status: "completed", actualFare: undefined, amountReceivedPence: undefined, driverId: "d1", expenses: [] },
    { status: "completed", actualFare: "", amountReceivedPence: null },
  ], drivers);

  expect(summary.totalRevenue).toBeNull();
  expect(summary.totalExpenses).toBeNull();
  expect(summary.paidAmount).toBeNull();
  expect(summary.faresMissing).toBe(2);
  expect(summary.driverRevenue[0].revenue).toBeNull();
});

test("a recorded zero stays zero", () => {
  const summary = buildAccountingSummary([
    { status: "completed", actualFare: 0, amountReceivedPence: 0, expenses: [{ amount: 0 }] },
  ], []);

  expect(summary.totalRevenue).toBe(0);
  expect(summary.totalExpenses).toBe(0);
  expect(summary.paidAmount).toBe(0);
  expect(summary.recordedCount).toBe(1);
  expect(summary.faresMissing).toBe(0);
});
