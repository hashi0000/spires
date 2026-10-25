import {
  calendarDaysBetween,
  dueDateFor,
  invoiceEmailState,
  invoicePaidOnLabel,
  invoicePaymentInstruction,
  invoicePaymentMethodLabel,
  invoicePaymentState,
  invoicePaymentTermsLabel,
  normaliseInvoicePaymentMethod,
  paymentDueNotice,
  paymentTermsFromDates,
} from "./generalInvoiceTypes";

const INVOICE = "2026-09-20";

describe("invoice payment terms from due date", () => {
  test("same calendar day is due on receipt", () => {
    expect(paymentTermsFromDates(INVOICE, "2026-09-20")).toBe("due_on_receipt");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-20")).toBe("Due on receipt");
    expect(paymentDueNotice(INVOICE, "2026-09-20")).toBe("Payment is due on receipt.");
  });

  test("3 calendar days is payment within 3 days", () => {
    expect(dueDateFor(INVOICE, "3_days")).toBe("2026-09-23");
    expect(paymentTermsFromDates(INVOICE, "2026-09-23")).toBe("3_days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-23")).toBe("Payment within 3 days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-23")).not.toContain("Due on receipt");
  });

  test("7 calendar days is payment within 7 days", () => {
    expect(dueDateFor(INVOICE, "7_days")).toBe("2026-09-27");
    expect(paymentTermsFromDates(INVOICE, "2026-09-27")).toBe("7_days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-27")).toBe("Payment within 7 days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-27")).not.toContain("Due on receipt");
  });

  test("14 calendar days is payment within 14 days", () => {
    expect(dueDateFor(INVOICE, "14_days")).toBe("2026-10-04");
    expect(paymentTermsFromDates(INVOICE, "2026-10-04")).toBe("14_days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-10-04")).toBe("Payment within 14 days");
  });

  test("30 calendar days is payment within 30 days", () => {
    expect(dueDateFor(INVOICE, "30_days")).toBe("2026-10-20");
    expect(paymentTermsFromDates(INVOICE, "2026-10-20")).toBe("30_days");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-10-20")).toBe("Payment within 30 days");
  });

  test("any other future due date is not due on receipt", () => {
    expect(paymentTermsFromDates(INVOICE, "2026-09-30")).toBe("custom");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-30")).toBe("Payment due by 30 September 2026");
    expect(invoicePaymentTermsLabel(INVOICE, "2026-09-30")).not.toContain("Due on receipt");
    expect(paymentDueNotice(INVOICE, "2026-09-30")).toBe("Payment is due by 30 September 2026.");
  });

  test("calendar day gap is not affected by UK DST", () => {
    expect(calendarDaysBetween("2026-10-20", "2026-10-27")).toBe(7);
    expect(paymentTermsFromDates("2026-10-20", "2026-10-27")).toBe("7_days");
    expect(calendarDaysBetween("2026-03-25", "2026-04-01")).toBe(7);
    expect(paymentTermsFromDates("2026-03-25", "2026-04-01")).toBe("7_days");
  });
});

describe("invoice payment method", () => {
  test("missing or unknown values default to bank transfer", () => {
    expect(normaliseInvoicePaymentMethod(undefined)).toBe("bank_transfer");
    expect(normaliseInvoicePaymentMethod("account")).toBe("bank_transfer");
    expect(invoicePaymentMethodLabel(undefined)).toBe("Bank transfer");
    expect(invoicePaymentInstruction()).toContain("bank transfer");
  });

  test("card and cash keep their own instructions", () => {
    expect(normaliseInvoicePaymentMethod("Card")).toBe("card");
    expect(normaliseInvoicePaymentMethod("cash")).toBe("cash");
    expect(invoicePaymentMethodLabel("card")).toBe("Card");
    expect(invoicePaymentInstruction("card")).toContain("pay by card");
    expect(invoicePaymentInstruction("cash")).toContain("pay in cash");
    expect(invoicePaymentInstruction("card")).not.toContain("bank transfer");
  });
});

describe("invoice paid and email state", () => {
  const row = {
    dueDate: "2026-10-01",
    lines: [{ description: "Journey", quantity: 1, unitPrice: 40, vatRatePercent: 0 }],
  };

  test("missing payment data stays unpaid and a real due date can be overdue", () => {
    expect(invoicePaymentState(row, "2026-10-20")).toBe("overdue");
    expect(invoicePaymentState({ ...row, paidAt: "2026-10-05T10:00:00.000Z" }, "2026-10-20")).toBe("paid");
    expect(invoicePaymentState({ ...row, dueDate: "" }, "2026-10-20")).toBe("unpaid");
    expect(invoicePaidOnLabel("2026-10-05T10:00:00.000Z")).toContain("2026");
    expect(invoicePaidOnLabel("")).toBe("");
    expect(invoiceEmailState({})).toBe("not_sent");
    expect(invoiceEmailState({ emailStatus: "failed", emailedAt: "2026-10-01" })).toBe("failed");
    expect(invoiceEmailState({ emailedAt: "2026-10-01" })).toBe("sent");
  });
});
