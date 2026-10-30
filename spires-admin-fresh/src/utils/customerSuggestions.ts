import { Booking } from '../types/types';

export interface CustomerProfile {
  /** Canonical display name (from the most recent booking). */
  displayName: string;
  phone: string;
  address: string;
  /** Lower case when present. */
  email: string;
  /** Customer app account id when this person has signed in before. */
  uid: string;
}

function bookingTimeMs(b: Booking): number {
  const raw = b.pickupTime || b.dateTime || (b.createdAt ? new Date(b.createdAt).toISOString() : '');
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function bookingName(b: Booking): string {
  const row = b as unknown as Record<string, unknown>;
  return text(b.hirerName) || text(row.name);
}

function bookingPhone(b: Booking): string {
  const row = b as unknown as Record<string, unknown>;
  return text(b.hirerPhone) || text(row.phone);
}

function bookingEmail(b: Booking): string {
  const row = b as unknown as Record<string, unknown>;
  return (text(row.email) || text(row.hirerEmail)).toLowerCase();
}

function bookingUid(b: Booking): string {
  const row = b as unknown as Record<string, unknown>;
  return text(row.uid);
}

export function customerSuggestionLabel(profile: Pick<CustomerProfile, 'displayName' | 'email' | 'phone'>): string {
  if (profile.email) return `${profile.displayName} · ${profile.email}`;
  if (profile.phone) return `${profile.displayName} · ${profile.phone}`;
  return profile.displayName;
}

/** Match a typed name, or a list row that includes the email or phone. */
export function matchCustomerSuggestion(typed: string, profiles: CustomerProfile[]): CustomerProfile | null {
  const value = typed.trim().toLowerCase();
  if (!value) return null;
  const byLabel = profiles.find((profile) => customerSuggestionLabel(profile).toLowerCase() === value);
  if (byLabel) return byLabel;
  const byName = profiles.filter((profile) => profile.displayName.toLowerCase() === value);
  return byName.length === 1 ? byName[0] : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseCustomerEmail(value: string): string {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : '';
}

/**
 * Decide which account a manual job should join.
 * A typed email that matches one account wins. Otherwise keep the account that was picked,
 * or the account already stored on a job being edited.
 */
export function accountLinkForBooking(input: {
  typedEmail: string;
  picked: CustomerProfile | null;
  existingUid?: string;
  existingEmail?: string;
  suggestions: CustomerProfile[];
}): { email: string; uid: string } {
  const email = normaliseCustomerEmail(input.typedEmail);
  const accounts = email
    ? input.suggestions.filter((profile) => profile.uid && profile.email === email)
    : [];
  const accountIds = Array.from(new Set(accounts.map((profile) => profile.uid)));
  if (accountIds.length === 1) return { email, uid: accountIds[0] };

  if (input.picked?.uid && email && (!input.picked.email || input.picked.email === email)) {
    return { email, uid: input.picked.uid };
  }

  const existingUid = text(input.existingUid);
  const existingEmail = normaliseCustomerEmail(text(input.existingEmail));
  if (existingUid) return { email: email || existingEmail, uid: existingUid };
  return { email, uid: '' };
}

/**
 * One profile per customer. Account bookings and later jobs with the same email or phone
 * stay together, so a manual job can be attached to the signed in account.
 */
export function buildCustomerSuggestionsFromBookings(bookings: Booking[]): CustomerProfile[] {
  const sorted = [...bookings].sort((a, b) => bookingTimeMs(b) - bookingTimeMs(a));
  const accounts = new Map<string, { emails: Set<string>; phones: Set<string> }>();

  for (const booking of sorted) {
    const uid = bookingUid(booking);
    if (!uid) continue;
    const bucket = accounts.get(uid) || { emails: new Set<string>(), phones: new Set<string>() };
    const email = bookingEmail(booking);
    const phone = digitsOnly(bookingPhone(booking));
    if (email) bucket.emails.add(email);
    if (phone.length >= 10) bucket.phones.add(phone);
    accounts.set(uid, bucket);
  }

  const keyFor = (booking: Booking): string => {
    const uid = bookingUid(booking);
    if (uid) return `uid:${uid}`;
    const email = bookingEmail(booking);
    if (email) {
      const owners = Array.from(accounts.entries()).filter(([, bucket]) => bucket.emails.has(email));
      if (owners.length === 1) return `uid:${owners[0][0]}`;
      return `email:${email}`;
    }
    const phone = digitsOnly(bookingPhone(booking));
    if (phone.length >= 10) {
      const owners = Array.from(accounts.entries()).filter(([, bucket]) => bucket.phones.has(phone));
      if (owners.length === 1) return `uid:${owners[0][0]}`;
      return `phone:${phone}`;
    }
    const name = bookingName(booking).toLowerCase();
    return name ? `name:${name}` : '';
  };

  const groups = new Map<string, CustomerProfile>();
  for (const booking of sorted) {
    const key = keyFor(booking);
    const name = bookingName(booking);
    if (!key || !name) continue;
    const current = groups.get(key) || {
      displayName: name,
      phone: '',
      address: '',
      email: '',
      uid: '',
    };
    if (!current.displayName) current.displayName = name;
    if (!current.phone) current.phone = bookingPhone(booking);
    if (!current.address) current.address = text(booking.hirerAddress);
    if (!current.email) current.email = bookingEmail(booking);
    if (!current.uid) current.uid = bookingUid(booking);
    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );
}
