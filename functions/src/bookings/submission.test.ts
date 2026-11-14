import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { customerSubmission } from './submission';
test('portal retries use one user-scoped booking without depending on refreshed tracking', () => {
  const data = {submissionId:'12345678-1234-1234-1234-123456789012',pickup:'Oxford',marketingAttribution:{consentAt:1}};
  assert.deepEqual(customerSubmission('a',data),customerSubmission('a',{...data,marketingAttribution:{consentAt:2}}));
  assert.notEqual(customerSubmission('a',data).bookingId,customerSubmission('b',data).bookingId);
  assert.notEqual(customerSubmission('a',data).fingerprint,customerSubmission('a',{...data,pickup:'London'}).fingerprint);
  assert.throws(()=>customerSubmission('a',{submissionId:'../bad'}));
  assert.equal(customerSubmission('a',{}).bookingId,undefined);
});
