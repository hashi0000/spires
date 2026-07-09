/** Expiry status for badge, DBS, safeguarding, etc. */
export type ExpiryStatus = 'expired' | 'warning' | 'valid' | 'missing';

const WARNING_DAYS = 30;

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Classify an optional expiry date against "now" (injectable for tests).
 * - missing: no date
 * - expired: date before today (local midnight)
 * - warning: expires within 30 days inclusive
 * - valid: otherwise
 */
export function getExpiryStatus(value: unknown, now: Date = new Date()): ExpiryStatus {
  const expiry = toDate(value);
  if (!expiry) return 'missing';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  if (expDay < today) return 'expired';

  const warnUntil = new Date(today);
  warnUntil.setDate(warnUntil.getDate() + WARNING_DAYS);
  if (expDay <= warnUntil) return 'warning';

  return 'valid';
}

/** DBS expiry is optional when the driver is on the DBS Update Service. */
export function getDbsExpiryStatus(
  dbsExpiry: unknown,
  dbsUpdateService?: boolean,
  now: Date = new Date()
): ExpiryStatus {
  if (dbsUpdateService === true) return 'valid';
  return getExpiryStatus(dbsExpiry, now);
}

export function dbsExpiryStatusLabel(status: ExpiryStatus, dbsUpdateService?: boolean): string {
  if (dbsUpdateService === true) return 'Update Service';
  return expiryStatusLabel(status);
}

export function expiryStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'Expired';
    case 'warning':
      return '≤30d';
    case 'valid':
      return 'OK';
    case 'missing':
      return '—';
    default:
      return '—';
  }
}

export function expiryStatusClass(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'text-red-600 bg-red-50';
    case 'warning':
      return 'text-amber-700 bg-amber-50';
    case 'valid':
      return 'text-green-700 bg-green-50';
    case 'missing':
      return 'text-gray-500 bg-gray-100';
    default:
      return 'text-gray-500 bg-gray-100';
  }
}
