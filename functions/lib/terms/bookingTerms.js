"use strict";
/**
 * Booking terms published on 25 October 2026.
 * Applies to journeys from 1 April 2026. Those dates are separate.
 * The previous public page had no stored publication date and is not an April archive.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ACCEPTANCE_METHODS = exports.TERMS_ACCEPT_PAGE = exports.PREVIOUS_PUBLIC_TERMS = exports.CURRENT_BOOKING_TERMS = void 0;
exports.termsUrlForVersion = termsUrlForVersion;
exports.acceptanceMethodLabel = acceptanceMethodLabel;
exports.onlineTermsAcceptance = onlineTermsAcceptance;
exports.londonWallTimeToUtcMs = londonWallTimeToUtcMs;
exports.validateStaffTermsReport = validateStaffTermsReport;
exports.toMillis = toMillis;
exports.formatLondonDateTime = formatLondonDateTime;
exports.acceptanceSummary = acceptanceSummary;
exports.confirmationTermsParagraph = confirmationTermsParagraph;
exports.CURRENT_BOOKING_TERMS = {
    version: "2026-10-25",
    appliesToJourneysFrom: "2026-04-01",
    publishedOn: "2026-10-25",
    path: "/terms/2026-10-25",
    url: "https://www.spires-taxis.com/terms/2026-10-25",
};
exports.PREVIOUS_PUBLIC_TERMS = {
    id: "previous-public",
    preservedOn: "2026-10-25",
    path: "/terms/previous-public",
    url: "https://www.spires-taxis.com/terms/previous-public",
    publicationDateRecorded: false,
};
exports.TERMS_ACCEPT_PAGE = "https://www.spires-taxis.com/terms-accept";
const ONLINE_CHANNELS = ["customer_portal", "website"];
exports.STAFF_ACCEPTANCE_METHODS = ["phone", "email", "whatsapp", "in_person", "other"];
function termsUrlForVersion(version) {
    if (version === exports.CURRENT_BOOKING_TERMS.version)
        return exports.CURRENT_BOOKING_TERMS.url;
    if (version === exports.PREVIOUS_PUBLIC_TERMS.id)
        return exports.PREVIOUS_PUBLIC_TERMS.url;
    return "";
}
function acceptanceMethodLabel(method) {
    switch (method) {
        case "customer_portal":
            return "Customer portal";
        case "website":
            return "Website";
        case "terms_link":
            return "Secure link";
        case "phone":
            return "Phone";
        case "email":
            return "Email";
        case "whatsapp":
            return "WhatsApp";
        case "in_person":
            return "In person";
        case "other":
            return "Other";
        default:
            return method ? method : "";
    }
}
function onlineTermsAcceptance(input) {
    if (input.termsAccepted !== true) {
        return { ok: false, error: "Please agree to the Terms and Conditions before submitting." };
    }
    if (input.termsVersion !== exports.CURRENT_BOOKING_TERMS.version) {
        return { ok: false, error: "Please open the current Terms and Conditions and agree again." };
    }
    if (!ONLINE_CHANNELS.includes(input.channel)) {
        return { ok: false, error: "This booking channel cannot record online agreement." };
    }
    return { ok: true, version: exports.CURRENT_BOOKING_TERMS.version, method: input.channel };
}
function londonParts(ms) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    const bag = {};
    fmt.formatToParts(new Date(ms)).forEach((part) => {
        bag[part.type] = part.value;
    });
    return {
        year: bag.year,
        month: bag.month,
        day: bag.day,
        hour: bag.hour,
        minute: bag.minute,
    };
}
/** Interpret YYYY-MM-DDTHH:mm as Europe/London wall time. */
function londonWallTimeToUtcMs(local) {
    const match = String(local || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match)
        return null;
    const [, year, month, day, hour, minute] = match;
    const guessed = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const shown = londonParts(guessed);
    const shownMs = Date.UTC(Number(shown.year), Number(shown.month) - 1, Number(shown.day), Number(shown.hour), Number(shown.minute));
    const corrected = guessed - (shownMs - guessed);
    const check = londonParts(corrected);
    if (check.year === year && check.month === month && check.day === day && check.hour === hour && check.minute === minute) {
        return corrected;
    }
    const folded = corrected - 60 * 60 * 1000;
    const foldedCheck = londonParts(folded);
    if (foldedCheck.year === year &&
        foldedCheck.month === month &&
        foldedCheck.day === day &&
        foldedCheck.hour === hour &&
        foldedCheck.minute === minute) {
        return folded;
    }
    return null;
}
function validateStaffTermsReport(input) {
    const method = String(input.acceptanceMethod || "");
    if (!exports.STAFF_ACCEPTANCE_METHODS.includes(method)) {
        return { ok: false, error: "Choose how the customer accepted the terms." };
    }
    const note = String(input.note || "").trim();
    if (note.length < 3) {
        return { ok: false, error: "Add a reference or note for the message, call or email." };
    }
    const acceptedAtMs = londonWallTimeToUtcMs(input.acceptedAtLocal);
    if (acceptedAtMs == null) {
        return { ok: false, error: "Enter the date and time the customer accepted." };
    }
    if (acceptedAtMs > input.nowMs + 5 * 60 * 1000) {
        return { ok: false, error: "The acceptance time cannot be in the future." };
    }
    return { ok: true, acceptedAtMs, method, note };
}
function toMillis(value) {
    if (value == null || value === "")
        return null;
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value.getTime();
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "object" && value !== null) {
        const row = value;
        if (typeof row.toDate === "function") {
            const date = row.toDate();
            return Number.isNaN(date.getTime()) ? null : date.getTime();
        }
        const seconds = row.seconds ?? row._seconds;
        if (typeof seconds === "number")
            return seconds * 1000;
    }
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
}
function formatLondonDateTime(value) {
    const ms = toMillis(value);
    if (ms == null)
        return "";
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(new Date(ms));
}
function acceptanceSummary(booking) {
    const version = typeof booking.termsVersion === "string" ? booking.termsVersion : "";
    if (booking.termsAccepted !== true || !version) {
        return { recorded: false, text: "Acceptance not recorded." };
    }
    const url = termsUrlForVersion(version);
    const when = formatLondonDateTime(booking.termsAcceptedAt);
    const method = acceptanceMethodLabel(typeof booking.acceptanceMethod === "string" ? booking.acceptanceMethod : "");
    const whenText = when ? `Accepted ${when} (London)` : "Acceptance time not recorded";
    const methodText = method ? ` via ${method}` : "";
    const linkText = url ? ` ${url}` : "";
    return {
        recorded: true,
        version,
        url,
        method: typeof booking.acceptanceMethod === "string" ? booking.acceptanceMethod : "",
        text: `Terms version ${version}. ${whenText}${methodText}.${linkText}`.trim(),
    };
}
function confirmationTermsParagraph(booking) {
    const summary = acceptanceSummary(booking);
    if (summary.recorded)
        return summary.text;
    return `Acceptance not recorded. Current published terms version ${exports.CURRENT_BOOKING_TERMS.version}: ${exports.CURRENT_BOOKING_TERMS.url}`;
}
