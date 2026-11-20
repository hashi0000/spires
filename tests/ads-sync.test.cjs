const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9';
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-spires-tracking' });
const db = admin.firestore();
const stored = new Map();
let enabled = true;
db.collection = (name) => ({
  doc: (id) => ({
    path: `${name}/${id}`,
    get: async () => ({
      data: () => ({
        enabled,
        serviceAccountEmail: 'spires-ads-reporting@spires-taxis.iam.gserviceaccount.com',
      }),
    }),
    set: async (row, options) => {
      const path = `${name}/${id}`;
      if (options?.merge && stored.has(path)) {
        stored.set(path, { ...stored.get(path), ...row });
      } else {
        stored.set(path, row);
      }
    },
  }),
});
db.doc = (path) => ({ path });
db.batch = () => {
  const writes = [];
  return {
    set(ref, row) {
      writes.push([ref.path, row]);
    },
    async commit() {
      for (const [path, row] of writes) stored.set(path, row);
    },
  };
};
const { syncGoogleAdsSpend } = require('../functions/lib/marketing/googleAdsSync');

test('automatic spend stores account and campaign rows and keeps old snapshots on failure', async () => {
  const calls = [];
  const fetcher = async (url, request) => {
    calls.push({ url, body: JSON.parse(request.body || '{}'), headers: request.headers });
    if (url.startsWith('https://iamcredentials.googleapis.com/')) {
      return new Response(JSON.stringify({ accessToken: 'fixture-token' }));
    }
    assert.equal(url, 'https://googleads.googleapis.com/v26/customers/7328566496/googleAds:searchStream');
    assert.equal(request.headers['developer-token'], 'fixture-developer-token');
    const body = JSON.parse(request.body);
    assert.ok(body.query.startsWith('SELECT '));
    if (body.query.includes('customer.currency_code')) {
      return new Response(
        JSON.stringify([{ results: [{ customer: { id: '7328566496', currencyCode: 'GBP', timeZone: 'Europe/London' } }] }]),
      );
    }
    if (body.query.includes('campaign.id')) {
      return new Response(
        JSON.stringify([
          {
            results: [
              {
                campaign: { id: '999', name: 'Heathrow 8 Seater' },
                segments: { date: body.query.match(/BETWEEN '(\d{4}-\d{2}-\d{2})'/)[1] },
                metrics: { costMicros: '10000' },
              },
            ],
          },
        ]),
      );
    }
    return new Response(JSON.stringify([]));
  };

  const result = await syncGoogleAdsSpend({
    sourceToken: async () => 'fixture-runtime',
    fetcher,
    developerToken: 'fixture-developer-token',
  });
  assert.equal(result.refreshed, true);
  assert.equal(result.days, 90);
  assert.equal(result.campaigns, 1);
  assert.equal(calls.filter((call) => call.url.includes('googleAds:searchStream')).length, 3);
  assert.equal([...stored.keys()].filter((key) => key.startsWith('marketingAdsDaily/')).length, 90);
  const firstDay = [...stored.entries()].find(([key]) => key.startsWith('marketingAdsDaily/'))[1];
  assert.equal(firstDay.completeDay, true);
  assert.ok(Array.isArray(firstDay.campaigns));
  assert.equal(stored.get('marketingAdsSync/status').status, 'ready');

  // Re-sync overwrites the same date document instead of creating duplicates.
  const beforeCount = [...stored.keys()].filter((key) => key.startsWith('marketingAdsDaily/')).length;
  await syncGoogleAdsSpend({
    sourceToken: async () => 'fixture-runtime',
    fetcher,
    developerToken: 'fixture-developer-token',
  });
  assert.equal([...stored.keys()].filter((key) => key.startsWith('marketingAdsDaily/')).length, beforeCount);

  const dailyBefore = JSON.stringify(
    [...stored.entries()].filter(([key]) => key.startsWith('marketingAdsDaily/')).sort(([a], [b]) => a.localeCompare(b)),
  );
  await assert.rejects(
    syncGoogleAdsSpend({
      sourceToken: async () => 'fixture-runtime',
      fetcher: async () => new Response(null, { status: 503 }),
      developerToken: 'fixture-developer-token',
    }),
    /HTTP 503/,
  );
  const dailyAfter = JSON.stringify(
    [...stored.entries()].filter(([key]) => key.startsWith('marketingAdsDaily/')).sort(([a], [b]) => a.localeCompare(b)),
  );
  assert.equal(dailyAfter, dailyBefore);
  assert.equal(stored.get('marketingAdsSync/status').status, 'error');

  enabled = false;
  const disabled = await syncGoogleAdsSpend({
    sourceToken: async () => {
      throw Error('Must not request a token');
    },
    developerToken: 'fixture-developer-token',
  });
  assert.equal(disabled.refreshed, false);

  enabled = true;
  const missingToken = await syncGoogleAdsSpend({
    sourceToken: async () => {
      throw Error('Must not request a token');
    },
    developerToken: '',
  });
  assert.equal(missingToken.refreshed, false);
  assert.match(missingToken.reason, /SPIRES_GOOGLE_ADS_DEVELOPER_TOKEN/);
  assert.equal(stored.get('marketingAdsSync/status').status, 'error');
});
