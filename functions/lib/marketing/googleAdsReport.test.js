"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const googleAdsReport_1 = require("./googleAdsReport");
const metadata = [{ customer: { id: googleAdsReport_1.ADS_ACCOUNT, currencyCode: 'GBP', timeZone: 'Europe/London' } }];
(0, node_test_1.test)('automatic reports cover finished London days, including summer clock changes', () => {
    const dates = (0, googleAdsReport_1.finishedAdsDates)(Date.parse('2026-03-30T00:30:00Z'));
    node_assert_1.strict.equal(dates.length, 90);
    node_assert_1.strict.equal(dates[dates.length - 1], '2026-03-29');
    const summer = (0, googleAdsReport_1.finishedAdsDates)(Date.parse('2026-07-01T23:30:00Z'));
    node_assert_1.strict.equal(summer[summer.length - 1], '2026-07-01');
});
(0, node_test_1.test)('only successful account reports can establish zero-activity days', () => {
    const dates = ['2026-11-10', '2026-11-11'];
    const rows = (0, googleAdsReport_1.normalizeAdsReport)(metadata, (0, googleAdsReport_1.streamRows)([{ results: [{ segments: { date: dates[0] }, metrics: { costMicros: '10520000' } }] }]), dates);
    node_assert_1.strict.equal(rows[0].costMicros, 10520000);
    node_assert_1.strict.equal(rows[1].costMicros, 0);
    node_assert_1.strict.equal(rows[1].completeDay, true);
    node_assert_1.strict.throws(() => (0, googleAdsReport_1.streamRows)({ error: {} }));
    node_assert_1.strict.throws(() => (0, googleAdsReport_1.streamRows)([{ error: {} }]));
    node_assert_1.strict.throws(() => (0, googleAdsReport_1.normalizeAdsReport)([{ customer: { id: googleAdsReport_1.ADS_ACCOUNT, currencyCode: 'USD', timeZone: 'Europe/London' } }], [], dates));
    node_assert_1.strict.throws(() => (0, googleAdsReport_1.normalizeAdsReport)(metadata, [{ segments: { date: dates[0] }, metrics: { costMicros: 'bad' } }], dates));
});
