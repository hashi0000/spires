import { describe, expect, it } from "vitest";
import { jobSelectionKey, legPaymentDue, planBulkPaymentLines, resolveJobCardLeg } from "./jobCardActions";

describe("legPaymentDue", () => {
  it("uses outstanding after a paid deposit on a one way", () => {
    const due = legPaymentDue({
      actualFare: 235,
      depositRequired: true,
      depositAmount: 35,
      depositStatus: "paid",
      amountReceivedPence: 3500,
      paymentEntries: [{ kind: "deposit", amountPence: 3500, mode: "add" }],
      paymentStatus: "partial",
      paymentMethod: "cash",
    }, "outbound");
    expect(due.ok).toBe(true);
    if (due.ok) expect(due.amountPence).toBe(20000);
  });

  it("flags return legs without an agreed split", () => {
    const due = legPaymentDue({
      bookingType: "return",
      returnPickupTime: "2026-11-20T18:00:00",
      returnPickupLocation: "Heathrow",
      returnDestination: "Oxford",
      actualFare: 235,
      amountReceivedPence: 3500,
      depositRequired: true,
      depositAmount: 35,
      depositStatus: "paid",
      paymentStatus: "partial",
    }, "return");
    expect(due.ok).toBe(false);
    if (!due.ok) expect(due.reason).toMatch(/cannot be determined/i);
  });

  it("uses dueOnOutbound for the outbound share", () => {
    const due = legPaymentDue({
      bookingType: "return",
      returnPickupTime: "2026-11-20T18:00:00",
      returnPickupLocation: "Heathrow",
      returnDestination: "Oxford",
      actualFare: 235,
      amountReceivedPence: 3500,
      dueOnOutbound: 100,
      dueOnReturn: 100,
      paymentStatus: "partial",
    }, "outbound");
    expect(due.ok).toBe(true);
    if (due.ok) expect(due.amountPence).toBe(10000);
  });

  it("treats account jobs as no collection", () => {
    const due = legPaymentDue({ actualFare: 90, paymentMethod: "account", paymentStatus: "pending" }, "booking");
    expect(due.kind).toBe("account");
    expect(due.amountPence).toBe(0);
  });
});

describe("planBulkPaymentLines", () => {
  it("keeps exceptions selected as skip lines", () => {
    const lines = planBulkPaymentLines([
      {
        key: "a|return",
        booking: {
          id: "a",
          bookingNumber: "SP1",
          bookingType: "return",
          returnPickupTime: "2026-11-20T18:00:00",
          returnPickupLocation: "Heathrow",
          returnDestination: "Oxford",
          actualFare: 200,
          amountReceivedPence: 0,
          paymentStatus: "pending",
        },
        leg: "return",
      },
    ]);
    expect(lines[0].skipPayment).toBe(true);
    expect(lines[0].exception).toMatch(/cannot be determined/i);
  });
});

describe("selection helpers", () => {
  it("builds leg scoped keys", () => {
    expect(jobSelectionKey("abc", "return")).toBe("abc|return");
    expect(resolveJobCardLeg({ leg: "return" })).toBe("return");
    expect(resolveJobCardLeg(null)).toBe("booking");
  });
});
