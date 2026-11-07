import { planBulkJobUpdate } from './bulkBookingEdit';

const now = '2026-11-07T12:00:00.000Z';

test('assigns a driver without changing status or fare', () => {
  const plan = planBulkJobUpdate({ status: 'confirmed', driverId: '' }, { driver: 'driver-1' }, now);
  expect(plan).toEqual({
    ok: true,
    patch: { driverId: 'driver-1', allocatedTime: now },
  });
});

test('refuses to confirm a quote that has not been accepted', () => {
  const plan = planBulkJobUpdate(
    { status: 'awaiting_customer_confirmation', quoteIssuedVersion: 2, quoteAcceptedVersion: 1, paymentRequirement: 'advance', amountRequestedPence: 2000, amountReceivedPence: 0 },
    { status: 'confirmed' },
    now
  );
  expect(plan.ok).toBe(false);
});

test('confirms an accepted quote that does not need payment in advance', () => {
  const plan = planBulkJobUpdate(
    { status: 'awaiting_customer_confirmation', quoteIssuedVersion: 2, quoteAcceptedVersion: 2, paymentRequirement: 'later' },
    { status: 'confirmed' },
    now
  );
  expect(plan).toEqual({
    ok: true,
    patch: { status: 'confirmed', adminStatus: 'confirmed', customerStatus: 'confirmed' },
  });
});

test('refuses allocated when no driver is chosen', () => {
  const plan = planBulkJobUpdate({ status: 'confirmed' }, { status: 'allocated', driver: 'clear' }, now);
  expect(plan).toEqual({ ok: false, reason: 'Choose a driver before marking the job allocated.' });
});

test('adds a note after the existing note', () => {
  const plan = planBulkJobUpdate({ status: 'confirmed', notes: 'Gate code 12' }, { note: 'Call on arrival' }, now);
  expect(plan).toEqual({ ok: true, patch: { notes: 'Gate code 12\nCall on arrival' } });
});

test('changes payment status without changing the fare or amount received', () => {
  const plan = planBulkJobUpdate({ status: 'confirmed', paymentStatus: 'pending', amountReceivedPence: 0 }, { payment: 'paid' }, now);
  expect(plan).toEqual({ ok: true, patch: { paymentStatus: 'paid' } });
});

test('clears a driver without touching the fare', () => {
  const plan = planBulkJobUpdate({ status: 'allocated', driverId: 'driver-1' }, { driver: 'clear' }, now);
  expect(plan).toEqual({ ok: true, patch: { driverId: null } });
  expect(JSON.stringify(plan)).not.toContain('actualFare');
});
