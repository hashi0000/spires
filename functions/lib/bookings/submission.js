"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerSubmission = customerSubmission;
const crypto_1 = require("crypto");
function customerSubmission(uid, data) {
    const id = typeof data.submissionId === 'string' ? data.submissionId.trim() : '';
    if (id && !/^[A-Za-z0-9_-]{16,80}$/.test(id))
        throw new Error('Invalid submission identifier.');
    const payload = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'marketingAttribution').sort(([a], [b]) => a.localeCompare(b)));
    return {
        bookingId: id ? (0, crypto_1.createHash)('sha256').update(`${uid}:${id}`).digest('hex') : undefined,
        fingerprint: (0, crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex'),
    };
}
