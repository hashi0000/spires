import { Booking } from '../types/types';
import { journeyLegs, legStatusLabel, type JourneyLeg } from './journeyLegs';

const ACTIVE_STATUSES: Booking['status'][] = ['pending', 'awaiting_customer_confirmation', 'confirmed', 'allocated'];

export interface UpcomingReminder {
  booking: Booking;
  pickupAt: Date;
  leg: JourneyLeg['leg'];
  label: JourneyLeg['label'];
  pickupLocation: string;
  destination: string;
  driverId: string;
  needsReview: boolean;
  statusLabel: string;
  showLabel: boolean;
}

export function getBookingPickupDate(booking: Booking): Date | null {
  const raw = (booking.pickupTime || booking.dateTime || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isActiveBookingStatus(status: Booking['status']): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function toReminder(booking: Booking, leg: JourneyLeg): UpcomingReminder {
  return {
    booking,
    pickupAt: leg.pickupAt as Date,
    leg: leg.leg,
    label: leg.label,
    pickupLocation: leg.pickupLocation,
    destination: leg.destination,
    driverId: leg.driverId,
    needsReview: leg.needsReview,
    statusLabel: legStatusLabel(leg),
    showLabel: leg.leg === 'return' || journeyLegs(booking).length > 1,
  };
}

export function getUpcomingBookings(
  bookings: Booking[],
  now: Date,
  options: { withinMs: number; maxItems?: number }
): UpcomingReminder[] {
  const end = now.getTime() + options.withinMs;
  const items: UpcomingReminder[] = [];

  for (const booking of bookings) {
    for (const leg of journeyLegs(booking, now)) {
      if (leg.status === 'completed' || leg.status === 'cancelled' || !leg.pickupAt) continue;
      const t = leg.pickupAt.getTime();
      if (t <= now.getTime() || t > end) continue;
      items.push(toReminder(booking, leg));
    }
  }

  items.sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());
  if (options.maxItems != null) {
    return items.slice(0, options.maxItems);
  }
  return items;
}

/** Legacy returns that are outside the upcoming window. A return already listed there is not repeated. */
export function returnsToReview(
  bookings: Booking[],
  now: Date,
  withinMs: number
): UpcomingReminder[] {
  const end = now.getTime() + withinMs;
  const items: UpcomingReminder[] = [];
  for (const booking of bookings) {
    for (const leg of journeyLegs(booking, now)) {
      if (leg.leg !== 'return' || !leg.needsReview || !leg.pickupAt) continue;
      const t = leg.pickupAt.getTime();
      if (t > now.getTime() && t <= end) continue;
      items.push(toReminder(booking, leg));
    }
  }
  items.sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());
  return items;
}

export function countUpcomingWithinMs(
  bookings: Booking[],
  now: Date,
  withinMs: number
): number {
  return getUpcomingBookings(bookings, now, { withinMs }).length;
}

export function formatTimeUntil(pickupAt: Date, now: Date): string {
  const ms = pickupAt.getTime() - now.getTime();
  if (ms <= 0) return 'Due now';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) {
    return totalMin <= 1 ? 'in 1 min' : `in ${totalMin} min`;
  }
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 48) {
    return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

export function formatPickupDisplay(pickupAt: Date): string {
  return pickupAt.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
