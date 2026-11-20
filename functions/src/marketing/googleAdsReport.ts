export const ADS_ACCOUNT = '7328566496';
export const ADS_REPORTER = 'spires-ads-reporting@spires-taxis.iam.gserviceaccount.com';
export const ADS_API_VERSION = 'v26';

export type CampaignCost = {
  campaignId: string;
  campaignName: string;
  costMicros: number;
};

export type DailyAdsSpend = {
  date: string;
  accountId: string;
  currency: 'GBP';
  costMicros: number;
  reportingTimezone: 'Europe/London';
  provenance: 'google_ads_api';
  completeDay: true;
  campaigns: CampaignCost[];
};

/** Finished Europe/London calendar days, excluding today. Oldest → newest. */
export function finishedAdsDates(now = Date.now()): string[] {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (name: string) => parts.find((part) => part.type === name)!.value;
  const today = Date.parse(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`);
  return Array.from({ length: 90 }, (_, i) => new Date(today - (90 - i) * 86400000).toISOString().slice(0, 10));
}

export function streamRows(body: unknown): Array<Record<string, any>> {
  if (!Array.isArray(body)) throw new Error('Invalid Google Ads report response');
  return body.flatMap((batch) => {
    if (
      !batch ||
      typeof batch !== 'object' ||
      batch.error ||
      (batch.results !== undefined && !Array.isArray(batch.results))
    ) {
      throw new Error('Incomplete Google Ads report response');
    }
    return batch.results || [];
  });
}

function parseCostMicros(raw: unknown): number {
  const text = String(raw ?? '');
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('Invalid or duplicate Google Ads daily total');
  }
  return Number(text);
}

/** Account-level daily totals. Successful reports establish explicit zero-activity days. */
export function normalizeAdsReport(
  metadata: Array<Record<string, any>>,
  rows: Array<Record<string, any>>,
  dates: string[],
): Omit<DailyAdsSpend, 'campaigns'>[] {
  if (
    metadata.length !== 1 ||
    String(metadata[0].customer?.id) !== ADS_ACCOUNT ||
    metadata[0].customer?.currencyCode !== 'GBP' ||
    metadata[0].customer?.timeZone !== 'Europe/London'
  ) {
    throw new Error('Google Ads account, currency or timezone does not match');
  }
  const costs = new Map<string, number>();
  for (const row of rows) {
    const date = String(row.segments?.date || '');
    if (!dates.includes(date) || costs.has(date)) {
      throw new Error('Invalid or duplicate Google Ads daily total');
    }
    costs.set(date, parseCostMicros(row.metrics?.costMicros));
  }
  return dates.map((date) => ({
    date,
    accountId: ADS_ACCOUNT,
    currency: 'GBP' as const,
    costMicros: costs.get(date) ?? 0,
    reportingTimezone: 'Europe/London' as const,
    provenance: 'google_ads_api' as const,
    completeDay: true as const,
  }));
}

/**
 * Campaign × date costs from a successful searchStream response.
 * Only rows Google returns are kept; inactive campaigns on a day are absent (not fabricated zeros).
 * Duplicate campaignId+date pairs are rejected.
 */
export function normalizeCampaignAdsReport(rows: Array<Record<string, any>>, dates: string[]): Array<CampaignCost & { date: string }> {
  const seen = new Set<string>();
  const out: Array<CampaignCost & { date: string }> = [];
  for (const row of rows) {
    const date = String(row.segments?.date || '');
    const campaignId = String(row.campaign?.id ?? '').trim();
    const campaignName = String(row.campaign?.name ?? '').trim();
    if (!dates.includes(date) || !/^\d+$/.test(campaignId) || !campaignName) {
      throw new Error('Invalid Google Ads campaign spend row');
    }
    const key = `${campaignId}_${date}`;
    if (seen.has(key)) throw new Error('Duplicate Google Ads campaign spend for the same date');
    seen.add(key);
    out.push({
      date,
      campaignId,
      campaignName,
      costMicros: parseCostMicros(row.metrics?.costMicros),
    });
  }
  return out;
}

/** Attach campaign rows to account days. Account costMicros remains the period total source of truth. */
export function attachCampaignsToDaily(
  accountRows: Omit<DailyAdsSpend, 'campaigns'>[],
  campaignRows: Array<CampaignCost & { date: string }>,
): DailyAdsSpend[] {
  const byDate = new Map<string, CampaignCost[]>();
  for (const row of campaignRows) {
    const list = byDate.get(row.date) || [];
    list.push({
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      costMicros: row.costMicros,
    });
    byDate.set(row.date, list);
  }
  return accountRows.map((row) => {
    const campaigns = (byDate.get(row.date) || [])
      .slice()
      .sort((a, b) => a.campaignId.localeCompare(b.campaignId));
    return { ...row, campaigns };
  });
}

export type CampaignSpendTotal = {
  campaignId: string;
  campaignName: string;
  costMicros: number;
  spendPence: number;
};

/** Sum campaign costs across complete daily snapshots in [from, to]. */
export function aggregateCampaignSpend(
  from: string,
  to: string,
  days: Array<{ date: string; campaigns?: CampaignCost[] | null }>,
): CampaignSpendTotal[] {
  const totals = new Map<string, CampaignSpendTotal>();
  for (const day of days) {
    if (day.date < from || day.date > to) continue;
    for (const campaign of day.campaigns || []) {
      const id = String(campaign.campaignId || '').trim();
      if (!id || !Number.isSafeInteger(campaign.costMicros) || campaign.costMicros < 0) continue;
      const name = String(campaign.campaignName || '').trim() || id;
      const existing = totals.get(id);
      if (existing) {
        existing.costMicros += campaign.costMicros;
        existing.campaignName = name;
        existing.spendPence = Math.round(existing.costMicros / 10000);
      } else {
        totals.set(id, {
          campaignId: id,
          campaignName: name,
          costMicros: campaign.costMicros,
          spendPence: Math.round(campaign.costMicros / 10000),
        });
      }
    }
  }
  return Array.from(totals.values()).sort((a, b) => a.campaignName.localeCompare(b.campaignName));
}
