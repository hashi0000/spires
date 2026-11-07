"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeRecord = placeRecord;
function str(value) {
    return typeof value === "string" ? value.trim() : "";
}
/** Keep a selected place only while it still matches the address the customer can read. */
function placeRecord(value, addressText) {
    if (!value || typeof value !== "object")
        return null;
    const row = value;
    const label = str(row.label).slice(0, 240);
    const address = str(addressText);
    if (!label || !address || label.toLowerCase() !== address.toLowerCase())
        return null;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const record = {
        label,
        placeId: str(row.placeId).slice(0, 180),
        postcode: str(row.postcode).slice(0, 12).toUpperCase(),
        premise: str(row.premise).slice(0, 80),
    };
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        record.latitude = latitude;
        record.longitude = longitude;
    }
    return record;
}
