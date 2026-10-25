import { bookingMatchesStatusFilter } from "./bookingWorkflow";

describe("booking status filters", () => {
  test("allocated legacy rows and the new quote status stay in the right filters", () => {
    expect(bookingMatchesStatusFilter({ status: "confirmed", adminStatus: "allocated" }, "allocated")).toBe(true);
    expect(bookingMatchesStatusFilter({ status: "confirmed", adminStatus: "allocated" }, "confirmed")).toBe(false);
    expect(bookingMatchesStatusFilter({ status: "paid" }, "completed")).toBe(true);
    expect(bookingMatchesStatusFilter({ status: "awaiting_customer_confirmation" }, "pending")).toBe(false);
    expect(bookingMatchesStatusFilter({ status: "pending" }, "all")).toBe(true);
  });
});
