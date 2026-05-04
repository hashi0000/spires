import { CustomerProfileFromBookings } from './customerProfilesFromBookings';

export type CustomerSortKey =
  | 'source'
  | 'displayName'
  | 'email'
  | 'phone'
  | 'firstSeen'
  | 'lastSeen'
  | 'bookingCount';

export type CustomerSortDir = 'asc' | 'desc';

/** Newest / largest-first columns default to descending; text columns to ascending. */
export function defaultSortDirForColumn(key: CustomerSortKey): CustomerSortDir {
  if (key === 'lastSeen' || key === 'firstSeen' || key === 'bookingCount') return 'desc';
  return 'asc';
}

/** Order used when sorting by source: app → email → phone → one-off. */
function sourceRank(s: CustomerProfileFromBookings['source']): number {
  switch (s) {
    case 'app_uid':
      return 0;
    case 'email':
      return 1;
    case 'phone':
      return 2;
    default:
      return 3;
  }
}

function cmpNum(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function ts(d: Date | null): number {
  if (!d) return 0;
  const x = d.getTime();
  return Number.isNaN(x) ? 0 : x;
}

export function sortCustomerProfiles(
  list: CustomerProfileFromBookings[],
  key: CustomerSortKey,
  dir: CustomerSortDir
): CustomerProfileFromBookings[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((p, q) => {
    let c = 0;
    switch (key) {
      case 'source':
        c = cmpNum(sourceRank(p.source), sourceRank(q.source));
        if (c === 0) {
          c = sourceLabelSort(p.source).localeCompare(sourceLabelSort(q.source), undefined, { sensitivity: 'base' });
        }
        break;
      case 'displayName':
        c = p.displayName.localeCompare(q.displayName, undefined, { sensitivity: 'base' });
        break;
      case 'email':
        c = (p.email || '').localeCompare(q.email || '', undefined, { sensitivity: 'base' });
        break;
      case 'phone':
        c = (p.phone || '').localeCompare(q.phone || '', undefined, { numeric: true });
        break;
      case 'firstSeen':
        c = cmpNum(ts(p.firstSeen), ts(q.firstSeen));
        break;
      case 'lastSeen':
        c = cmpNum(ts(p.lastSeen), ts(q.lastSeen));
        break;
      case 'bookingCount':
        c = cmpNum(p.bookingCount, q.bookingCount);
        break;
      default:
        c = 0;
    }
    if (c === 0) c = p.id.localeCompare(q.id);
    return c * mul;
  });
}

function sourceLabelSort(s: CustomerProfileFromBookings['source']): string {
  switch (s) {
    case 'app_uid':
      return 'App account';
    case 'email':
      return 'Email';
    case 'phone':
      return 'Phone';
    default:
      return 'One-off';
  }
}
