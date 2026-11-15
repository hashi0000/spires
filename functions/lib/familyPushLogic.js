"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILY_PUSH_URL = exports.FAMILY_PUSH_SENT = void 0;
exports.familyPushSubscription = familyPushSubscription;
exports.familyPushGone = familyPushGone;
exports.familyJobChangeNotice = familyJobChangeNotice;
exports.familyJobDueNotices = familyJobDueNotices;
const crypto_1 = require("crypto");
exports.FAMILY_PUSH_SENT = "familyPushSent";
exports.FAMILY_PUSH_URL = "/office-jobs";
const DUE_FROM_MS = 45 * 60 * 1000;
const DUE_UNTIL_MS = 75 * 60 * 1000;
const ACTIVE = new Set(["pending", "confirmed", "allocated"]);
function text(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
function millis(value) {
    if (value == null || value === "")
        return null;
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}
function clip(value, max) {
    if (value.length <= max)
        return value;
    return value.slice(0, max - 1).trimEnd() + "…";
}
function londonWhen(ms) {
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
function ignored(bookingId, data) {
    if (!data)
        return true;
    if (data.brand === "spires_international")
        return true;
    if (bookingId.startsWith("synthetic-measurement-"))
        return true;
    return text(data.bookingNumber).toUpperCase().startsWith("TEST");
}
function cancelled(data) {
    return text(data?.status) === "cancelled" || text(data?.customerStatus) === "cancelled";
}
function completed(data) {
    return text(data?.status) === "completed" || text(data?.adminStatus) === "completed";
}
function pickupMs(data) {
    return millis(data?.pickupTime) || millis(data?.dateTime);
}
function returnMs(data) {
    return millis(data?.returnPickupTime) || millis(data?.returnDateTime);
}
function route(from, to) {
    const left = clip(text(from), 60);
    const right = clip(text(to), 60);
    if (left && right)
        return `${left} to ${right}`;
    return left || right;
}
function outboundRoute(data) {
    return route(data?.pickupLocation || data?.pickup, data?.destination);
}
function returnRoute(data) {
    return route(data?.returnPickupLocation || data?.destination, data?.returnDestination || data?.pickupLocation || data?.pickup);
}
function upcoming(data, now) {
    const outbound = pickupMs(data);
    const ret = returnMs(data);
    if (outbound == null && ret == null)
        return true;
    return (outbound != null && outbound > now - 2 * 60 * 1000) || (ret != null && ret > now - 2 * 60 * 1000);
}
function notice(input) {
    const when = input.whenMs == null ? "" : londonWhen(input.whenMs);
    const parts = [input.detail, input.bookingNumber, when, input.routeText].map((part) => part.trim()).filter(Boolean);
    return {
        title: input.title,
        body: clip(parts.join(". "), 180),
        tag: clip(input.tag, 64),
        url: exports.FAMILY_PUSH_URL,
        dedupeId: (0, crypto_1.createHash)("sha256").update(input.dedupe).digest("hex").slice(0, 40),
    };
}
function familyPushSubscription(input) {
    if (!input || typeof input !== "object")
        return null;
    const row = input;
    const endpoint = text(row.endpoint);
    const keys = row.keys && typeof row.keys === "object" ? row.keys : {};
    const p256dh = text(keys.p256dh);
    const auth = text(keys.auth);
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000)
        return null;
    if (!/^[A-Za-z0-9_=-]{16,200}$/.test(p256dh) || !/^[A-Za-z0-9_=-]{10,200}$/.test(auth))
        return null;
    return { endpoint, keys: { p256dh, auth } };
}
function familyPushGone(statusCode) {
    return statusCode === 404 || statusCode === 410;
}
/** One alert for a real booking change. Notes, payments and past jobs stay quiet. */
function familyJobChangeNotice(before, after, bookingId, now) {
    if (!after || ignored(bookingId, after))
        return null;
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
        if (cancelled(after) || !upcoming(after, now))
            return null;
        return notice({ ...base, title: "New job", detail: "New job", dedupe: `created:${bookingId}:${when || returnMs(after) || "open"}` });
    }
    if (ignored(bookingId, before))
        return null;
    if (!cancelled(before) && cancelled(after)) {
        if (!upcoming(before, now) && !upcoming(after, now))
            return null;
        return notice({ ...base, title: "Job cancelled", detail: "Job cancelled", dedupe: `cancelled:${bookingId}` });
    }
    if (!upcoming(after, now))
        return null;
    const timeChanged = pickupMs(before) !== when || returnMs(before) !== returnMs(after);
    const driverChanged = text(before.driverId) !== text(after.driverId) || text(before.returnDriverId) !== text(after.returnDriverId);
    const confirmed = !ACTIVE.has(text(before.status)) && ACTIVE.has(text(after.status));
    if (!timeChanged && !driverChanged && !confirmed)
        return null;
    const detail = timeChanged ? "Job time changed" : driverChanged ? "Driver changed" : "Job confirmed";
    const title = timeChanged ? "Job changed" : driverChanged ? "Driver changed" : "Job confirmed";
    return notice({
        ...base,
        title,
        detail,
        dedupe: `changed:${bookingId}:${when || ""}:${returnMs(after) || ""}:${text(after.driverId)}:${text(after.returnDriverId)}:${text(after.status)}`,
    });
}
function dueLeg(input) {
    if (input.at == null)
        return null;
    const until = input.at - input.now;
    if (until < DUE_FROM_MS || until > DUE_UNTIL_MS)
        return null;
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
function familyJobDueNotices(data, bookingId, now) {
    if (!data || ignored(bookingId, data) || cancelled(data) || completed(data))
        return [];
    if (!ACTIVE.has(text(data.status)))
        return [];
    const number = text(data.bookingNumber) || "Job";
    const notices = [
        dueLeg({ bookingId, bookingNumber: number, leg: "outbound", at: pickupMs(data), routeText: outboundRoute(data), now }),
    ];
    const ret = returnMs(data);
    if (ret != null && text(data.returnStatus) !== "completed" && text(data.returnStatus) !== "cancelled") {
        notices.push(dueLeg({ bookingId, bookingNumber: number, leg: "return", at: ret, routeText: returnRoute(data), now }));
    }
    return notices.filter((row) => Boolean(row));
}
