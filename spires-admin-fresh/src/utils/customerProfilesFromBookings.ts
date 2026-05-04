import { Booking, ExtendedBooking } from '../types/types';

export type CustomerProfileSource = 'app_uid' | 'email' | 'phone' | 'single_booking';

/** One “customer” row built only from existing `bookings` documents in Firestore. */
export interface CustomerProfileFromBookings {
  /** Stable key for React / selection */
  id: string;
  source: CustomerProfileSource;
  displayName: string;
  email: string;
  phone: string;
  /** App user id when present on any booking in the group */
  uid?: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
  bookingCount: number;
  bookings: Booking[];
}

function digitsOnly(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function bookingEmail(b: Booking): string {
  const ext = b as ExtendedBooking;
  const e = (ext.email || ext.hirerEmail || '').trim().toLowerCase();
  return e;
}

/**
 * Group bookings into customer profiles: signed-in app users by `uid`, else by email,
 * else by normalised phone (10+ digits), else a legacy bucket per name+phone.
 */
export function deriveCustomerProfilesFromBookings(bookings: Booking[]): CustomerProfileFromBookings[] {
  const groups = new Map<string, Booking[]>();

  const keyFor = (b: Booking): string => {
    const ext = b as ExtendedBooking;
    if (ext.uid && String(ext.uid).trim()) {
      return `uid:${String(ext.uid).trim()}`;
    }
    const email = bookingEmail(b);
    if (email.includes('@')) {
      return `email:${email}`;
    }
    const ph = digitsOnly(b.hirerPhone);
    if (ph.length >= 10) {
      return `phone:${ph}`;
    }
    return `booking:${b.id}`;
  };

  for (const b of bookings) {
    if (!b.id) continue;
    const k = keyFor(b);
    const arr = groups.get(k) || [];
    arr.push(b);
    groups.set(k, arr);
  }

  const toTime = (b: Booking): number => {
    const c = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
    if (!Number.isNaN(c)) return c;
    const d = b.dateTime ? new Date(b.dateTime).getTime() : NaN;
    if (!Number.isNaN(d)) return d;
    const p = b.pickupTime ? new Date(b.pickupTime).getTime() : 0;
    return p;
  };

  const out: CustomerProfileFromBookings[] = [];

  for (const [id, list] of Array.from(groups.entries())) {
    const sorted = [...list].sort((a, b) => toTime(b) - toTime(a));
    const latest = sorted[0];
    const oldest = sorted[sorted.length - 1];

    const dateOrNull = (b: Booking): Date | null => {
      if (b.createdAt) return new Date(b.createdAt);
      if (b.dateTime) {
        const d = new Date(b.dateTime);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (b.pickupTime) {
        const d = new Date(b.pickupTime);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    let source: CustomerProfileSource = 'single_booking';
    if (id.startsWith('uid:')) source = 'app_uid';
    else if (id.startsWith('email:')) source = 'email';
    else if (id.startsWith('phone:')) source = 'phone';

    const emails = sorted.map(bookingEmail).filter((e) => e.includes('@'));
    const bestEmail = emails[0] || '';

    const phones = sorted.map((b) => digitsOnly(b.hirerPhone)).filter((p) => p.length >= 10);
    const bestPhone = phones[0] || latest.hirerPhone || '';

    const uids = sorted.map((b) => (b as ExtendedBooking).uid).filter(Boolean) as string[];
    const uid = uids[0];

    out.push({
      id,
      source,
      displayName: latest.hirerName || 'Customer',
      email: bestEmail,
      phone: bestPhone,
      uid,
      firstSeen: dateOrNull(oldest),
      lastSeen: dateOrNull(latest),
      bookingCount: sorted.length,
      bookings: sorted,
    });
  }

  out.sort((a, b) => {
    const ta = a.lastSeen?.getTime() ?? 0;
    const tb = b.lastSeen?.getTime() ?? 0;
    return tb - ta;
  });

  return out;
}
