import { useEffect } from 'react';
import { Booking } from '../types/types';
import { getUpcomingBookings } from '../utils/bookingSchedule';

const WITHIN_MS = 60 * 60 * 1000;

function sessionKey(bookingId: string | undefined, leg: string): string {
  return `spires_pickup_reminder_${bookingId || 'unknown'}_${leg}`;
}

export function useBookingDesktopReminders(enabled: boolean, bookings: Booking[]): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const run = () => {
      if (Notification.permission !== 'granted') return;
      const due = getUpcomingBookings(bookings, new Date(), { withinMs: WITHIN_MS });
      for (const item of due) {
        const key = sessionKey(item.booking.id, item.leg);
        if (sessionStorage.getItem(key)) continue;
        const title = item.leg === 'return'
          ? `Return in the next hour · ${item.booking.bookingNumber}`
          : `Pickup in the next hour · ${item.booking.bookingNumber}`;
        const body = [item.pickupLocation, item.destination]
          .map((s) => (s || '').trim())
          .filter(Boolean)
          .join(' → ');
        try {
          new Notification(title, {
            body: body || 'Open the admin app for details.',
            tag: `${item.booking.id || item.booking.bookingNumber}-${item.leg}`
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
