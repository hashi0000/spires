"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.londonYmd = londonYmd;
/** Calendar date in Europe/London as YYYY-MM-DD. Year-specific campaigns must use this, not the server local zone. */
function londonYmd(ms) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((row) => [row.type, row.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
