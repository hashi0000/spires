import { depositStillDuePence, paymentSummary, quoteSendState } from "./farePayment";

describe("fare payment summary", () => {
  it("calculates the outstanding balance from the agreed fare", () => {
    const part = paymentSummary(180, 5000);
    expect(part.label).toBe("Part paid");
    expect(part.outstandingPence).toBe(13000);
    expect(paymentSummary(180, 18000).label).toBe("Paid");
    expect(paymentSummary(180, 19000).overpaymentPence).toBe(1000);
    expect(paymentSummary(180, 0).label).toBe("Unpaid");
  });

  it("defaults the remaining deposit after money already received", () => {
    expect(depositStillDuePence(40, 1500)).toBe(2500);
    expect(depositStillDuePence(40, 5000)).toBe(0);
  });

  it("hides a new quote on an allocated booking and keeps the reason", () => {
    const allocated = quoteSendState("allocated");
    expect(allocated.send).toBe(false);
    expect(allocated.reissue).toBe(false);
    expect(allocated.reason).toMatch(/allocated/i);
    expect(quoteSendState("awaiting_customer_confirmation").reissue).toBe(true);
    expect(quoteSendState("pending").send).toBe(true);
  });
});
