"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spendSnapshotTotal = spendSnapshotTotal;
function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return NaN;
    const ms = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
}
/** Missing days, stale data and mixed accounts never become zero spend. */
function spendSnapshotTotal(from, to, rows, now = Date.now()) {
    const start = day(from), end = day(to), days = (end - start) / 86400000 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 93)
        return { available: false, reason: 'Select a valid date range of up to 93 days.' };
    let micros = 0, oldest = now;
    for (let at = start; at <= end; at += 86400000) {
        const date = new Date(at).toISOString().slice(0, 10);
        const matches = rows.filter(row => row.date === date);
        const row = matches[0];
        if (matches.length !== 1 || row.completeDay !== true || row.accountId !== '7328566496' || row.currency !== 'GBP' || row.reportingTimezone !== 'Europe/London' || row.provenance !== 'supermetrics_google_ads' || !Number.isSafeInteger(row.costMicros) || row.costMicros < 0 || !Number.isFinite(row.retrievedAtMs) || row.retrievedAtMs > now || now - row.retrievedAtMs > 48 * 3600000) {
            return { available: false, reason: 'A recent verified Google Ads snapshot is missing for one or more selected days. Spend is unknown.' };
        }
        micros += row.costMicros;
        oldest = Math.min(oldest, row.retrievedAtMs);
    }
    if (!Number.isSafeInteger(micros))
        return { available: false, reason: 'The spend total is outside the supported range.' };
    return { available: true, spendPence: Math.round(micros / 10000), retrievedAtMs: oldest, reason: 'Google Ads snapshot via Supermetrics, in GBP. This is an imported report, not a live server connection. Snapshots expire after 48 hours.' };
}
