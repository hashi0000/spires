import { useEffect } from 'react';
import { Booking } from '../types/types';
import { getBookingPickupDate, isActiveBookingStatus } from '../utils/bookingSchedule';

const WITHIN_MS = 60 * 60 * 1000;

function sessionKey(bookingId: string | undefined): string {
  return `spires_pickup_reminder_${bookingId || 'unknown'}`;
}

export function useBookingDesktopReminders(enabled: boolean, bookings: Booking[]): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const run = () => {
      if (Notification.permission !== 'granted') return;
      const now = Date.now();
      for (const booking of bookings) {
        if (!isActiveBookingStatus(booking.status)) continue;
        const pickupAt = getBookingPickupDate(booking);
        if (!pickupAt) continue;
        const ms = pickupAt.getTime() - now;
        if (ms <= 0 || ms > WITHIN_MS) continue;
        const key = sessionKey(booking.id);
        if (sessionStorage.getItem(key)) continue;
        const title = `Pickup in the next hour · ${booking.bookingNumber}`;
        const body = [booking.pickupLocation, booking.destination]
          .map((s) => (s || '').trim())
          .filter(Boolean)
          .join(' → ');
        try {
          new Notification(title, {
            body: body || 'Open the admin app for details.',
            tag: booking.id || booking.bookingNumber
          });
          sessionStorage.setItem(key, '1');
        } catch {
          // Ignore unsupported environments
        }
      }
    };

    run();
    const id = window.setInterval(run, 60 * 1000);
    return () => window.clearInterval(id);
  }, [enabled, bookings]);
}
