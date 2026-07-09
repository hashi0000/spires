import type { Driver, DriverDocuments } from '../types/types';

function timestampLikeToDateString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    const d = (v as { toDate: () => Date }).toDate();
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const slice = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
  }
  return '';
}

function normalizeDocuments(raw: unknown): DriverDocuments | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const out: DriverDocuments = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 0) {
      out[key] = val;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Map Firestore driver snapshot into app `Driver` (safe optional chaining on nested maps). */
export function normalizeDriverFromFirestore(id: string, raw: Record<string, unknown>): Driver {
  const licensing = raw?.licensing as Record<string, unknown> | undefined;
  const compliance = raw?.compliance as Record<string, unknown> | undefined;

  const createdAt =
    raw?.createdAt != null && typeof raw.createdAt === 'object' && 'toDate' in (raw.createdAt as object)
      ? (raw.createdAt as { toDate: () => Date }).toDate()
      : new Date();

  const updatedAt =
    raw?.updatedAt != null && typeof raw.updatedAt === 'object' && 'toDate' in (raw.updatedAt as object)
      ? (raw.updatedAt as { toDate: () => Date }).toDate()
      : undefined;

  return {
    id,
    name: String(raw?.name ?? ''),
    licenseNumber: String(raw?.licenseNumber ?? ''),
    phoneNumber: String(raw?.phoneNumber ?? ''),
    email: String(raw?.email ?? ''),
    active: Boolean(raw?.active),
    licenseExpiry: raw?.licenseExpiry != null ? String(raw.licenseExpiry) : '',
    address: raw?.address != null ? String(raw.address) : '',
    notes: raw?.notes != null ? String(raw.notes) : '',
    createdAt,
    updatedAt,
    isSchoolApproved: raw?.isSchoolApproved === true,
    licensing:
      licensing && typeof licensing === 'object'
        ? {
            badgeNumber: licensing.badgeNumber != null ? String(licensing.badgeNumber) : undefined,
            badgeExpiry: timestampLikeToDateString(licensing.badgeExpiry),
          }
        : undefined,
    compliance:
      compliance && typeof compliance === 'object'
        ? {
            dbsExpiry: timestampLikeToDateString(compliance.dbsExpiry),
            safeguardingExpiry: timestampLikeToDateString(compliance.safeguardingExpiry),
            dbsUpdateService: compliance.dbsUpdateService === true,
          }
        : undefined,
    documents: normalizeDocuments(raw?.documents),
  };
}
