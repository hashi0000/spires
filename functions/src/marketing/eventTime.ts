/** Use the persisted event time, never the time a delayed trigger happens to execute. */
export function measurementEventTime(value: unknown, documentWriteMs: number): number {
  const input = value as { toMillis?: () => number } | null;
  const ms = typeof input?.toMillis === 'function' ? input.toMillis() : typeof value === 'number' ? value : NaN;
  return Number.isFinite(ms) && ms > 0 && ms <= documentWriteMs ? ms : documentWriteMs;
}
