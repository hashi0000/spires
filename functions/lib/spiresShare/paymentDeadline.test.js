"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const paymentDeadline_1 = require("./paymentDeadline");
(0, node_test_1.describe)("payment deadline quiet hours (Europe/London)", () => {
    (0, node_test_1.it)("keeps a daytime 2 hour window", () => {
        const result = (0, paymentDeadline_1.computePaymentDeadline)("2026-09-28T17:00:00.000Z", 2);
        strict_1.default.equal(result.deadlineAt, "2026-09-28T19:00:00.000Z");
        strict_1.default.equal(result.quietHoursApplied, false);
    });
    (0, node_test_1.it)("does not expire a 01:00 request at 03:00", () => {
        const openedAt = "2026-01-15T01:00:00.000Z";
        strict_1.default.equal((0, paymentDeadline_1.isLondonQuietHours)(openedAt), true);
        const result = (0, paymentDeadline_1.computePaymentDeadline)(openedAt, 2);
        strict_1.default.equal(result.deadlineAt, "2026-01-15T09:00:00.000Z");
        strict_1.default.equal(result.quietHoursApplied, true);
    });
    (0, node_test_1.it)("pushes a 21:00 open that would expire at 23:00 to 09:00 next morning", () => {
        const result = (0, paymentDeadline_1.computePaymentDeadline)("2026-01-15T21:00:00.000Z", 2);
        strict_1.default.equal(result.deadlineAt, "2026-01-16T09:00:00.000Z");
        strict_1.default.equal(result.quietHoursApplied, true);
    });
    (0, node_test_1.it)("handles BST overnight the same way", () => {
        const openedAt = "2026-07-15T00:00:00.000Z";
        const result = (0, paymentDeadline_1.computePaymentDeadline)(openedAt, 2);
        strict_1.default.equal(result.quietHoursApplied, true);
        strict_1.default.ok(new Date(result.deadlineAt).getTime() - new Date(openedAt).getTime() > 2 * 60 * 60 * 1000);
    });
    (0, node_test_1.it)("reuses a remaining journey deadline for a fifth passenger", () => {
        const now = "2026-09-28T12:00:00.000Z";
        const existing = "2026-09-28T13:30:00.000Z";
        const result = (0, paymentDeadline_1.computeJoinerPaymentDeadline)(now, existing, 2);
        strict_1.default.equal(result.deadlineAt, existing);
    });
});
