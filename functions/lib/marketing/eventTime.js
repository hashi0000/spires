"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.measurementEventTime = measurementEventTime;
/** Use the persisted event time, never the time a delayed trigger happens to execute. */
function measurementEventTime(value, documentWriteMs) {
    const input = value;
    const ms = typeof input?.toMillis === 'function' ? input.toMillis() : typeof value === 'number' ? value : NaN;
    return Number.isFinite(ms) && ms > 0 && ms <= documentWriteMs ? ms : documentWriteMs;
}
