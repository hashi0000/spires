import {
  bookingMoney,
  effectiveReceivedPence,
  paidDepositAlreadyRecorded,
  paidDepositPaymentFields,
} from "./bookingMoney";

describe("bookingMoney deposit reconciliation", () => {
  const example = {
    actualFare: 235,
    depositRequired: true,
    depositAmount: 35,
    depositStatus: "paid",
    amountReceivedPence: 0,
  };

  it("counts a paid deposit that was never recorded as received", () => {
    const money = bookingMoney(example);
    expect(money.totalPence).toBe(23500);
    expect(money.receivedPence).toBe(3500);
    expect(money.outstandingPence).toBe(20000);
  });

  it("leaves a pending deposit out of the received total", () => {
    expect(effectiveReceivedPence({ ...example, depositStatus: "pending" })).toBe(0);
    expect(bookingMoney({ ...example, depositStatus: "pending" }).outstandingPence).toBe(23500);
  });

  it("does not double count a deposit already in payment history", () => {
    const recorded = {
      ...example,
      amountReceivedPence: 3500,
      paymentEntries: [{ clientRequestId: "deposit-SPMWNCVWMO9FA4EA52", kind: "deposit", amountPence: 3500 }],
    };
    expect(paidDepositAlreadyRecorded(recorded)).toBe(true);
    expect(effectiveReceivedPence(recorded)).toBe(3500);
    expect(paidDepositPaymentFields(recorded, "SPMWNCVWMO9FA4EA52")).toBeNull();
  });

  it("does not double count when later payments already cover the deposit", () => {
    const later = { ...example, amountReceivedPence: 23500, paymentEntries: [{ amountPence: 23500, note: "Balance" }] };
    expect(effectiveReceivedPence(later)).toBe(23500);
    expect(bookingMoney(later).outstandingPence).toBe(0);
  });

  it("builds a one time deposit payment patch for create or repair", () => {
    const patch = paidDepositPaymentFields(example, "SPMWNCVWMO9FA4EA52", "bank transfer") as Record<string, any>;
    expect(patch.amountReceivedPence).toBe(3500);
    expect(patch.paymentStatus).toBe("partial");
    expect(patch.paymentEntries[0].clientRequestId).toBe("deposit-SPMWNCVWMO9FA4EA52");
    expect(paidDepositPaymentFields({ ...example, ...patch }, "SPMWNCVWMO9FA4EA52")).toBeNull();
  });
});
