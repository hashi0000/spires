import { Booking } from '../types/types';
import { isCustomerBooking } from './bookingMapper';

/** Firestore patch so admin + customer-app booking shapes stay aligned. */
export function buildBulkContactPatch(
  hirerName: string,
  hirerPhone: string,
  email: string,
  booking: Booking
): Record<string, unknown> {
  const name = hirerName.trim() || booking.hirerName;
  const phone = hirerPhone.trim() || booking.hirerPhone;
  const patch: Record<string, unknown> = {
    hirerName: name,
    hirerPhone: phone,
  };
  const em = email.trim().toLowerCase();
  if (em.includes('@')) {
    patch.email = em;
    patch.hirerEmail = em;
  }
  if (isCustomerBooking(booking)) {
    patch.name = name;
    patch.phone = phone;
  }
  return patch;
}
