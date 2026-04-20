import { Booking } from '../types/types';

export interface CustomerProfile {
  /** Canonical display name (from most recent booking). */
  displayName: string;
  phone: string;
  address: string;
}

function bookingTimeMs(b: Booking): number {
  const raw = b.pickupTime || b.dateTime || (b.createdAt ? new Date(b.createdAt).toISOString() : '');
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * One profile per distinct customer name (case-insensitive), using the most recent booking for phone/address.
 * Includes mapped customer-app fields (name, phone).
 */
export function buildCustomerSuggestionsFromBookings(bookings: Booking[]): CustomerProfile[] {
  const sorted = [...bookings].sort((a, b) => bookingTimeMs(b) - bookingTimeMs(a));
  const seen = new Set<string>();
  const out: CustomerProfile[] = [];

  for (const b of sorted) {
    const row = b as unknown as Record<string, unknown>;
    const nameRaw =
      (typeof b.hirerName === 'string' && b.hirerName.trim()) ||
      (typeof row.name === 'string' && row.name.trim()) ||
      '';
    if (!nameRaw) continue;

    const key = nameRaw.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const phone =
      (typeof b.hirerPhone === 'string' && b.hirerPhone.trim()) ||
      (typeof row.phone === 'string' && row.phone.trim()) ||
      '';
    const address = typeof b.hirerAddress === 'string' ? b.hirerAddress.trim() : '';

    out.push({
      displayName: nameRaw,
      phone,
      address
    });
  }

  out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  return out;
}
