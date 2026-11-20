import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ADS_ACCOUNT,
  finishedAdsDates,
  normalizeAdsReport,
  normalizeCampaignAdsReport,
  attachCampaignsToDaily,
  aggregateCampaignSpend,
  streamRows,
} from './googleAdsReport';

const metadata = [{ customer: { id: ADS_ACCOUNT, currencyCode: 'GBP', timeZone: 'Europe/London' } }];

test('automatic reports cover finished London days, including summer clock changes', () => {
  const dates = finishedAdsDates(Date.parse('2026-03-30T00:30:00Z'));
  assert.equal(dates.length, 90);
  assert.equal(dates[dates.length - 1], '2026-03-29');
  const summer = finishedAdsDates(Date.parse('2026-07-01T23:30:00Z'));
  assert.equal(summer[summer.length - 1], '2026-07-01');
});

test('only successful account reports can establish zero-activity days', () => {
  const dates = ['2026-11-10', '2026-11-11'];
  const rows = normalizeAdsReport(
    metadata,
    streamRows([{ results: [{ segments: { date: dates[0] }, metrics: { costMicros: '10520000' } }] }]),
    dates,
  );
  assert.equal(rows[0].costMicros, 10520000);
  assert.equal(rows[1].costMicros, 0);
  assert.equal(rows[1].completeDay, true);
  assert.throws(() => streamRows({ error: {} }));
  assert.throws(() => streamRows([{ error: {} }]));
  assert.throws(() =>
    normalizeAdsReport([{ customer: { id: ADS_ACCOUNT, currencyCode: 'USD', timeZone: 'Europe/London' } }], [], dates),
  );
  assert.throws(() => normalizeAdsReport(metadata, [{ segments: { date: dates[0] }, metrics: { costMicros: 'bad' } }], dates));
});

test('campaign spend rejects duplicates and aggregates by campaign within a date filter', () => {
  const dates = ['2026-11-10', '2026-11-11', '2026-11-12'];
  const campaignRows = normalizeCampaignAdsReport(
    streamRows([
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
    ]),
    dates,
  );
  assert.equal(campaignRows.length, 3);
  assert.throws(() =>
    normalizeCampaignAdsReport(
      [
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
      ],
      dates,
    ),
  );

  const account = normalizeAdsReport(
    metadata,
    [
      { segments: { date: '2026-11-10' }, metrics: { costMicros: '8000000' } },
      { segments: { date: '2026-11-11' }, metrics: { costMicros: '2000000' } },
    ],
    dates,
  );
  const daily = attachCampaignsToDaily(account, campaignRows);
  assert.equal(daily[0].campaigns.length, 2);
  assert.equal(daily[1].campaigns.length, 1);
  assert.equal(daily[2].campaigns.length, 0);

  const filtered = aggregateCampaignSpend('2026-11-11', '2026-11-12', daily);
  assert.deepEqual(filtered, [
    { campaignId: '111', campaignName: 'Heathrow Standard', costMicros: 2000000, spendPence: 200 },
  ]);

  const accountTotal = aggregateCampaignSpend('2026-11-10', '2026-11-11', daily).reduce((sum, row) => sum + row.spendPence, 0);
  assert.equal(accountTotal, 1000);
});
