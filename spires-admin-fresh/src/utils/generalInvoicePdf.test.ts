import { DEFAULT_GENERAL_SUPPLIER } from "./generalInvoiceTypes";
import { buildGeneralInvoiceHtml, GeneralInvoicePdfInput } from "./generalInvoicePdf";

function pdfInput(invoiceDate: string, dueDate: string): GeneralInvoicePdfInput {
  return {
    invoiceNumber: "ST-INV-202609-001",
    invoiceDate,
    dueDate,
    paymentTerms: "due_on_receipt",
    customer: {
      name: "Test Customer",
      address: "1 High Street",
      email: "test@example.com",
      phone: "01865 000000",
    },
    bookingNumber: "",
    travelDate: "",
    pickup: "",
    destination: "",
    lines: [{ description: "Airport transfer", quantity: 1, unitPrice: 50, vatRatePercent: 0 }],
    notes: "",
    supplier: DEFAULT_GENERAL_SUPPLIER,
  };
}

describe("invoice PDF payment wording", () => {
  test("same-day due date shows Due on receipt, not a contradictory due date", () => {
    const html = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-09-20"));
    expect(html).toContain("Payment terms");
    expect(html).toContain("Due on receipt");
    expect(html).toContain("20 September 2026");
    expect(html).not.toContain("(Due on receipt)");
    expect(html).toContain("Payment is due on receipt.");
  });

  test("7-day due date does not show Due on receipt", () => {
    const html = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-09-27"));
    expect(html).toContain("Payment within 7 days");
    expect(html).toContain("27 September 2026");
    expect(html).not.toContain("Due on receipt");
    expect(html).not.toContain("(Due on receipt)");
    expect(html).toContain("Payment is due within 7 days.");
  });

  test("14-day and 30-day due dates match the selected gap", () => {
    const fourteen = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-10-04"));
    expect(fourteen).toContain("Payment within 14 days");
    expect(fourteen).toContain("4 October 2026");
    expect(fourteen).not.toContain("Due on receipt");

    const thirty = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-10-20"));
    expect(thirty).toContain("Payment within 30 days");
    expect(thirty).toContain("20 October 2026");
    expect(thirty).not.toContain("Due on receipt");
  });

  test("custom future due date shows the actual date and not Due on receipt", () => {
    const html = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-09-30"));
    expect(html).toContain("Payment due by 30 September 2026");
    expect(html).toContain("Due date");
    expect(html).toContain("30 September 2026");
    expect(html).not.toContain("Due on receipt");
    expect(html).toContain("Payment is due by 30 September 2026.");
  });

  test("stored due_on_receipt cannot override a later due date", () => {
    const html = buildGeneralInvoiceHtml(pdfInput("2026-09-20", "2026-09-27"));
    expect(html).toContain("Payment within 7 days");
    expect(html).not.toContain("Due on receipt");
  });
});
