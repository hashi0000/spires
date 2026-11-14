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
exports.refreshAdvertisingSpend = exports.scheduledAdvertisingSpend = void 0;
exports.syncGoogleAdsSpend = syncGoogleAdsSpend;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const quoteWorkflow_1 = require("../quotes/quoteWorkflow");
const googleAdsReport_1 = require("./googleAdsReport");
/** Keyless reporting identity. Google Ads grants it Read-only access; no mutate endpoint exists in this module. */
async function syncGoogleAdsSpend(deps = {}) {
    const db = admin.firestore(), config = await db.collection('marketingConfig').doc('googleAds').get();
    if (config.data()?.enabled !== true || config.data()?.serviceAccountEmail !== googleAdsReport_1.ADS_REPORTER)
        return { refreshed: false, reason: 'The read-only reporting connection is not enabled.' };
    const fetcher = deps.fetcher || fetch;
    const source = await (deps.sourceToken ? deps.sourceToken() : admin.credential.applicationDefault().getAccessToken().then(result => result.access_token));
    const minted = await fetcher(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${googleAdsReport_1.ADS_REPORTER}:generateAccessToken`, { method: 'POST', headers: { Authorization: `Bearer ${source}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/adwords'], lifetime: '1800s' }), signal: AbortSignal.timeout(15000) });
    if (!minted.ok)
        throw new Error(`Reporting identity returned HTTP ${minted.status}`);
    const token = (await minted.json()).accessToken;
    if (!token)
        throw new Error('Reporting identity could not obtain an access token');
    const query = async (statement) => {
        const response = await fetcher(`https://googleads.googleapis.com/${googleAdsReport_1.ADS_API_VERSION}/customers/${googleAdsReport_1.ADS_ACCOUNT}/googleAds:searchStream`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: statement }), signal: AbortSignal.timeout(30000),
        });
        if (!response.ok)
            throw new Error(`Google Ads reporting returned HTTP ${response.status}`);
        return (0, googleAdsReport_1.streamRows)(await response.json());
    };
    const dates = (0, googleAdsReport_1.finishedAdsDates)(), from = dates[0], to = dates[dates.length - 1];
    const metadata = await query('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer');
    const report = await query(`SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}' ORDER BY segments.date`);
    const rows = (0, googleAdsReport_1.normalizeAdsReport)(metadata, report, dates);
    const batch = db.batch(), at = admin.firestore.FieldValue.serverTimestamp();
    for (const row of rows)
        batch.set(db.collection('marketingAdsDaily').doc(`${googleAdsReport_1.ADS_ACCOUNT}_${row.date}`), { ...row, retrievedAt: at, apiVersion: googleAdsReport_1.ADS_API_VERSION });
    batch.set(db.collection('marketingAdsSync').doc('status'), { status: 'ready', from, to, days: rows.length, updatedAt: at, accountId: googleAdsReport_1.ADS_ACCOUNT, provenance: 'google_ads_api' }, { merge: true });
    await batch.commit();
    return { refreshed: true, from, to, days: rows.length };
}
exports.scheduledAdvertisingSpend = functions.runWith({ timeoutSeconds: 180 }).pubsub.schedule('every 6 hours').timeZone('Europe/London').onRun(async () => {
    try {
        return await syncGoogleAdsSpend();
    }
    catch {
        await admin.firestore().collection('marketingAdsSync').doc('status').set({ status: 'error', reason: 'Google Ads refresh failed. Check read-only access and Cloud API approval.', attemptedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        functions.logger.error('Google Ads reporting refresh failed; stored snapshots were not replaced.');
        return { refreshed: false };
    }
});
exports.refreshAdvertisingSpend = functions.runWith({ timeoutSeconds: 180 }).https.onCall(async (_data, context) => {
    if (!context.auth || !(0, quoteWorkflow_1.isQuoteAdmin)(String(context.auth.token.email || '')))
        throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    try {
        const result = await syncGoogleAdsSpend();
        if (!result.refreshed)
            throw new functions.https.HttpsError('failed-precondition', result.reason || 'Reporting connection is not ready.');
        return result;
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('unavailable', 'Google Ads refresh failed. Existing report data was kept.');
    }
});
