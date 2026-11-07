"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const node_test_1 = require("node:test");
const fareMath_1 = require("./fareMath");
(0, node_test_1.describe)("fare and payment totals", () => {
    (0, node_test_1.it)("derives unpaid, part paid and paid from the fare and money received", () => {
        assert.equal((0, fareMath_1.paymentPosition)(18000, 0).label, "Unpaid");
        assert.equal((0, fareMath_1.paymentPosition)(18000, 0).stored, "pending");
        const part = (0, fareMath_1.paymentPosition)(18000, 5000);
        assert.equal(part.label, "Part paid");
        assert.equal(part.outstandingPence, 13000);
        const paid = (0, fareMath_1.paymentPosition)(18000, 18000);
        assert.equal(paid.label, "Paid");
        assert.equal(paid.outstandingPence, 0);
        const over = (0, fareMath_1.paymentPosition)(18000, 19000);
        assert.equal(over.label, "Paid");
        assert.equal(over.overpaymentPence, 1000);
    });
    (0, node_test_1.it)("keeps a refund status and flags a stored paid mark with no money", () => {
        assert.equal((0, fareMath_1.paymentPosition)(18000, 18000, "refunded").label, "Refunded");
        assert.equal((0, fareMath_1.paymentPosition)(18000, 0, "paid").inconsistent, true);
    });
    (0, node_test_1.it)("adds a payment and can correct the running total", () => {
        assert.deepEqual((0, fareMath_1.nextReceivedPence)({ mode: "add", currentReceivedPence: 5000, amountPence: 2000 }), {
            ok: true,
            next: 7000,
        });
        assert.equal((0, fareMath_1.nextReceivedPence)({ mode: "add", currentReceivedPence: 5000, amountPence: 0 }).ok, false);
        assert.deepEqual((0, fareMath_1.nextReceivedPence)({ mode: "correct", currentReceivedPence: 7000, amountPence: 4000 }), {
            ok: true,
            next: 4000,
        });
    });
    (0, node_test_1.it)("defaults a request to the outstanding balance or the unpaid deposit", () => {
        const balance = (0, fareMath_1.requestAmountPence)({
            kind: "balance",
            farePence: 18000,
            receivedPence: 5000,
            depositPence: 4000,
        });
        assert.equal(balance.ok && balance.amountPence, 13000);
        assert.equal((0, fareMath_1.depositStillDuePence)(4000, 1500), 2500);
        const deposit = (0, fareMath_1.requestAmountPence)({
            kind: "deposit",
            farePence: 18000,
            receivedPence: 1500,
            depositPence: 4000,
        });
        assert.equal(deposit.ok && deposit.amountPence, 2500);
        const tooMuch = (0, fareMath_1.requestAmountPence)({
            kind: "balance",
            farePence: 18000,
            receivedPence: 5000,
            depositPence: 0,
            customPence: 20000,
        });
        assert.equal(tooMuch.ok, false);
    });
});
