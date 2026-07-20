import { useEffect, useRef } from 'react';
import { Booking } from '../types/types';
import { isCustomerBooking } from '../utils/bookingMapper';

function sessionKey(bookingId: string): string {
  return `spires_pending_alert_${bookingId}`;
}

function playChime(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Ignore audio failures
  }
}

/** Browser notification + chime when a new pending customer booking appears while admin is open.
 * Browser popups require Notification permission (enable Desktop reminders on the dashboard).
 * A short chime always plays so staff notice even without permission. */
export function usePendingBookingAlerts(
  enabled: boolean,
  bookings: Booking[]
): void {
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const pending = bookings.filter(
      (b) => isCustomerBooking(b) && b.status === 'pending' && b.id
    );
    const pendingIds = new Set(pending.map((b) => b.id as string));

    // First snapshot: seed known set without alerting (existing pendings)
    if (knownIds.current === null) {
      knownIds.current = pendingIds;
      return;
    }

    for (const booking of pending) {
      const id = booking.id as string;
      if (knownIds.current.has(id)) continue;
      if (sessionStorage.getItem(sessionKey(id))) {
        knownIds.current.add(id);
        continue;
      }

      const title = 'New customer booking request';
      const body = [
        booking.hirerName,
        [booking.pickupLocation, booking.destination].filter(Boolean).join(' → '),
      ]
        .filter(Boolean)
        .join(' · ');

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: body || 'Open Bookings to review.',
            tag: `pending-${id}`,
          });
        } catch {
          // Ignore
        }
      }

      playChime();
      sessionStorage.setItem(sessionKey(id), '1');
      knownIds.current.add(id);
    }

    // Drop ids that are no longer pending
    const nextKnown = new Set<string>();
    knownIds.current.forEach((id) => {
      if (pendingIds.has(id) || sessionStorage.getItem(sessionKey(id))) {
        nextKnown.add(id);
      }
    });
    pendingIds.forEach((id) => nextKnown.add(id));
    knownIds.current = nextKnown;
  }, [enabled, bookings]);
}
