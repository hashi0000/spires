"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const stampAccountInvoice_1 = require("./stampAccountInvoice");
(0, node_test_1.describe)("planAccountInvoiceStamp", () => {
    (0, node_test_1.it)("stamps unbilled bookings without changing payment status fields", () => {
        const patch = (0, stampAccountInvoice_1.planAccountInvoiceStamp)({ bookingNumber: "SP1", invoiceStatus: "unbilled", paymentStatus: "pending", revision: 3 }, "b1", ["b1"], "inv1", "ST-EDU-202611-001");
        strict_1.default.equal(patch.invoiceStatus, "invoiced");
        strict_1.default.equal(patch.invoiceReference, "ST-EDU-202611-001");
        strict_1.default.equal(patch.invoiceId, "inv1");
        strict_1.default.deepEqual(patch.invoicedBillingKeys, ["b1"]);
        strict_1.default.equal(Object.prototype.hasOwnProperty.call(patch, "paymentStatus"), false);
        strict_1.default.equal(patch.revision, 4);
    });
    (0, node_test_1.it)("rejects a second invoice for the same billable key", () => {
        strict_1.default.throws(() => (0, stampAccountInvoice_1.planAccountInvoiceStamp)({
            bookingNumber: "SP1",
            invoiceStatus: "invoiced",
            invoiceReference: "ST-EDU-202611-001",
            invoicedBillingKeys: ["b1"],
            invoiceLinks: [{ key: "b1", invoiceId: "inv1", invoiceNumber: "ST-EDU-202611-001" }],
            revision: 4,
        }, "b1", ["b1"], "inv2", "ST-EDU-202611-002"), /already on invoice ST-EDU-202611-001/);
    });
    (0, node_test_1.it)("is idempotent for the same invoice number", () => {
        const patch = (0, stampAccountInvoice_1.planAccountInvoiceStamp)({
            bookingNumber: "SP1",
            invoiceStatus: "invoiced",
            invoiceReference: "ST-EDU-202611-001",
            invoicedBillingKeys: ["b1"],
            invoiceLinks: [{ key: "b1", invoiceId: "inv1", invoiceNumber: "ST-EDU-202611-001" }],
            revision: 4,
        }, "b1", ["b1"], "inv1", "ST-EDU-202611-001");
        strict_1.default.equal(patch.invoiceStatus, "invoiced");
        strict_1.default.equal(patch.invoiceLinks.length, 1);
    });
});
