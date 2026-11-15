"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const paymentAttempt_1 = require("./paymentAttempt");
(0, node_test_1.describe)("Stripe payment attempt", () => {
    (0, node_test_1.it)("reuses an open intent when the balance has not changed", () => {
        const plan = (0, paymentAttempt_1.paymentAttemptPlan)({
            id: "job-1",
            openStripePaymentIntentId: "pi_open1",
            openStripePaymentAmountPence: 2000,
        }, 2000, "attempt-b");
        strict_1.default.equal(plan.action, "reuse");
    });
    (0, node_test_1.it)("creates a new attempt when the fare changes, when the open payment was credited, and for a second equal amount", () => {
        const changed = (0, paymentAttempt_1.paymentAttemptPlan)({
            id: "job-1",
            openStripePaymentIntentId: "pi_open1",
            openStripePaymentAmountPence: 2000,
        }, 1500, "attempt-c");
        strict_1.default.equal(changed.action, "create");
        strict_1.default.equal(changed.action === "create" && changed.idempotencyKey, "spires_job-1_attempt-c");
        const credited = (0, paymentAttempt_1.paymentAttemptPlan)({
            id: "job-1",
            openStripePaymentIntentId: "pi_deposit",
            openStripePaymentAmountPence: 2000,
            appliedStripePaymentIntentIds: ["pi_deposit"],
            amountReceivedPence: 2000,
        }, 2000, "attempt-d");
        strict_1.default.equal(credited.action, "create");
        strict_1.default.notEqual(credited.action === "create" && credited.idempotencyKey, "spires_job-1_attempt-c");
        strict_1.default.equal(String(credited.action === "create" && credited.idempotencyKey).includes("_2000"), false);
    });
});
