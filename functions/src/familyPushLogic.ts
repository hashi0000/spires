import { createHash } from "crypto";

export const FAMILY_PUSH_SENT = "familyPushSent";
export const FAMILY_PUSH_URL = "/office-jobs";
const DUE_FROM_MS = 45 * 60 * 1000;
const DUE_UNTIL_MS = 75 * 60 * 1000;
const ACTIVE = new Set(["pending", "confirmed", "allocated"]);

export type FamilyPushNotice = {
  title: string;
  body: string;
  tag: string;
  url: "/office-jobs";
  dedupeId: string;
};

export type FamilyPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type Row = Record<string, unknown> | null | undefined;

function text(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function millis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

function londonWhen(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

function ignored(bookingId: string, data: Row): boolean {
  if (!data) return true;
  if (data.brand === "spires_international") return true;
  if (bookingId.startsWith("synthetic-measurement-")) return true;
  return text(data.bookingNumber).toUpperCase().startsWith("TEST");
}

function cancelled(data: Row): boolean {
  return text(data?.status) === "cancelled" || text(data?.customerStatus) === "cancelled";
}

function completed(data: Row): boolean {
  return ["completed", "paid"].includes(text(data?.status)) || text(data?.adminStatus) === "completed";
}

function pickupMs(data: Row): number | null {
  return millis(data?.pickupTime) || millis(data?.dateTime);
}

function returnMs(data: Row): number | null {
  return millis(data?.returnPickupTime) || millis(data?.returnDateTime);
}

function route(from: unknown, to: unknown): string {
  const left = clip(text(from), 60);
  const right = clip(text(to), 60);
  if (left && right) return `${left} to ${right}`;
  return left || right;
}

function outboundRoute(data: Row): string {
  return route(data?.pickupLocation || data?.pickup, data?.destination);
}

function returnRoute(data: Row): string {
  return route(data?.returnPickupLocation || data?.destination, data?.returnDestination || data?.pickupLocation || data?.pickup);
}

function upcoming(data: Row, now: number): boolean {
  const outbound = pickupMs(data);
  const ret = returnMs(data);
  if (outbound == null && ret == null) return true;
  return (outbound != null && outbound > now - 2 * 60 * 1000) || (ret != null && ret > now - 2 * 60 * 1000);
}

function notice(input: {
  bookingId: string;
  bookingNumber: string;
  title: string;
  detail: string;
  whenMs: number | null;
  routeText: string;
  tag: string;
  dedupe: string;
}): FamilyPushNotice {
  const when = input.whenMs == null ? "" : londonWhen(input.whenMs);
  const parts = [input.detail, input.bookingNumber, when, input.routeText].map((part) => part.trim()).filter(Boolean);
  return {
    title: input.title,
    body: clip(parts.join(". "), 180),
    tag: clip(input.tag, 64),
    url: FAMILY_PUSH_URL,
    dedupeId: createHash("sha256").update(input.dedupe).digest("hex").slice(0, 40),
  };
}

export function familyPushSubscription(input: unknown): FamilyPushSubscription | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const endpoint = text(row.endpoint);
  const keys = row.keys && typeof row.keys === "object" ? row.keys as Record<string, unknown> : {};
  const p256dh = text(keys.p256dh);
  const auth = text(keys.auth);
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return null;
  if (!/^[A-Za-z0-9_=-]{16,200}$/.test(p256dh) || !/^[A-Za-z0-9_=-]{10,200}$/.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export function familyPushGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** One alert for a real booking change. Notes, payments and past jobs stay quiet. */
export function familyJobChangeNotice(before: Row, after: Row, bookingId: string, now: number): FamilyPushNotice | null {
  if (!after || ignored(bookingId, after)) return null;
  const number = text(after.bookingNumber) || "Job";
  const when = pickupMs(after);
  const base = {
    bookingId,
    bookingNumber: number,
    whenMs: when,
    routeText: outboundRoute(after),
    tag: `job-${bookingId}`,
  };
  if (!before) {
    if (cancelled(after) || !upcoming(after, now)) return null;
    return notice({ ...base, title: "New job", detail: "New job", dedupe: `created:${bookingId}:${when || returnMs(after) || "open"}` });
  }
  if (ignored(bookingId, before)) return null;
  if (!cancelled(before) && cancelled(after)) {
    if (!upcoming(before, now) && !upcoming(after, now)) return null;
    return notice({ ...base, title: "Job cancelled", detail: "Job cancelled", dedupe: `cancelled:${bookingId}` });
  }
  if (!upcoming(after, now)) return null;
  const timeChanged = pickupMs(before) !== when || returnMs(before) !== returnMs(after);
  const driverChanged = text(before.driverId) !== text(after.driverId) || text(before.returnDriverId) !== text(after.returnDriverId);
  const confirmed = !ACTIVE.has(text(before.status)) && ACTIVE.has(text(after.status));
  if (!timeChanged && !driverChanged && !confirmed) return null;
  const detail = timeChanged ? "Job time changed" : driverChanged ? "Driver changed" : "Job confirmed";
  const title = timeChanged ? "Job changed" : driverChanged ? "Driver changed" : "Job confirmed";
  return notice({
    ...base,
    title,
    detail,
    dedupe: `changed:${bookingId}:${when || ""}:${returnMs(after) || ""}:${text(after.driverId)}:${text(after.returnDriverId)}:${text(after.status)}`,
  });
}

function dueLeg(input: {
  bookingId: string;
  bookingNumber: string;
  leg: "outbound" | "return";
  at: number | null;
  routeText: string;
  now: number;
}): FamilyPushNotice | null {
  if (input.at == null) return null;
  const until = input.at - input.now;
  if (until < DUE_FROM_MS || until > DUE_UNTIL_MS) return null;
  const title = input.leg === "return" ? "Return in the next hour" : "Pickup in the next hour";
  return notice({
    bookingId: input.bookingId,
    bookingNumber: input.bookingNumber,
    title,
    detail: title,
    whenMs: input.at,
    routeText: input.routeText,
    tag: `due-${input.bookingId}-${input.leg}`,
    dedupe: `due:${input.bookingId}:${input.leg}:${input.at}`,
  });
}

/** Alerts for journeys about an hour away. A completed or cancelled job is left out. */
export function familyJobDueNotices(data: Row, bookingId: string, now: number): FamilyPushNotice[] {
  if (!data || ignored(bookingId, data) || cancelled(data) || completed(data)) return [];
  if (!ACTIVE.has(text(data.status))) return [];
  const number = text(data.bookingNumber) || "Job";
  const notices = [
    dueLeg({ bookingId, bookingNumber: number, leg: "outbound", at: pickupMs(data), routeText: outboundRoute(data), now }),
  ];
  const ret = returnMs(data);
  if (ret != null && text(data.returnStatus) !== "completed" && text(data.returnStatus) !== "cancelled") {
    notices.push(dueLeg({ bookingId, bookingNumber: number, leg: "return", at: ret, routeText: returnRoute(data), now }));
  }
  return notices.filter((row): row is FamilyPushNotice => Boolean(row));
}
