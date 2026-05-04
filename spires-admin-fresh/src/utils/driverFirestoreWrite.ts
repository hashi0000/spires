import { Timestamp, updateDoc, deleteField, doc, type UpdateData } from 'firebase/firestore';
import { db } from './firebase';
import type { Driver } from '../types/types';

function dateInputToTimestampOrDelete(isoDate: string | undefined | null): Timestamp | ReturnType<typeof deleteField> {
  const s = isoDate?.trim();
  if (!s) return deleteField();
  const d = new Date(s + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return deleteField();
  return Timestamp.fromDate(d);
}

function optionalDateStringToTimestamp(isoDate: string | undefined | null): Timestamp | undefined {
  const s = isoDate?.trim();
  if (!s) return undefined;
  const d = new Date(s + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return undefined;
  return Timestamp.fromDate(d);
}

/**
 * Build a shallow Firestore update map with dotted paths so nested maps merge safely
 * and optional expiries can be removed with deleteField().
 */
export function buildDriverComplianceUpdate(partial: Partial<Driver>): Record<string, unknown> {
  const u: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (partial.name !== undefined) u.name = partial.name;
  if (partial.licenseNumber !== undefined) u.licenseNumber = partial.licenseNumber;
  if (partial.phoneNumber !== undefined) u.phoneNumber = partial.phoneNumber;
  if (partial.email !== undefined) u.email = partial.email;
  if (partial.active !== undefined) u.active = partial.active;
  if (partial.licenseExpiry !== undefined) u.licenseExpiry = partial.licenseExpiry;
  if (partial.address !== undefined) u.address = partial.address;
  if (partial.notes !== undefined) u.notes = partial.notes;
  if (partial.isSchoolApproved !== undefined) u.isSchoolApproved = partial.isSchoolApproved;

  const lic = partial.licensing;
  if (lic) {
    if (lic.badgeNumber !== undefined) {
      u['licensing.badgeNumber'] = lic.badgeNumber?.trim() ?? '';
    }
    if (lic.badgeExpiry !== undefined) {
      u['licensing.badgeExpiry'] = dateInputToTimestampOrDelete(
        typeof lic.badgeExpiry === 'string' ? lic.badgeExpiry : undefined
      );
    }
  }

  const comp = partial.compliance;
  if (comp) {
    if (comp.dbsExpiry !== undefined) {
      u['compliance.dbsExpiry'] = dateInputToTimestampOrDelete(
        typeof comp.dbsExpiry === 'string' ? comp.dbsExpiry : undefined
      );
    }
    if (comp.safeguardingExpiry !== undefined) {
      u['compliance.safeguardingExpiry'] = dateInputToTimestampOrDelete(
        typeof comp.safeguardingExpiry === 'string' ? comp.safeguardingExpiry : undefined
      );
    }
  }

  return u;
}

export async function applyDriverComplianceUpdate(driverId: string, partial: Partial<Driver>): Promise<void> {
  const payload = buildDriverComplianceUpdate(partial);
  await updateDoc(doc(db, 'drivers', driverId), payload as UpdateData<Record<string, unknown>>);
}

/** First-time driver document: nested timestamps, no deleteField. */
export function newDriverFirestorePayload(driver: Omit<Driver, 'id' | 'createdAt'>): Record<string, unknown> {
  const licensingClean: Record<string, unknown> | undefined = (() => {
    const bn = driver.licensing?.badgeNumber?.trim();
    const be = optionalDateStringToTimestamp(driver.licensing?.badgeExpiry);
    if ((!bn || bn === '') && !be) return undefined;
    return {
      ...(bn ? { badgeNumber: bn } : {}),
      ...(be ? { badgeExpiry: be } : {}),
    };
  })();

  const complianceClean: Record<string, unknown> | undefined = (() => {
    const dbs = optionalDateStringToTimestamp(driver.compliance?.dbsExpiry);
    const sg = optionalDateStringToTimestamp(driver.compliance?.safeguardingExpiry);
    if (!dbs && !sg) return undefined;
    return {
      ...(dbs ? { dbsExpiry: dbs } : {}),
      ...(sg ? { safeguardingExpiry: sg } : {}),
    };
  })();

  const payload: Record<string, unknown> = {
    name: driver.name,
    licenseNumber: driver.licenseNumber,
    phoneNumber: driver.phoneNumber,
    email: driver.email,
    active: driver.active,
    licenseExpiry: driver.licenseExpiry,
    address: driver.address ?? '',
    notes: driver.notes ?? '',
    isSchoolApproved: driver.isSchoolApproved ?? false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (licensingClean && Object.keys(licensingClean).length > 0) {
    payload.licensing = licensingClean;
  }
  if (complianceClean && Object.keys(complianceClean).length > 0) {
    payload.compliance = complianceClean;
  }

  return payload;
}
