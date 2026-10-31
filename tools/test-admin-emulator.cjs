/** Run only against a local Firestore emulator. Never contacts SMTP or Shift4. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
if (!/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Set FIRESTORE_EMULATOR_HOST to a localhost emulator. Production runs are refused.');
}
const projectId = 'demo-spires-admin';
process.env.GCLOUD_PROJECT = projectId;
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId });
admin.firestore().settings({ ignoreUndefinedProperties: true });
const flow = require('../functions/lib/quotes/callables');
const db = admin.firestore();
const staff = { auth: { uid: 'test-staff', token: { email: 'spirestaxis24@gmail.com' } } };
const customer = { auth: { uid: 'test-customer', token: {} } };
const runId = randomUUID();
const ids = [];
const call = (name, body, context = staff) => flow[name].run(body, context);
async function seed(label) {
  const id = `test-${runId}-${label}`;
  ids.push(id);
  await db.collection('bookings').doc(id).set({
    bookingNumber: id, hirerName: 'Emulator Test', hirerEmail: 'customer@example.invalid',
    hirerPhone: '07000000000', pickupLocation: 'Oxford', pickup: 'Oxford', destination: 'Test destination',
    pickupTime: '2027-01-10T16:30:00Z', dateTime: '2027-01-10T16:30:00Z',
    status: 'pending', paymentStatus: 'pending', source: 'admin', uid: 'test-customer',
    flightNumber: 'TEST123', airportCollection: true,
  });
  return id;
}
const quote = (bookingId, extra = {}) => call('issueQuote', {
  bookingId, normalFarePounds: '42.50', vehicleType: 'standard', bookingType: 'one_way',
  pickup: 'Oxford', destination: 'Test destination', dateTime: '2027-01-10T16:30:00Z',
  paymentRequirement: 'advance', paymentDescription: 'deposit', amountRequestedPounds: '12.50',
  paymentLinkUrl: 'https://pay.shift4.com/link_emulator_placeholder', ...extra,
});
const row = async id => (await db.collection('bookings').doc(id).get()).data();
async function check(label, fn) { await fn(); console.log(`PASS ${label}`); }
(async () => {
  await check('deposit before customer acceptance confirms with £30 remaining', async () => {
    const id = await seed('payment-first');
    const issued = await quote(id);
    assert.equal(issued.emailState, 'queued');
    await call('recordManualPayment', { bookingId: id, amountReceivedPounds: '12.50', method: 'card' });
    assert.equal((await row(id)).status, 'awaiting_customer_confirmation');
    await call('acceptQuote', { bookingId: id }, customer);
    const result = await row(id);
    assert.equal(result.status, 'confirmed');
    assert.equal(result.paymentStatus, 'partial');
    assert.equal(result.outstandingPence, 3000);
    assert.equal(result.depositStatus, 'paid');
    assert.equal(result.paidAt, undefined);
    assert.equal(result.flightNumber, 'TEST123');
    assert.equal(result.airportCollection, true);
  });
  await check('acceptance before deposit waits, then confirms without duplicating money', async () => {
    const id = await seed('accept-first');
    await quote(id);
    await call('recordManualAcceptance', { bookingId: id });
    assert.equal((await row(id)).quoteAcceptanceSubstatus, 'awaiting_payment');
    await call('recordManualPayment', { bookingId: id, amountReceivedPounds: '5', method: 'card' });
    assert.equal((await row(id)).status, 'awaiting_customer_confirmation');
    await call('recordManualPayment', { bookingId: id, amountReceivedPounds: '12.50', method: 'card' });
    await call('recordManualPayment', { bookingId: id, amountReceivedPounds: '12.50', method: 'card' });
    assert.equal((await row(id)).amountReceivedPence, 1250);
    assert.equal((await row(id)).status, 'confirmed');
    const entries = await db.collection('bookings').doc(id).collection('audit').where('action', '==', 'payment_recorded').get();
    assert.equal(entries.size, 2); // £5 and corrected cumulative £12.50; the repeat is a no-op.
    await call('recordManualPayment', { bookingId: id, amountReceivedPounds: '42.50', method: 'cash' });
    assert.equal((await row(id)).paymentStatus, 'paid');
    assert.equal((await row(id)).outstandingPence, 0);
    assert.ok((await row(id)).paidAt);
  });
  await check('pay later acceptance confirms without falsely marking paid', async () => {
    const id = await seed('pay-later');
    await quote(id, { paymentRequirement: 'later', paymentDescription: 'full', paymentLinkUrl: '' });
    await call('acceptQuote', { bookingId: id }, customer);
    assert.equal((await row(id)).status, 'confirmed');
    assert.equal((await row(id)).paymentStatus, 'pending');
  });
  await check('reissued quotes reject the old public token', async () => {
    const id = await seed('reissue');
    await quote(id);
    const jobs = await db.collection('emailJobs').where('bookingId', '==', id).get();
    const html = jobs.docs.find(doc => doc.data().kind === 'quote').data().html;
    const token = html.match(/quote\?t=([^"&<]+)/)?.[1];
    assert.ok(token);
    await quote(id, { reissue: true, normalFarePounds: '50.00' });
    await assert.rejects(call('acceptQuote', { token }, {}), /replaced/);
    assert.equal((await row(id)).quoteIssuedVersion, 2);
  });
  await check('unauthorised acceptance and invalid deposits are rejected', async () => {
    const id = await seed('invalid');
    await assert.rejects(quote(id, { amountRequestedPounds: '50.00' }), /no more than/);
    await quote(id);
    await assert.rejects(call('acceptQuote', { bookingId: id }, { auth: { uid: 'other-user', token: {} } }), /cannot accept/);
  });
  await check('late email can enqueue one confirmation and duplicate enqueue is harmless', async () => {
    const id = await seed('late-email');
    await db.collection('bookings').doc(id).update({ status: 'confirmed', hirerEmail: admin.firestore.FieldValue.delete() });
    const before = await row(id);
    await db.collection('bookings').doc(id).update({ hirerEmail: 'customer@example.invalid' });
    const after = await row(id);
    await Promise.all([flow.enqueueConfirmationIfNeeded(before, after, id), flow.enqueueConfirmationIfNeeded(before, after, id)]);
    const jobs = await db.collection('emailJobs').where('bookingId', '==', id).get();
    assert.equal(jobs.size, 1);
    assert.equal(jobs.docs[0].data().status, 'queued');
  });
  await check('retry targets failed messages for this booking only', async () => {
    const id = ids[0];
    const jobs = await db.collection('emailJobs').where('bookingId', '==', id).get();
    await jobs.docs[0].ref.update({ status: 'failed' });
    const result = await call('retryEmailJob', { bookingId: id });
    assert.equal(result.retried, 1);
    assert.equal((await jobs.docs[0].ref.get()).data().status, 'queued');
  });
  console.log('7 emulator scenarios passed. No emails sent and no payment provider contacted.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.terminate();
  await admin.app().delete();
});
