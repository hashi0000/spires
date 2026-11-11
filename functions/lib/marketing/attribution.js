"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEASUREMENT_MAX_AGE_MS = exports.SESSION_JOIN_MS = void 0;
exports.cleanCampaignValue = cleanCampaignValue;
exports.cleanLandingPath = cleanLandingPath;
exports.cleanReferrerHost = cleanReferrerHost;
exports.hasCampaignSignal = hasCampaignSignal;
exports.readAttribution = readAttribution;
exports.confirmationPayload = confirmationPayload;
const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid'];
const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'];
const DAY = 86400000;
/** Google joins a Measurement Protocol event to a session only when the request arrives within 24 hours of session start. */
exports.SESSION_JOIN_MS = 24 * 3600000;
/** Measurement Protocol rejects or clamps events older than 72 hours when validation is enforced. */
exports.MEASUREMENT_MAX_AGE_MS = 72 * 3600000;
function clickValue(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_.~-]{1,256}$/.test(value) ? value : undefined;
}
/** Campaign text is allowlisted by characters, then rejected when it still looks like contact data or a URL. */
function cleanCampaignValue(value) {
    if (typeof value !== 'string')
        return undefined;
    const text = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _+.|-]{0,79}$/.test(text))
        return undefined;
    if (/@|\d{6,}|https?:|www\.|[<>]/i.test(text))
        return undefined;
    return text;
}
function cleanLandingPath(value) {
    if (typeof value !== 'string')
        return undefined;
    const path = value.trim();
    if (!/^\/[a-z0-9/_-]{0,120}$/i.test(path))
        return undefined;
    if (path.split('/').some((part) => part.includes('@') || /\d{6,}/.test(part) || (part.length >= 16 && /[a-z]/i.test(part) && /\d/.test(part))))
        return undefined;
    return path;
}
function cleanReferrerHost(value) {
    if (typeof value !== 'string')
        return undefined;
    const host = value.trim().toLowerCase().replace(/\.$/, '');
    if (!/^[a-z0-9.-]{1,253}$/.test(host) || host.includes('@'))
        return undefined;
    if (host === 'spires-taxis.com' || host.endsWith('.spires-taxis.com'))
        return undefined;
    return host;
}
function readTouch(input, now) {
    if (!input || typeof input !== 'object')
        return null;
    const row = input;
    const capturedAt = Number(row.capturedAt);
    if (!Number.isFinite(capturedAt) || capturedAt <= 0 || capturedAt > now + 60000 || capturedAt < now - 30 * DAY)
        return null;
    const touch = { capturedAt };
    for (const key of CLICK_KEYS) {
        const value = clickValue(row[key]);
        if (value && capturedAt + 30 * DAY > now)
            touch[key] = value;
    }
    const aliases = {
        utmSource: 'utm_source', utmMedium: 'utm_medium', utmCampaign: 'utm_campaign', utmContent: 'utm_content', utmTerm: 'utm_term',
    };
    for (const key of UTM_KEYS) {
        const value = cleanCampaignValue(row[key] ?? row[aliases[key]]);
        if (value)
            touch[key] = value;
    }
    const landing = cleanLandingPath(row.landingPath);
    if (landing)
        touch.landingPath = landing;
    const host = cleanReferrerHost(row.referrerHost);
    if (host)
        touch.referrerHost = host;
    return hasCampaignSignal(touch) || touch.landingPath ? touch : null;
}
function hasCampaignSignal(touch) {
    if (!touch)
        return false;
    return CLICK_KEYS.some((key) => Boolean(touch[key])) || UTM_KEYS.some((key) => Boolean(touch[key])) || Boolean(touch.referrerHost);
}
function pickClick(preferred, fallback, key) {
    return preferred?.[key] || fallback?.[key];
}
/** Allowlist only. Never store arbitrary form fields, URLs, names or contact details here. */
function readAttribution(input, now = Date.now()) {
    if (!input || typeof input !== 'object')
        return null;
    const row = input;
    const capturedAt = Number(row.capturedAt), expiresAt = Number(row.expiresAt), consentAt = Number(row.consentAt);
    if (row.consent !== 'granted' || !Number.isFinite(capturedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(consentAt))
        return null;
    if (capturedAt <= 0 || capturedAt > now + 60000 || capturedAt < now - 30 * DAY || expiresAt <= now || expiresAt > capturedAt + 30 * DAY || consentAt > now + 60000 || consentAt < now - DAY)
        return null;
    const clean = { consent: 'granted', capturedAt, expiresAt, consentAt };
    if (/^\d{1,20}\.\d{1,20}$/.test(String(row.clientId || '')))
        clean.clientId = String(row.clientId);
    if (/^\d{1,20}$/.test(String(row.sessionId || '')) && Number(row.sessionCapturedAt) > 0 && Number(row.sessionCapturedAt) <= now + 60000) {
        clean.sessionId = String(row.sessionId);
        clean.sessionCapturedAt = Number(row.sessionCapturedAt);
    }
    const first = readTouch(row.first, now);
    const latestRaw = readTouch(row.latest, now);
    const latest = latestRaw && hasCampaignSignal(latestRaw) ? latestRaw : undefined;
    if (first)
        clean.first = first;
    if (latest)
        clean.latest = latest;
    const clickFrom = latest && CLICK_KEYS.some((key) => latest[key]) ? latest : first;
    for (const key of CLICK_KEYS) {
        const nested = pickClick(clickFrom, first, key);
        const flat = clickValue(row[key]);
        const value = nested || flat;
        if (value)
            clean[key] = value;
    }
    if (!clean.first && (clean.gclid || clean.gbraid || clean.wbraid)) {
        const touch = { capturedAt };
        for (const key of CLICK_KEYS)
            if (clean[key])
                touch[key] = clean[key];
        clean.first = touch;
    }
    return clean.clientId || clean.gclid || clean.gbraid || clean.wbraid || clean.first || clean.latest ? clean : null;
}
function confirmationPayload(bookingId, attribution, at) {
    if (!attribution.clientId || attribution.expiresAt <= at)
        return null;
    const params = { event_id: `booking_confirmed_${bookingId}`, engagement_time_msec: 1, booking_channel: 'online' };
    // Session attributes are only requested inside Google's 24 hour window, and the confirmation time is not moved earlier.
    if (attribution.sessionId && attribution.sessionCapturedAt && at >= attribution.sessionCapturedAt && at - attribution.sessionCapturedAt < exports.SESSION_JOIN_MS) {
        params.session_id = Number(attribution.sessionId);
    }
    return { client_id: attribution.clientId, timestamp_micros: at * 1000, consent: { ad_user_data: 'GRANTED', ad_personalization: 'DENIED' }, events: [{ name: 'booking_confirmed', params }] };
}
