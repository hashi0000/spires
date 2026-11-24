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
const completeAndRecord_1 = require("./completeAndRecord");
(0, node_test_1.describe)("completeRecordPlan", () => {
    (0, node_test_1.it)("labels a private job with outstanding balance for one click record", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({
            status: "allocated",
            actualFare: 235,
            amountReceivedPence: 0,
            paymentMethod: "cash",
            dueOnOutbound: 176.25,
            dueOnReturn: 58.75,
            bookingType: "return",
            returnPickupTime: "2026-11-20T18:00:00Z",
        }, "outbound");
        assert.equal(plan.mode, "complete_and_record");
        assert.equal(plan.amountPence, 17625);
        assert.match(plan.label, /Complete & record £176\.25 received/);
    });
    (0, node_test_1.it)("leaves the remaining balance for the return when the split is agreed", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({
            status: "allocated",
            outboundStatus: "completed",
            actualFare: 235,
            amountReceivedPence: 17625,
            paymentMethod: "cash",
            dueOnOutbound: 176.25,
            dueOnReturn: 58.75,
            bookingType: "return",
            returnPickupTime: "2026-11-20T18:00:00Z",
        }, "return");
        assert.equal(plan.mode, "complete_and_record");
        assert.equal(plan.amountPence, 5875);
    });
    (0, node_test_1.it)("does not invent a split on an earlier return leg", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({
            status: "allocated",
            actualFare: 235,
            amountReceivedPence: 0,
            paymentMethod: "card",
            bookingType: "return",
            returnPickupTime: "2026-11-20T18:00:00Z",
        }, "outbound");
        assert.equal(plan.mode, "complete_only");
        assert.equal(plan.reason, "no_leg_split");
    });
    (0, node_test_1.it)("uses the full remaining balance on the last leg without a split", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({
            status: "allocated",
            outboundStatus: "completed",
            actualFare: 235,
            amountReceivedPence: 3500,
            paymentMethod: "card",
            bookingType: "return",
            returnPickupTime: "2026-11-20T18:00:00Z",
        }, "return");
        assert.equal(plan.mode, "complete_and_record");
        assert.equal(plan.amountPence, 20000);
    });
    (0, node_test_1.it)("marks account and paid jobs complete without payment", () => {
        assert.equal((0, completeAndRecord_1.completeRecordPlan)({ status: "allocated", actualFare: 100, paymentMethod: "account", amountReceivedPence: 0 }, "outbound").reason, "account");
        assert.equal((0, completeAndRecord_1.completeRecordPlan)({ status: "allocated", actualFare: 100, paymentStatus: "paid", amountReceivedPence: 10000 }, "outbound").reason, "paid");
    });
    (0, node_test_1.it)("leaves payment for review when charges still need calculating", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({
            status: "allocated",
            actualFare: 180,
            amountReceivedPence: 0,
            paymentMethod: "cash",
            timedHire: { hireHours: 6 },
        }, "outbound");
        assert.equal(plan.mode, "complete_only");
        assert.equal(plan.reason, "charges_pending");
    });
    (0, node_test_1.it)("does not guess a payment method when none is stored", () => {
        const plan = (0, completeAndRecord_1.completeRecordPlan)({ status: "allocated", actualFare: 80, amountReceivedPence: 0 }, "outbound");
        assert.equal(plan.mode, "complete_and_record");
        assert.equal(plan.methodKnown, false);
        assert.equal(plan.paymentMethod, "");
    });
});
(0, node_test_1.describe)("applyCompleteLegPatch", () => {
    (0, node_test_1.it)("completes only the selected return leg", () => {
        const decision = (0, completeAndRecord_1.applyCompleteLegPatch)({
            status: "allocated",
            outboundStatus: "completed",
            bookingType: "return",
            returnPickupTime: "2026-11-20T18:00:00Z",
        }, "return");
        assert.equal(decision.ok, true);
        if (!decision.ok)
            return;
        assert.equal(decision.patch.status, "completed");
        assert.equal(decision.patch.returnStatus, "completed");
        assert.equal(decision.completedAtField, "returnCompletedAt");
    });
});
