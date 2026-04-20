import { Booking } from '../types/types';
import type { ExtendedBooking } from '../types/types';

function toDateTimeLocalInput(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

/**
 * Draft for a new booking: return leg (destination→pickup swapped).
 * Default return pickup = same clock time, next calendar day (editable in modal).
 */
export function buildReturnTripDraft(source: Booking): Partial<ExtendedBooking> {
  const row = source as unknown as Record<string, unknown>;
  const hirerName =
    (typeof source.hirerName === 'string' && source.hirerName.trim()) ||
    (typeof row.name === 'string' && row.name.trim()) ||
    '';
  const hirerPhone =
    (typeof source.hirerPhone === 'string' && source.hirerPhone.trim()) ||
    (typeof row.phone === 'string' && row.phone.trim()) ||
    '';
  const pickupLoc =
    (typeof source.pickupLocation === 'string' && source.pickupLocation.trim()) ||
    (typeof row.pickup === 'string' && row.pickup.trim()) ||
    '';
  const dest = typeof source.destination === 'string' ? source.destination.trim() : '';

  const origPickup = new Date(source.pickupTime || source.dateTime || Date.now());
  const returnPickup = new Date(origPickup);
  returnPickup.setDate(returnPickup.getDate() + 1);

  const bookedAt = new Date();

  const notesLine = source.bookingNumber
    ? `Return for booking ${source.bookingNumber}`
    : 'Return trip';

  return {
    hirerName,
    hirerPhone,
    hirerAddress: (typeof source.hirerAddress === 'string' ? source.hirerAddress : '') || '',
    pickupLocation: dest,
    destination: pickupLoc,
    pickupTime: toDateTimeLocalInput(returnPickup),
    dateTime: toDateTimeLocalInput(bookedAt),
    bookingMethod: source.bookingMethod || 'telephone',
    driverId: source.driverId || '',
    vehicleId: source.vehicleId || '',
    subContract: source.subContract || '',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    notes: notesLine,
    actualFare: '',
    expenses: []
  };
}
