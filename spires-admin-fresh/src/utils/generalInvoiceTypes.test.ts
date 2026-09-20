import {
  calendarDaysBetween,
  dueDateFor,
  invoicePaymentTermsLabel,
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
