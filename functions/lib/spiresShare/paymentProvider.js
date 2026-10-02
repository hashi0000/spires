"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shift4OnlinePaymentProvider = exports.MockPaymentProvider = void 0;
exports.createSharePaymentProvider = createSharePaymentProvider;
exports.paymentSecuresSeat = paymentSecuresSeat;
exports.paymentIsOpenAuth = paymentIsOpenAuth;
exports.paymentCanRelease = paymentCanRelease;
/** In-memory/dev provider. Behaves like the intended online flow: method first, authorise at confirmation, capture only if the whole group succeeds. */
class MockPaymentProvider {
    constructor(store = new Map()) {
        this.store = store;
        this.provider = "mock";
    }
    async verifyPaymentMethod(input = {}) {
        if (input.succeed === false) {
            return { id: "", status: "FAILED", provider: "mock" };
        }
        const paymentMethodRef = `pm_mock_${randomId()}`;
        return {
            id: "",
            status: "PAYMENT_METHOD_VERIFIED",
            paymentMethodRef,
            provider: "mock",
            providerRef: paymentMethodRef,
        };
    }
    async authorise(input) {
        if (input.succeed === false) {
            this.store.set(input.paymentId, {
                status: "FAILED",
                amountPence: input.amountPence,
                paymentMethodRef: input.paymentMethodRef,
            });
            return { id: input.paymentId, status: "FAILED", provider: "mock" };
        }
        const row = {
            status: "AUTHORISED",
            amountPence: input.amountPence,
            paymentMethodRef: input.paymentMethodRef,
            providerRef: `auth_mock_${input.paymentId}`,
        };
        this.store.set(input.paymentId, row);
        return {
            id: input.paymentId,
            status: "AUTHORISED",
            paymentMethodRef: input.paymentMethodRef,
            provider: "mock",
            providerRef: row.providerRef,
        };
    }
    async capture(paymentId) {
        const row = this.store.get(paymentId);
        if (!row || row.status !== "AUTHORISED") {
            return { id: paymentId, status: row?.status || "FAILED", provider: "mock" };
        }
        const next = { ...row, status: "CAPTURED" };
        this.store.set(paymentId, next);
        return { id: paymentId, status: "CAPTURED", provider: "mock", providerRef: row.providerRef };
    }
    async release(paymentId) {
        const row = this.store.get(paymentId);
        if (!row)
            return { id: paymentId, status: "AUTHORISATION_RELEASED", provider: "mock" };
        if (row.status === "CAPTURED")
            return { id: paymentId, status: "CAPTURED", provider: "mock" };
        if (row.status === "REFUNDED" || row.status === "REFUND_PENDING") {
            return { id: paymentId, status: row.status, provider: "mock" };
        }
        const next = { ...row, status: "AUTHORISATION_RELEASED" };
        this.store.set(paymentId, next);
        return { id: paymentId, status: "AUTHORISATION_RELEASED", provider: "mock" };
    }
    async refund(paymentId) {
        const row = this.store.get(paymentId);
        if (!row)
            return { id: paymentId, status: "FAILED", provider: "mock" };
        if (row.status !== "CAPTURED" && row.status !== "REFUND_PENDING") {
            return { id: paymentId, status: row.status, provider: "mock" };
        }
        const next = { ...row, status: "REFUNDED" };
        this.store.set(paymentId, next);
        return { id: paymentId, status: "REFUNDED", provider: "mock" };
    }
    get(id) {
        return this.store.get(id) || null;
    }
    seed(id, row) {
        this.store.set(id, row);
    }
}
exports.MockPaymentProvider = MockPaymentProvider;
/**
 * Placeholder for a future Shift4 online/API product.
 * Do not construct this with invented credentials. Physical terminals are out of scope.
 */
class Shift4OnlinePaymentProvider {
    constructor(credentials = {}) {
        this.credentials = credentials;
        this.provider = "shift4_online";
        if (!credentials.secretKey) {
            throw new Error("Shift4 online payments are not configured. Do not invent API credentials. Keep using MockPaymentProvider until Shift4 issues an online/API product.");
        }
    }
    async verifyPaymentMethod() {
        throw new Error("Shift4 online verifyPaymentMethod is not implemented until the API specification is provided.");
    }
    async authorise() {
        throw new Error("Shift4 online authorise is not implemented until the API specification is provided.");
    }
    async capture() {
        throw new Error("Shift4 online capture is not implemented until the API specification is provided.");
    }
    async release() {
        throw new Error("Shift4 online release is not implemented until the API specification is provided.");
    }
    async refund() {
        throw new Error("Shift4 online refund is not implemented until the API specification is provided.");
    }
}
exports.Shift4OnlinePaymentProvider = Shift4OnlinePaymentProvider;
function createSharePaymentProvider() {
    const secret = process.env.SHIFT4_ONLINE_SECRET || "";
    if (secret) {
        return new Shift4OnlinePaymentProvider({ secretKey: secret });
    }
    return new MockPaymentProvider();
}
/** Isolated. The live Share MVP does not construct this provider for customer reservations. */
function paymentSecuresSeat(status) {
    return (status === "HOSTED_UNPAID" ||
        status === "HOSTED_PENDING" ||
        status === "HOSTED_PAID" ||
        status === "PAYMENT_METHOD_VERIFIED" ||
        status === "PAYMENT_ACTION_REQUIRED" ||
        status === "AUTHORISATION_PENDING" ||
        status === "AUTHORISED" ||
        status === "CAPTURE_PENDING" ||
        status === "CAPTURED");
}
function paymentIsOpenAuth(status) {
    return status === "AUTHORISED" || status === "AUTHORISATION_PENDING" || status === "CAPTURE_PENDING";
}
function paymentCanRelease(status) {
    return (status === "PAYMENT_METHOD_VERIFIED" ||
        status === "PAYMENT_ACTION_REQUIRED" ||
        status === "AUTHORISATION_PENDING" ||
        status === "AUTHORISED" ||
        status === "CAPTURE_PENDING" ||
        status === "PAYMENT_METHOD_REQUIRED");
}
function randomId() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
