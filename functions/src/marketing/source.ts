import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { isQuoteAdmin } from '../quotes/quoteWorkflow';

/** Staff reports stay separate from observed browser attribution and retain an append-only application history. */
export const recordBookingSource = functions.https.onCall(async (data, context) => {
  const actor = String(context.auth?.token.email || '').trim().toLowerCase();
  if (!context.auth || !isQuoteAdmin(actor)) throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  const id = String(data?.bookingId || '');
  const source = String(data?.source || '');
  const channel = String(data?.channel || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !['','google_ads','website','repeat','recommendation','other'].includes(source) || !['telephone','whatsapp'].includes(channel)) {
    throw new functions.https.HttpsError('invalid-argument', 'Choose a supported booking, source and channel.');
  }
  const db = admin.firestore();
  const bookingRef = db.collection('bookings').doc(id);
  const noteRef = db.collection('bookingMeasurementNotes').doc(id);
  const auditRef = db.collection('bookingSourceAudit').doc();
  await db.runTransaction(async tx => {
    const [booking, note] = await Promise.all([tx.get(bookingRef), tx.get(noteRef)]);
    if (!booking.exists) throw new functions.https.HttpsError('not-found', 'Booking not found.');
    const patch = { staffReportedSource:source, enquiryChannel:channel, provenance:'staff_recorded', updatedBy:actor, updatedAt:admin.firestore.FieldValue.serverTimestamp() };
    tx.set(noteRef,patch,{merge:true});
    tx.create(auditRef,{bookingId:id,previousSource:note.data()?.staffReportedSource || '',previousChannel:note.data()?.enquiryChannel || '',...patch});
  });
  return { saved:true };
});
