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
(0, node_test_1.test)('campaign spend rejects duplicates and aggregates by campaign within a date filter', () => {
    const dates = ['2026-11-10', '2026-11-11', '2026-11-12'];
    const campaignRows = (0, googleAdsReport_1.normalizeCampaignAdsReport)((0, googleAdsReport_1.streamRows)([
        {
            results: [
                {
                    campaign: { id: '111', name: 'Heathrow Standard' },
                    segments: { date: '2026-11-10' },
                    metrics: { costMicros: '5000000' },
                },
                {
                    campaign: { id: '222', name: 'Heathrow 8 Seater' },
                    segments: { date: '2026-11-10' },
                    metrics: { costMicros: '3000000' },
                },
                {
                    campaign: { id: '111', name: 'Heathrow Standard' },
                    segments: { date: '2026-11-11' },
                    metrics: { costMicros: '2000000' },
                },
            ],
        },
    ]), dates);
    node_assert_1.strict.equal(campaignRows.length, 3);
    node_assert_1.strict.throws(() => (0, googleAdsReport_1.normalizeCampaignAdsReport)([
        {
            campaign: { id: '111', name: 'Heathrow Standard' },
            segments: { date: '2026-11-10' },
            metrics: { costMicros: '1' },
        },
        {
            campaign: { id: '111', name: 'Heathrow Standard' },
            segments: { date: '2026-11-10' },
            metrics: { costMicros: '2' },
        },
    ], dates));
    const account = (0, googleAdsReport_1.normalizeAdsReport)(metadata, [
        { segments: { date: '2026-11-10' }, metrics: { costMicros: '8000000' } },
        { segments: { date: '2026-11-11' }, metrics: { costMicros: '2000000' } },
    ], dates);
    const daily = (0, googleAdsReport_1.attachCampaignsToDaily)(account, campaignRows);
    node_assert_1.strict.equal(daily[0].campaigns.length, 2);
    node_assert_1.strict.equal(daily[1].campaigns.length, 1);
    node_assert_1.strict.equal(daily[2].campaigns.length, 0);
    const filtered = (0, googleAdsReport_1.aggregateCampaignSpend)('2026-11-11', '2026-11-12', daily);
    node_assert_1.strict.deepEqual(filtered, [
        { campaignId: '111', campaignName: 'Heathrow Standard', costMicros: 2000000, spendPence: 200 },
    ]);
    const accountTotal = (0, googleAdsReport_1.aggregateCampaignSpend)('2026-11-10', '2026-11-11', daily).reduce((sum, row) => sum + row.spendPence, 0);
    node_assert_1.strict.equal(accountTotal, 1000);
});
