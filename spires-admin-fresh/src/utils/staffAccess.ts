/**
 * Full admin (invoices, drivers, vehicles, Spires Share).
 * Keep in sync with firestore.rules `isAdmin()`.
 */
export const ADMIN_EMAILS = [
  "spirestaxis24@gmail.com",
  "hashim@spires.com",
] as const;

/**
 * Office accounts that can use the admin app bookings calendar.
 * Family phones use the PIN page and `isFamilyDevice()` instead.
 * Keep this list in sync with firestore.rules `isStaff()`.
 */
export const FAMILY_STAFF_EMAILS = [...ADMIN_EMAILS] as const;

export function normalizeStaffEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeStaffEmail(email);
  return ADMIN_EMAILS.some((allowed) => allowed === normalized);
}

export function isFamilyStaffEmail(email: string | null | undefined): boolean {
  const normalized = normalizeStaffEmail(email);
  return FAMILY_STAFF_EMAILS.some((allowed) => allowed === normalized);
}
