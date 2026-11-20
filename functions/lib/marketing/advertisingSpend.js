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
const googleAdsReport_1 = require("./googleAdsReport");
const ADMIN_EMAILS = ['spirestaxis24@gmail.com', 'hashim@spires.com'];
function readSyncStatus(data) {
    const row = data || {};
    return {
        status: String(row.status || 'unknown'),
        from: typeof row.from === 'string' ? row.from : null,
        to: typeof row.to === 'string' ? row.to : null,
        days: Number.isSafeInteger(row.days) ? row.days : null,
        campaignRows: Number.isSafeInteger(row.campaignRows) ? row.campaignRows : null,
        campaigns: Number.isSafeInteger(row.campaigns) ? row.campaigns : null,
        updatedAtMs: row.updatedAt?.toMillis?.() || null,
        lastSuccessAtMs: row.lastSuccessAt?.toMillis?.() || null,
        attemptedAtMs: row.attemptedAt?.toMillis?.() || null,
        reason: typeof row.reason === 'string' ? row.reason : null,
        accountId: typeof row.accountId === 'string' ? row.accountId : null,
    };
}
/**
 * Read only advertising spend check.
 * Reads dated, server-imported reports. This does not call Google Ads or change campaigns or budgets.
 * Customer details are not accepted or returned. Tokens are never returned.
 */
exports.readAdvertisingSpend = functions.https.onCall(async (data, context) => {
    const email = String(context.auth?.token?.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
    }
    const from = String(data?.from || '');
    const to = String(data?.to || '');
    const validation = (0, spendSnapshot_1.spendSnapshotTotal)(from, to, []);
    const statusSnap = await admin.firestore().collection('marketingAdsSync').doc('status').get();
    const sync = readSyncStatus(statusSnap.data());
    if (validation.reason.startsWith('Select')) {
        return { ...validation, connected: false, budgetChanged: false, campaigns: [], sync };
    }
    const snapshots = await admin
        .firestore()
        .collection('marketingAdsDaily')
        .where('date', '>=', from)
        .where('date', '<=', to)
        .get();
    const rows = snapshots.docs.map((doc) => {
        const row = doc.data();
        return {
            date: row.date,
            accountId: row.accountId,
            currency: row.currency,
            costMicros: row.costMicros,
            retrievedAtMs: row.retrievedAt?.toMillis?.() || 0,
            provenance: row.provenance,
            reportingTimezone: row.reportingTimezone,
            completeDay: row.completeDay,
        };
    });
    const dailyWithCampaigns = snapshots.docs.map((doc) => {
        const row = doc.data();
        const campaigns = Array.isArray(row.campaigns) ? row.campaigns : [];
        return { date: String(row.date || ''), campaigns };
    });
    const campaigns = (0, googleAdsReport_1.aggregateCampaignSpend)(from, to, dailyWithCampaigns);
    return {
        ...(0, spendSnapshot_1.spendSnapshotTotal)(from, to, rows),
        connected: false,
        budgetChanged: false,
        campaigns,
        sync,
    };
});
