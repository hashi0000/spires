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
const DEVELOPER_TOKEN_REQUIREMENT = 'Set Secret Manager secret SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN to the Google Ads API developer token for this manager or account, then redeploy scheduledAdvertisingSpend and refreshAdvertisingSpend with that secret bound. Keep the token on the server only.';
function adsRequestHeaders(token, developerToken, loginCustomerId) {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    if (developerToken)
        headers['developer-token'] = developerToken;
    if (loginCustomerId)
        headers['login-customer-id'] = loginCustomerId;
    return headers;
}
async function commitInChunks(db, writes) {
    const chunkSize = 400;
    for (let i = 0; i < writes.length; i += chunkSize) {
        const batch = db.batch();
        for (const write of writes.slice(i, i + chunkSize)) {
            batch.set(db.doc(write.path), write.data);
        }
        await batch.commit();
    }
}
/**
 * Keyless reporting identity. Google Ads grants it Read-only access; no mutate endpoint exists in this module.
 * Account daily totals stay the source of truth for period spend. Campaign rows are stored on the same daily
 * documents so repeated syncs overwrite rather than duplicate.
 */
async function syncGoogleAdsSpend(deps = {}) {
    const db = admin.firestore();
    const configSnap = await db.collection('marketingConfig').doc('googleAds').get();
    const config = configSnap.data() || {};
    if (config.enabled !== true || config.serviceAccountEmail !== googleAdsReport_1.ADS_REPORTER) {
        return { refreshed: false, reason: 'The read-only reporting connection is not enabled.' };
    }
    const developerToken = String(deps.developerToken ?? process.env.SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN ?? '').trim();
    if (!developerToken) {
        await db.collection('marketingAdsSync').doc('status').set({
            status: 'error',
            reason: DEVELOPER_TOKEN_REQUIREMENT,
            attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            accountId: googleAdsReport_1.ADS_ACCOUNT,
        }, { merge: true });
        return { refreshed: false, reason: DEVELOPER_TOKEN_REQUIREMENT };
    }
    const loginCustomerId = String(config.loginCustomerId || '')
        .replace(/\D/g, '')
        .trim();
    const fetcher = deps.fetcher || fetch;
    const source = await (deps.sourceToken
        ? deps.sourceToken()
        : admin.credential
            .applicationDefault()
            .getAccessToken()
            .then((result) => result.access_token));
    await db.collection('marketingAdsSync').doc('status').set({
        status: 'running',
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        accountId: googleAdsReport_1.ADS_ACCOUNT,
    }, { merge: true });
    try {
        const minted = await fetcher(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${googleAdsReport_1.ADS_REPORTER}:generateAccessToken`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${source}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/adwords'], lifetime: '1800s' }),
            signal: AbortSignal.timeout(15000),
        });
        if (!minted.ok)
            throw new Error(`Reporting identity returned HTTP ${minted.status}`);
        const token = (await minted.json()).accessToken;
        if (!token)
            throw new Error('Reporting identity could not obtain an access token');
        const query = async (statement) => {
            const response = await fetcher(`https://googleads.googleapis.com/${googleAdsReport_1.ADS_API_VERSION}/customers/${googleAdsReport_1.ADS_ACCOUNT}/googleAds:searchStream`, {
                method: 'POST',
                headers: adsRequestHeaders(token, developerToken, loginCustomerId),
                body: JSON.stringify({ query: statement }),
                signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`Google Ads reporting returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`);
            }
            return (0, googleAdsReport_1.streamRows)(await response.json());
        };
        const dates = (0, googleAdsReport_1.finishedAdsDates)();
        const from = dates[0];
        const to = dates[dates.length - 1];
        const metadata = await query('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer');
        const accountReport = await query(`SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}' ORDER BY segments.date`);
        const campaignReport = await query(`SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' ORDER BY segments.date, campaign.id`);
        const accountRows = (0, googleAdsReport_1.normalizeAdsReport)(metadata, accountReport, dates);
        const campaignRows = (0, googleAdsReport_1.normalizeCampaignAdsReport)(campaignReport, dates);
        const rows = (0, googleAdsReport_1.attachCampaignsToDaily)(accountRows, campaignRows);
        const at = admin.firestore.FieldValue.serverTimestamp();
        const campaignCount = new Set(campaignRows.map((row) => row.campaignId)).size;
        const writes = rows.map((row) => ({
            path: `marketingAdsDaily/${googleAdsReport_1.ADS_ACCOUNT}_${row.date}`,
            data: { ...row, retrievedAt: at, apiVersion: googleAdsReport_1.ADS_API_VERSION },
        }));
        writes.push({
            path: 'marketingAdsSync/status',
            data: {
                status: 'ready',
                from,
                to,
                days: rows.length,
                campaignRows: campaignRows.length,
                campaigns: campaignCount,
                updatedAt: at,
                lastSuccessAt: at,
                attemptedAt: at,
                reason: '',
                accountId: googleAdsReport_1.ADS_ACCOUNT,
                provenance: 'google_ads_api',
                apiVersion: googleAdsReport_1.ADS_API_VERSION,
            },
        });
        await commitInChunks(db, writes);
        return {
            refreshed: true,
            from,
            to,
            days: rows.length,
            campaignRows: campaignRows.length,
            campaigns: campaignCount,
        };
    }
    catch (error) {
        await recordSyncFailure('Google Ads refresh failed. Existing report data was kept. Check read-only access, Cloud API approval, and the developer token secret.');
        throw error;
    }
}
async function recordSyncFailure(reason) {
    await admin.firestore().collection('marketingAdsSync').doc('status').set({
        status: 'error',
        reason,
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        accountId: googleAdsReport_1.ADS_ACCOUNT,
    }, { merge: true });
}
/**
 * Bind SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN after the secret exists:
 *   firebase functions:secrets:set SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN --project spires-taxis
 * then redeploy these two functions with secrets: ['SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN'] in runWith.
 * Until then the sync records a clear error and leaves existing snapshots unchanged.
 */
exports.scheduledAdvertisingSpend = functions
    .runWith({ timeoutSeconds: 180 })
    .pubsub.schedule('every 6 hours')
    .timeZone('Europe/London')
    .onRun(async () => {
    try {
        return await syncGoogleAdsSpend();
    }
    catch (error) {
        await recordSyncFailure('Google Ads refresh failed. Check read-only access, Cloud API approval, and the developer token secret.');
        functions.logger.error('Google Ads reporting refresh failed; stored snapshots were not replaced.', error);
        return { refreshed: false };
    }
});
exports.refreshAdvertisingSpend = functions.runWith({ timeoutSeconds: 180 }).https.onCall(async (_data, context) => {
    if (!context.auth || !(0, quoteWorkflow_1.isQuoteAdmin)(String(context.auth.token.email || ''))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }
    try {
        const result = await syncGoogleAdsSpend();
        if (!result.refreshed) {
            throw new functions.https.HttpsError('failed-precondition', result.reason || 'Reporting connection is not ready.');
        }
        return result;
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        await recordSyncFailure('Google Ads refresh failed. Existing report data was kept. Check read-only access, Cloud API approval, and the developer token secret.');
        throw new functions.https.HttpsError('unavailable', 'Google Ads refresh failed. Existing report data was kept.');
    }
});
