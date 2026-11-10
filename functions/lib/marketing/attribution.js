"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAttribution = readAttribution;
exports.confirmationPayload = confirmationPayload;
/** Allowlist only. Never store arbitrary form fields, URLs, names or contact details here. */
function readAttribution(input, now = Date.now()) {
    if (!input || typeof input !== 'object')
        return null;
    const row = input;
    const capturedAt = Number(row.capturedAt), expiresAt = Number(row.expiresAt), consentAt = Number(row.consentAt);
    if (row.consent !== 'granted' || !Number.isFinite(capturedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(consentAt))
        return null;
    if (capturedAt <= 0 || capturedAt > now + 60000 || capturedAt < now - 30 * 86400000 || expiresAt <= now || expiresAt > capturedAt + 30 * 86400000 || consentAt > now + 60000 || consentAt < now - 86400000)
        return null;
    const clean = { consent: 'granted', capturedAt, expiresAt, consentAt };
    if (/^\d{1,20}\.\d{1,20}$/.test(String(row.clientId || '')))
        clean.clientId = String(row.clientId);
    if (/^\d{1,20}$/.test(String(row.sessionId || '')) && Number(row.sessionCapturedAt) > 0 && Number(row.sessionCapturedAt) <= now + 60000) {
        clean.sessionId = String(row.sessionId);
        clean.sessionCapturedAt = Number(row.sessionCapturedAt);
    }
    for (const k of ['gclid', 'gbraid', 'wbraid']) {
        if (typeof row[k] === 'string' && /^[A-Za-z0-9_.~-]{1,256}$/.test(row[k]))
            clean[k] = row[k];
    }
    return clean.clientId || clean.gclid || clean.gbraid || clean.wbraid ? clean : null;
}
function confirmationPayload(bookingId, attribution, at) {
    if (!attribution.clientId || attribution.expiresAt <= at)
        return null;
    const params = { event_id: `booking_confirmed_${bookingId}`, engagement_time_msec: 1, booking_channel: 'online' };
    // Session attribution is only attempted inside Google's 24-hour join window.
    if (attribution.sessionId && attribution.sessionCapturedAt && at - attribution.sessionCapturedAt < 24 * 3600000)
        params.session_id = attribution.sessionId;
    return { client_id: attribution.clientId, timestamp_micros: at * 1000, consent: { ad_user_data: 'GRANTED', ad_personalization: 'DENIED' }, events: [{ name: 'booking_confirmed', params }] };
}
