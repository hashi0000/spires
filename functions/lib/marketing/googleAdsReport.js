"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADS_API_VERSION = exports.ADS_REPORTER = exports.ADS_ACCOUNT = void 0;
exports.finishedAdsDates = finishedAdsDates;
exports.streamRows = streamRows;
exports.normalizeAdsReport = normalizeAdsReport;
exports.ADS_ACCOUNT = '7328566496';
exports.ADS_REPORTER = 'spires-ads-reporting@spires-taxis.iam.gserviceaccount.com';
exports.ADS_API_VERSION = 'v26';
function finishedAdsDates(now = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = (name) => parts.find(part => part.type === name).value;
    const today = Date.parse(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`);
    return Array.from({ length: 90 }, (_, i) => new Date(today - (90 - i) * 86400000).toISOString().slice(0, 10));
}
function streamRows(body) {
    if (!Array.isArray(body))
        throw new Error('Invalid Google Ads report response');
    return body.flatMap(batch => {
        if (!batch || typeof batch !== 'object' || batch.error || (batch.results !== undefined && !Array.isArray(batch.results)))
            throw new Error('Incomplete Google Ads report response');
        return batch.results || [];
    });
}
function normalizeAdsReport(metadata, rows, dates) {
    if (metadata.length !== 1 || String(metadata[0].customer?.id) !== exports.ADS_ACCOUNT || metadata[0].customer?.currencyCode !== 'GBP' || metadata[0].customer?.timeZone !== 'Europe/London')
        throw new Error('Google Ads account, currency or timezone does not match');
    const costs = new Map();
    for (const row of rows) {
        const date = String(row.segments?.date || ''), raw = String(row.metrics?.costMicros ?? '');
        if (!dates.includes(date) || costs.has(date) || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
            throw new Error('Invalid or duplicate Google Ads daily total');
        costs.set(date, Number(raw));
    }
    // Only a fully successful account-level report establishes zero-activity days.
    // A failed, malformed or partial report never reaches this step.
    return dates.map(date => ({ date, accountId: exports.ADS_ACCOUNT, currency: 'GBP', costMicros: costs.get(date) ?? 0, reportingTimezone: 'Europe/London', provenance: 'google_ads_api', completeDay: true }));
}
