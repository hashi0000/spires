import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { readAttribution } from './attribution';
import { measurementWithdrawn } from './consent';

/** Server-owned acquisition evidence. A recorded browser campaign is not proof of an ad-network attribution. */
export const recordCustomerAcquisition = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const attribution = readAttribution(data?.marketingAttribution);
  if (!attribution || await measurementWithdrawn(attribution,context.auth.uid)) return { recorded: false };
  const user = await admin.auth().getUser(context.auth.uid);
  const registeredAt = admin.firestore.Timestamp.fromDate(new Date(user.metadata.creationTime));
  const ref = admin.firestore().collection('customerAcquisitions').doc(context.auth.uid);
  const recorded = await admin.firestore().runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists || await measurementWithdrawn(attribution,context.auth!.uid,tx)) return false;
    tx.create(ref, {
      uid:context.auth!.uid, registeredAt, observedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt:admin.firestore.Timestamp.fromMillis(attribution.expiresAt),
      marketingAttribution: attribution, provenance: 'consented_browser_capture',
    });
    return true;
  });
  return { recorded };
});
