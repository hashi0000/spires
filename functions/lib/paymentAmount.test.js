"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const paymentAmount_1 = require("./paymentAmount");
(0, node_test_1.describe)("server payable amount", () => {
    (0, node_test_1.it)("uses the deposit that is still due, then the remaining balance", () => {
        const deposit = (0, paymentAmount_1.serverPayablePence)({ actualFare: 92, amountReceivedPence: 0, depositRequired: true, depositAmount: 20 });
        strict_1.default.equal(deposit.ok && deposit.pence, 2000);
        const balance = (0, paymentAmount_1.serverPayablePence)({ actualFare: 92, amountReceivedPence: 2000, depositRequired: true, depositAmount: 20 });
        strict_1.default.equal(balance.ok && balance.pence, 7200);
    });
    (0, node_test_1.it)("treats a paid deposit missing from the payment total as already received", () => {
        const booking = {
            actualFare: 235,
            amountReceivedPence: 0,
            depositRequired: true,
            depositAmount: 35,
            depositStatus: "paid",
        };
        strict_1.default.equal((0, paymentAmount_1.effectiveReceivedPence)(booking), 3500);
        const due = (0, paymentAmount_1.serverPayablePence)({ ...booking, status: "confirmed" });
        strict_1.default.equal(due.ok && due.pence, 20000);
    });
    (0, node_test_1.it)("rejects a cancelled booking, a missing fare, and a stale browser amount", () => {
        strict_1.default.equal((0, paymentAmount_1.serverPayablePence)({ status: "cancelled", actualFare: 40 }).ok, false);
        strict_1.default.equal((0, paymentAmount_1.serverPayablePence)({ status: "confirmed", actualFare: 0 }).ok, false);
        strict_1.default.equal((0, paymentAmount_1.serverPayablePence)({ status: "completed", actualFare: 40, amountReceivedPence: 4000 }).ok, false);
        const due = (0, paymentAmount_1.serverPayablePence)({ status: "confirmed", actualFare: 40 });
        strict_1.default.equal(due.ok && (0, paymentAmount_1.clientAmountMatchesPayable)(due.ok ? due.pence : 0, "39.00"), false);
        strict_1.default.equal(due.ok && (0, paymentAmount_1.clientAmountMatchesPayable)(due.ok ? due.pence : 0, "£40.00"), true);
        strict_1.default.equal((0, paymentAmount_1.paymentClaimAllows)("booking-a", "booking-b"), false);
        strict_1.default.equal((0, paymentAmount_1.paymentClaimAllows)("booking-a", "booking-a"), true);
        strict_1.default.equal((0, paymentAmount_1.paymentClaimAllows)("", "booking-b"), true);
    });
});
