import { SHARE_TIMEZONE } from "./defaults";

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

/** Convert a Europe/London civil date+time to a UTC ISO string. Handles GMT and BST. */
export function londonDateTimeToUtcIso(travelDate: string, hhmm: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec((travelDate || "").trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!dateMatch || !timeMatch) {
    throw new Error("Date must be YYYY-MM-DD and time must be HH:MM in Europe/London.");
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) {
    throw new Error("Invalid departure time.");
  }
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const got = londonParts(utc);
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute);
    const delta = wantMs - gotMs;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc).toISOString();
}

export function subtractHoursIso(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() - hours * 60 * 60 * 1000).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

export function isPast(iso: string, nowIso?: string): boolean {
  return new Date(iso).getTime() <= new Date(nowIso || Date.now()).getTime();
}

export function slotKey(airportId: string, travelDate: string, departureTime: string): string {
  return `${airportId}_${travelDate}_${departureTime.replace(":", "")}`;
}
