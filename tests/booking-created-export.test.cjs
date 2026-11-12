const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../spires-admin-fresh/src/components/Bookings.tsx'), 'utf8');
const start = source.indexOf('      const created = booking.createdAt');
const end = source.indexOf('      const pickupDate =', start);
assert.ok(start >= 0 && end > start, 'export timestamp block exists');
const creation = new Function('booking', source.slice(start, end) + '\nreturn [bookingCreatedDate, bookingCreatedTime];');
test('export uses request creation rather than a later journey date', () => {
  assert.deepEqual(creation({createdAt: new Date('2026-11-09T12:13:00Z'), dateTime:'2026-11-27T04:00:00Z'}), ['09/11/2026', '12:13']);
});
test('export leaves absent creation timestamps empty', () => {
  assert.deepEqual(creation({dateTime:'2026-11-27T04:00:00Z'}), ['', '']);
});
test('export leaves invalid creation timestamps empty', () => {
  assert.deepEqual(creation({createdAt: new Date('invalid')}), ['', '']);
});
test('export applies British summer time to the request timestamp', () => {
  assert.deepEqual(creation({createdAt:new Date('2026-07-01T23:30:00Z')}), ['02/07/2026', '00:30']);
});
test('export preserves the minute format expected by CSV import', () => {
  assert.match(creation({createdAt:new Date('2026-11-09T12:13:45Z')})[1], /^\d{2}:\d{2}$/);
});
test('customer mapper does not invent a missing creation timestamp', () => {
  const mapper = fs.readFileSync(path.join(__dirname, '../spires-admin-fresh/src/utils/bookingMapper.ts'), 'utf8');
  const expression = mapper.match(/createdAt: customerBooking\.createdAt\?\.toDate[\s\S]*?(?=,\s*updatedAt:)/)[0].replace(/^createdAt: /, '');
  const mapCreated = new Function('customerBooking', 'return ' + expression);
  assert.equal(mapCreated({}), undefined);
  const expected = new Date('2026-11-09T12:13:00Z');
  assert.equal(mapCreated({createdAt: {toDate: () => expected}}), expected);
});
