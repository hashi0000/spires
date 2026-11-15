"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOKING_CONFLICT_MESSAGE = void 0;
exports.storedRevision = storedRevision;
exports.nextBookingRevision = nextBookingRevision;
exports.bookingRevisionDecision = bookingRevisionDecision;
function storedRevision(value) {
    const row = value && typeof value === "object" ? value : {};
    const revision = Number(row.revision);
    return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}
function nextBookingRevision(current) {
    return storedRevision(current) + 1;
}
exports.BOOKING_CONFLICT_MESSAGE = "This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again.";
function bookingRevisionDecision(current, expected) {
    const stored = storedRevision(current);
    const incoming = Number(expected);
    if (!Number.isInteger(incoming) || incoming !== stored) {
        return { ok: false, reason: exports.BOOKING_CONFLICT_MESSAGE };
    }
    return { ok: true, revision: stored + 1 };
}
