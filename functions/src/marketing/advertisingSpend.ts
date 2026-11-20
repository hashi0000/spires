import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { spendSnapshotTotal, SpendSnapshot } from './spendSnapshot';
import { aggregateCampaignSpend, CampaignCost } from './googleAdsReport';

const ADMIN_EMAILS = ['spirestaxis24@gmail.com', 'hashim@spires.com'];

type SyncStatusPayload = {
  status: string;
  from: string | null;
  to: string | null;
  days: number | null;
  campaignRows: number | null;
  campaigns: number | null;
  updatedAtMs: number | null;
  lastSuccessAtMs: number | null;
  attemptedAtMs: number | null;
  reason: string | null;
  accountId: string | null;
};

function readSyncStatus(data: admin.firestore.DocumentData | undefined): SyncStatusPayload {
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
export const readAdvertisingSpend = functions.https.onCall(async (data, context) => {
  const email = String(context.auth?.token?.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  const from = String(data?.from || '');
  const to = String(data?.to || '');
  const validation = spendSnapshotTotal(from, to, []);
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
  const rows: SpendSnapshot[] = snapshots.docs.map((doc) => {
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
    const campaigns = Array.isArray(row.campaigns) ? (row.campaigns as CampaignCost[]) : [];
    return { date: String(row.date || ''), campaigns };
  });
  const campaigns = aggregateCampaignSpend(from, to, dailyWithCampaigns);
  return {
    ...spendSnapshotTotal(from, to, rows),
    connected: false,
    budgetChanged: false,
    campaigns,
    sync,
  };
});
