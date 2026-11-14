import * as functions from "firebase-functions/v1";
import * as admin from 'firebase-admin';
import { spendSnapshotTotal, SpendSnapshot } from './spendSnapshot';

const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

/**
 * Read only advertising spend check.
 * Reads dated, server-imported reports. This does not call Google Ads or change campaigns or budgets.
 * Customer details are not accepted or returned.
 */
export const readAdvertisingSpend = functions.https.onCall(async (data, context) => {
  const email = String(context.auth?.token?.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  const from=String(data?.from || ''),to=String(data?.to || '');
  const validation=spendSnapshotTotal(from,to,[]);
  if (validation.reason.startsWith('Select')) return {...validation,connected:false,budgetChanged:false};
  const snapshots=await admin.firestore().collection('marketingAdsDaily').where('date','>=',from).where('date','<=',to).get();
  const rows:SpendSnapshot[]=snapshots.docs.map(doc=>{
    const row=doc.data();
    return {date:row.date,accountId:row.accountId,currency:row.currency,costMicros:row.costMicros,retrievedAtMs:row.retrievedAt?.toMillis?.() || 0,provenance:row.provenance,reportingTimezone:row.reportingTimezone,completeDay:row.completeDay};
  });
  return {...spendSnapshotTotal(from,to,rows),connected:false,budgetChanged:false};
});
