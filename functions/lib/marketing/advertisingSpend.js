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
exports.readAdvertisingSpend = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const spendSnapshot_1 = require("./spendSnapshot");
const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
/**
 * Read only advertising spend check.
 * Reads dated, server-imported reports. This does not call Google Ads or change campaigns or budgets.
 * Customer details are not accepted or returned.
 */
exports.readAdvertisingSpend = functions.https.onCall(async (data, context) => {
    const email = String(context.auth?.token?.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        throw new functions.https.HttpsError("permission-denied", "Admin only.");
    }
    const from = String(data?.from || ''), to = String(data?.to || '');
    const validation = (0, spendSnapshot_1.spendSnapshotTotal)(from, to, []);
    if (validation.reason.startsWith('Select'))
        return { ...validation, connected: false, budgetChanged: false };
    const snapshots = await admin.firestore().collection('marketingAdsDaily').where('date', '>=', from).where('date', '<=', to).get();
    const rows = snapshots.docs.map(doc => {
        const row = doc.data();
        return { date: row.date, accountId: row.accountId, currency: row.currency, costMicros: row.costMicros, retrievedAtMs: row.retrievedAt?.toMillis?.() || 0, provenance: row.provenance, reportingTimezone: row.reportingTimezone, completeDay: row.completeDay };
    });
    return { ...(0, spendSnapshot_1.spendSnapshotTotal)(from, to, rows), connected: false, budgetChanged: false };
});
