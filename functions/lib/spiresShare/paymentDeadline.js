"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JOINER_MINIMUM_MINUTES = exports.DEFAULT_QUIET_HOURS_END = exports.DEFAULT_QUIET_HOURS_START = exports.DEFAULT_PAYMENT_WINDOW_HOURS = void 0;
exports.londonWallFromIso = londonWallFromIso;
exports.londonIsoFromWall = londonIsoFromWall;
exports.isLondonQuietHours = isLondonQuietHours;
exports.nextQuietHoursEndIso = nextQuietHoursEndIso;
exports.computePaymentDeadline = computePaymentDeadline;
exports.computeInterestDeadline = computeInterestDeadline;
exports.computeJoinerPaymentDeadline = computeJoinerPaymentDeadline;
exports.formatLondonDateTime = formatLondonDateTime;
const defaults_1 = require("./defaults");
const timezone_1 = require("./timezone");
exports.DEFAULT_PAYMENT_WINDOW_HOURS = 2;
exports.DEFAULT_QUIET_HOURS_START = "22:00";
exports.DEFAULT_QUIET_HOURS_END = "07:00";
exports.DEFAULT_JOINER_MINIMUM_MINUTES = 30;
function londonParts(ms) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: defaults_1.SHARE_TIMEZONE,
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
function parseHm(hhmm) {
    const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
    if (!match)
        return 0;
    return Number(match[1]) * 60 + Number(match[2]);
}
function padDate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function padHm(totalMinutes) {
    const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function addCalendarDays(year, month, day, days) {
    const utc = new Date(Date.UTC(year, month - 1, day + days));
    return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}
function londonWallFromIso(iso) {
    const parts = londonParts(new Date(iso).getTime());
    return { ...parts, minutes: parts.hour * 60 + parts.minute };
}
function londonIsoFromWall(year, month, day, hour, minute) {
    return (0, timezone_1.londonDateTimeToUtcIso)(padDate(year, month, day), padHm(hour * 60 + minute));
}
/**
 * Quiet hours are 22:00 inclusive to 07:00 exclusive in Europe/London.
 * Overnight payment requests must not expire during this window.
 */
function isLondonQuietHours(iso, quietStart = exports.DEFAULT_QUIET_HOURS_START, quietEnd = exports.DEFAULT_QUIET_HOURS_END) {
    const wall = londonWallFromIso(iso);
    const start = parseHm(quietStart);
    const end = parseHm(quietEnd);
    if (start === end)
        return false;
    if (start > end)
        return wall.minutes >= start || wall.minutes < end;
    return wall.minutes >= start && wall.minutes < end;
}
function nextQuietHoursEndIso(iso, quietEnd = exports.DEFAULT_QUIET_HOURS_END) {
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
/**
 * Payment deadline policy (Europe/London):
 * 1. Default window is 2 hours from the effective start.
 * 2. If admin opens the window during quiet hours (22:00–07:00), the window starts at the next 07:00.
 * 3. If the raw deadline would fall inside quiet hours, it is pushed to the next 07:00 plus the configured window.
 * Example: a 01:00 request does not expire at 03:00; it expires at 09:00.
 */
function computePaymentDeadline(openedAtIso, windowHours = exports.DEFAULT_PAYMENT_WINDOW_HOURS, quietStart = exports.DEFAULT_QUIET_HOURS_START, quietEnd = exports.DEFAULT_QUIET_HOURS_END) {
    const hours = windowHours > 0 ? windowHours : exports.DEFAULT_PAYMENT_WINDOW_HOURS;
    const openedInQuiet = isLondonQuietHours(openedAtIso, quietStart, quietEnd);
    const windowStartAt = openedInQuiet ? nextQuietHoursEndIso(openedAtIso, quietEnd) : openedAtIso;
    const rawDeadline = new Date(new Date(windowStartAt).getTime() + hours * 60 * 60 * 1000).toISOString();
    if (!isLondonQuietHours(rawDeadline, quietStart, quietEnd)) {
        return {
            windowStartAt,
            deadlineAt: rawDeadline,
            quietHoursApplied: openedInQuiet,
            timezone: defaults_1.SHARE_TIMEZONE,
        };
    }
    const quietEndIso = nextQuietHoursEndIso(rawDeadline, quietEnd);
    const deadlineAt = new Date(new Date(quietEndIso).getTime() + hours * 60 * 60 * 1000).toISOString();
    return {
        windowStartAt,
        deadlineAt,
        quietHoursApplied: true,
        timezone: defaults_1.SHARE_TIMEZONE,
    };
}
function computeInterestDeadline(createdAtIso, windowHours = 48, quietStart = exports.DEFAULT_QUIET_HOURS_START, quietEnd = exports.DEFAULT_QUIET_HOURS_END) {
    return computePaymentDeadline(createdAtIso, windowHours > 0 ? windowHours : 48, quietStart, quietEnd);
}
function computeJoinerPaymentDeadline(nowIso, journeyDeadlineAt, windowHours = exports.DEFAULT_PAYMENT_WINDOW_HOURS, quietStart = exports.DEFAULT_QUIET_HOURS_START, quietEnd = exports.DEFAULT_QUIET_HOURS_END, minimumMinutes = exports.DEFAULT_JOINER_MINIMUM_MINUTES) {
    const computed = computePaymentDeadline(nowIso, windowHours, quietStart, quietEnd);
    if (!journeyDeadlineAt)
        return computed;
    const remainingMs = new Date(journeyDeadlineAt).getTime() - new Date(nowIso).getTime();
    if (remainingMs >= minimumMinutes * 60 * 1000 && !isLondonQuietHours(journeyDeadlineAt, quietStart, quietEnd)) {
        return {
            windowStartAt: nowIso,
            deadlineAt: journeyDeadlineAt,
            quietHoursApplied: false,
            timezone: defaults_1.SHARE_TIMEZONE,
        };
    }
    return computed;
}
function formatLondonDateTime(iso) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: defaults_1.SHARE_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(new Date(iso));
}
