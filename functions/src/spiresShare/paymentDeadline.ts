import { SHARE_TIMEZONE } from "./defaults";
import { londonDateTimeToUtcIso } from "./timezone";

export const DEFAULT_PAYMENT_WINDOW_HOURS = 2;
export const DEFAULT_QUIET_HOURS_START = "22:00";
export const DEFAULT_QUIET_HOURS_END = "07:00";
export const DEFAULT_JOINER_MINIMUM_MINUTES = 30;

function londonParts(ms: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHARE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((row) => [row.type, row.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function parseHm(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function padDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function padHm(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addCalendarDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function londonWallFromIso(iso: string): { year: number; month: number; day: number; hour: number; minute: number; minutes: number } {
  const parts = londonParts(new Date(iso).getTime());
  return { ...parts, minutes: parts.hour * 60 + parts.minute };
}

export function londonIsoFromWall(year: number, month: number, day: number, hour: number, minute: number): string {
  return londonDateTimeToUtcIso(padDate(year, month, day), padHm(hour * 60 + minute));
}

/**
 * Quiet hours are 22:00 inclusive to 07:00 exclusive in Europe/London.
 * Overnight payment requests must not expire during this window.
 */
export function isLondonQuietHours(
  iso: string,
  quietStart = DEFAULT_QUIET_HOURS_START,
  quietEnd = DEFAULT_QUIET_HOURS_END
): boolean {
  const wall = londonWallFromIso(iso);
  const start = parseHm(quietStart);
  const end = parseHm(quietEnd);
  if (start === end) return false;
  if (start > end) return wall.minutes >= start || wall.minutes < end;
  return wall.minutes >= start && wall.minutes < end;
}

export function nextQuietHoursEndIso(
  iso: string,
  quietEnd = DEFAULT_QUIET_HOURS_END
): string {
  const wall = londonWallFromIso(iso);
  const end = parseHm(quietEnd);
  const endHour = Math.floor(end / 60);
  const endMinute = end % 60;
  if (wall.minutes < end) {
    return londonIsoFromWall(wall.year, wall.month, wall.day, endHour, endMinute);
  }
  const next = addCalendarDays(wall.year, wall.month, wall.day, 1);
  return londonIsoFromWall(next.year, next.month, next.day, endHour, endMinute);
}

export type PaymentDeadlineResult = {
  windowStartAt: string;
  deadlineAt: string;
  quietHoursApplied: boolean;
  timezone: typeof SHARE_TIMEZONE;
};

/**
 * Payment deadline policy (Europe/London):
 * 1. Default window is 2 hours from the effective start.
 * 2. If admin opens the window during quiet hours (22:00–07:00), the window starts at the next 07:00.
 * 3. If the raw deadline would fall inside quiet hours, it is pushed to the next 07:00 plus the configured window.
 * Example: a 01:00 request does not expire at 03:00; it expires at 09:00.
 */
export function computePaymentDeadline(
  openedAtIso: string,
  windowHours = DEFAULT_PAYMENT_WINDOW_HOURS,
  quietStart = DEFAULT_QUIET_HOURS_START,
  quietEnd = DEFAULT_QUIET_HOURS_END
): PaymentDeadlineResult {
  const hours = windowHours > 0 ? windowHours : DEFAULT_PAYMENT_WINDOW_HOURS;
  const openedInQuiet = isLondonQuietHours(openedAtIso, quietStart, quietEnd);
  const windowStartAt = openedInQuiet ? nextQuietHoursEndIso(openedAtIso, quietEnd) : openedAtIso;
  const rawDeadline = new Date(new Date(windowStartAt).getTime() + hours * 60 * 60 * 1000).toISOString();
  if (!isLondonQuietHours(rawDeadline, quietStart, quietEnd)) {
    return {
      windowStartAt,
      deadlineAt: rawDeadline,
      quietHoursApplied: openedInQuiet,
      timezone: SHARE_TIMEZONE,
    };
  }
  const quietEndIso = nextQuietHoursEndIso(rawDeadline, quietEnd);
  const deadlineAt = new Date(new Date(quietEndIso).getTime() + hours * 60 * 60 * 1000).toISOString();
  return {
    windowStartAt,
    deadlineAt,
    quietHoursApplied: true,
    timezone: SHARE_TIMEZONE,
  };
}

export function computeJoinerPaymentDeadline(
  nowIso: string,
  journeyDeadlineAt: string | undefined,
  windowHours = DEFAULT_PAYMENT_WINDOW_HOURS,
  quietStart = DEFAULT_QUIET_HOURS_START,
  quietEnd = DEFAULT_QUIET_HOURS_END,
  minimumMinutes = DEFAULT_JOINER_MINIMUM_MINUTES
): PaymentDeadlineResult {
  const computed = computePaymentDeadline(nowIso, windowHours, quietStart, quietEnd);
  if (!journeyDeadlineAt) return computed;
  const remainingMs = new Date(journeyDeadlineAt).getTime() - new Date(nowIso).getTime();
  if (remainingMs >= minimumMinutes * 60 * 1000 && !isLondonQuietHours(journeyDeadlineAt, quietStart, quietEnd)) {
    return {
      windowStartAt: nowIso,
      deadlineAt: journeyDeadlineAt,
      quietHoursApplied: false,
      timezone: SHARE_TIMEZONE,
    };
  }
  return computed;
}

export function formatLondonDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHARE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
