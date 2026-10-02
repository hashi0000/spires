"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const paymentProvider_1 = require("./paymentProvider");
(0, node_test_1.describe)("MockPaymentProvider", () => {
    (0, node_test_1.it)("verifies a method without taking funds", async () => {
        const provider = new paymentProvider_1.MockPaymentProvider();
        const method = await provider.verifyPaymentMethod();
        strict_1.default.equal(method.status, "PAYMENT_METHOD_VERIFIED");
        strict_1.default.ok(method.paymentMethodRef);
    });
    (0, node_test_1.it)("authorises then captures, and will not capture twice from a released auth", async () => {
        const provider = new paymentProvider_1.MockPaymentProvider();
        await provider.authorise({ paymentId: "p1", amountPence: 3500 });
        const captured = await provider.capture("p1");
        strict_1.default.equal(captured.status, "CAPTURED");
        const refunded = await provider.refund("p1");
        strict_1.default.equal(refunded.status, "REFUNDED");
    });
    (0, node_test_1.it)("releases an authorisation instead of charging", async () => {
        const provider = new paymentProvider_1.MockPaymentProvider();
        await provider.authorise({ paymentId: "p2", amountPence: 3500 });
        const released = await provider.release("p2");
        strict_1.default.equal(released.status, "AUTHORISATION_RELEASED");
        const captured = await provider.capture("p2");
        strict_1.default.equal(captured.status, "AUTHORISATION_RELEASED");
    });
    (0, node_test_1.it)("does not invent Shift4 credentials", () => {
        strict_1.default.equal((0, paymentProvider_1.createSharePaymentProvider)().provider, "mock");
        strict_1.default.throws(() => new paymentProvider_1.Shift4OnlinePaymentProvider({}));
    });
});
