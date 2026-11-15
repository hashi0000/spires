export function storedRevision(value: unknown): number {
  const row = value && typeof value === "object" ? value as { revision?: unknown } : {};
  const revision = Number(row.revision);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

export function nextBookingRevision(current: unknown): number {
  return storedRevision(current) + 1;
}

export const BOOKING_CONFLICT_MESSAGE = "This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again.";

export function bookingRevisionDecision(current: unknown, expected: unknown): { ok: true; revision: number } | { ok: false; reason: string } {
  const stored = storedRevision(current);
  const incoming = Number(expected);
  if (!Number.isInteger(incoming) || incoming !== stored) {
    return { ok: false, reason: BOOKING_CONFLICT_MESSAGE };
  }
  return { ok: true, revision: stored + 1 };
}
