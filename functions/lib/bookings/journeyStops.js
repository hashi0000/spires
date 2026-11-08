"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_RETURN_NOTICE = void 0;
exports.newStopId = newStopId;
exports.normaliseStops = normaliseStops;
exports.validateStops = validateStops;
exports.hasExtraStops = hasExtraStops;
exports.routeSentence = routeSentence;
exports.describeStops = describeStops;
exports.openReturnSummary = openReturnSummary;
exports.readStops = readStops;
exports.applyStopEnds = applyStopEnds;
exports.OPEN_RETURN_NOTICE = "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";
function text(value, max = 240) {
    return String(value ?? "").trim().slice(0, max);
}
function newStopId() {
    return `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function normaliseStops(raw, pickup = "", destination = "") {
    const fromRaw = Array.isArray(raw)
        ? raw.map((item, index) => {
            const row = item && typeof item === "object" ? item : {};
            const kind = text(row.type);
            return {
                id: text(row.id, 40) || `stop-${index + 1}`,
                type: kind === "dropoff" || kind === "drop_off" ? "dropoff" : "pickup",
                address: text(row.address),
                notes: text(row.notes, 400),
                place: row.place && typeof row.place === "object" ? row.place : null,
            };
        }).filter((stop) => stop.address)
        : [];
    if (fromRaw.length > 0)
        return fromRaw;
    const start = text(pickup);
    const end = text(destination);
    if (!start && !end)
        return [];
    return [
        { id: "start", type: "pickup", address: start, notes: "", place: null },
        { id: "end", type: "dropoff", address: end, notes: "", place: null },
    ];
}
function validateStops(stops) {
    if (stops.length < 2)
        return "Add a pickup and a drop off.";
    if (stops.some((stop) => !stop.address.trim()))
        return "Every stop needs a full address.";
    if (stops[0].type !== "pickup")
        return "The journey needs to start with a pickup.";
    if (stops[stops.length - 1].type !== "dropoff")
        return "The journey needs to end with a drop off.";
    return null;
}
function hasExtraStops(stops) {
    return stops.length > 2;
}
function routeSentence(stops, when = "") {
    const clock = when.trim();
    if (stops.length === 2 && stops.every((stop) => !stop.notes)) {
        return `${stops[0].address} to ${stops[1].address}${clock ? ` at ${clock}` : ""}`;
    }
    return `${describeStops(stops)}${clock ? `. ${clock}` : ""}`;
}
function describeStops(stops) {
    return stops
        .map((stop, index) => {
        const kind = stop.type === "pickup" ? "Pickup" : "Drop off";
        return `${index + 1}. ${kind}: ${stop.address}${stop.notes ? ` (${stop.notes})` : ""}`;
    })
        .join("; ");
}
function openReturnSummary(booking) {
    if (booking.openReturn !== true)
        return "";
    const date = text(booking.returnDate, 10);
    const time = text(booking.returnPickupTime, 40);
    const note = text(booking.returnNoticeNote, 400);
    const parts = [
        date ? `Open return on ${date}.` : "Open return.",
        time ? `Pickup time now set for ${time}.` : "Return time to be confirmed.",
        exports.OPEN_RETURN_NOTICE,
    ];
    if (note)
        parts.push(note);
    return parts.join(" ");
}
function readStops(body, key, pickup, destination) {
    return normaliseStops(body[key], pickup, destination).slice(0, 12);
}
function applyStopEnds(stops) {
    const first = stops[0];
    const last = stops[stops.length - 1];
    return {
        pickup: first?.address || "",
        destination: last?.address || "",
        pickupPlace: first?.place || null,
        destinationPlace: last?.place || null,
    };
}
