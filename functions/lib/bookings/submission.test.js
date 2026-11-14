"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const submission_1 = require("./submission");
(0, node_test_1.test)('portal retries use one user-scoped booking without depending on refreshed tracking', () => {
    const data = { submissionId: '12345678-1234-1234-1234-123456789012', pickup: 'Oxford', marketingAttribution: { consentAt: 1 } };
    node_assert_1.strict.deepEqual((0, submission_1.customerSubmission)('a', data), (0, submission_1.customerSubmission)('a', { ...data, marketingAttribution: { consentAt: 2 } }));
    node_assert_1.strict.notEqual((0, submission_1.customerSubmission)('a', data).bookingId, (0, submission_1.customerSubmission)('b', data).bookingId);
    node_assert_1.strict.notEqual((0, submission_1.customerSubmission)('a', data).fingerprint, (0, submission_1.customerSubmission)('a', { ...data, pickup: 'London' }).fingerprint);
    node_assert_1.strict.throws(() => (0, submission_1.customerSubmission)('a', { submissionId: '../bad' }));
    node_assert_1.strict.equal((0, submission_1.customerSubmission)('a', {}).bookingId, undefined);
});
