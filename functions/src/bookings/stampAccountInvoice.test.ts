import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAccountInvoiceStamp } from "./stampAccountInvoice";

describe("planAccountInvoiceStamp", () => {
  it("stamps unbilled bookings without changing payment status fields", () => {
    const patch = planAccountInvoiceStamp(
      { bookingNumber: "SP1", invoiceStatus: "unbilled", paymentStatus: "pending", revision: 3 },
      "b1",
      ["b1"],
      "inv1",
      "ST-EDU-202611-001"
    );
    assert.equal(patch.invoiceStatus, "invoiced");
    assert.equal(patch.invoiceReference, "ST-EDU-202611-001");
    assert.equal(patch.invoiceId, "inv1");
    assert.deepEqual(patch.invoicedBillingKeys, ["b1"]);
    assert.equal(Object.prototype.hasOwnProperty.call(patch, "paymentStatus"), false);
    assert.equal(patch.revision, 4);
  });

  it("rejects a second invoice for the same billable key", () => {
    assert.throws(
      () =>
        planAccountInvoiceStamp(
          {
            bookingNumber: "SP1",
            invoiceStatus: "invoiced",
            invoiceReference: "ST-EDU-202611-001",
            invoicedBillingKeys: ["b1"],
            invoiceLinks: [{ key: "b1", invoiceId: "inv1", invoiceNumber: "ST-EDU-202611-001" }],
            revision: 4,
          },
          "b1",
          ["b1"],
          "inv2",
          "ST-EDU-202611-002"
        ),
      /already on invoice ST-EDU-202611-001/
    );
  });

  it("is idempotent for the same invoice number", () => {
    const patch = planAccountInvoiceStamp(
      {
        bookingNumber: "SP1",
        invoiceStatus: "invoiced",
        invoiceReference: "ST-EDU-202611-001",
        invoicedBillingKeys: ["b1"],
        invoiceLinks: [{ key: "b1", invoiceId: "inv1", invoiceNumber: "ST-EDU-202611-001" }],
        revision: 4,
      },
      "b1",
      ["b1"],
      "inv1",
      "ST-EDU-202611-001"
    );
    assert.equal(patch.invoiceStatus, "invoiced");
    assert.equal((patch.invoiceLinks as unknown[]).length, 1);
  });
});
