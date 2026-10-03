"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePlace = normalizePlace;
exports.windowFromPreference = windowFromPreference;
exports.windowsOverlap = windowsOverlap;
exports.journeyTypeForRegion = journeyTypeForRegion;
exports.destinationMatchingForRegion = destinationMatchingForRegion;
exports.previewCompatibleInterest = previewCompatibleInterest;
exports.interestPublicNumber = interestPublicNumber;
exports.timeLabelForWindow = timeLabelForWindow;
exports.resolveInterestWindow = resolveInterestWindow;
exports.findCompatibleInterestGroup = findCompatibleInterestGroup;
exports.interestGroupStatusFromCount = interestGroupStatusFromCount;
exports.toPublicInterestGroup = toPublicInterestGroup;
exports.publicInterestHasPrivateData = publicInterestHasPrivateData;
exports.adminInterestDestinations = adminInterestDestinations;
exports.isWaitlistWaiting = isWaitlistWaiting;
exports.waitlistJoinedAt = waitlistJoinedAt;
exports.fifoWaitlist = fifoWaitlist;
exports.waitlistOrder = waitlistOrder;
exports.derivedWaitlistPosition = derivedWaitlistPosition;
exports.publicRemainingSeats = publicRemainingSeats;
const eventJourneys_1 = require("./eventJourneys");
const shareProgress_1 = require("./shareProgress");
const logic_1 = require("./logic");
const REGION_ALIASES = {
    oxford: "Oxford",
    "oxford city": "Oxford",
    london: "London",
    "central london": "London",
    heathrow: "Heathrow",
    "heathrow airport": "Heathrow",
    lhr: "Heathrow",
    "heathrow t3": "Heathrow",
    "heathrow terminal 3": "Heathrow",
    gatwick: "Gatwick",
    "gatwick airport": "Gatwick",
    lgw: "Gatwick",
    luton: "Luton",
    "luton airport": "Luton",
    stansted: "Stansted",
    "stansted airport": "Stansted",
    "london city": "London City",
    "london city airport": "London City",
    wembley: "Wembley",
    "wembley stadium": "Wembley",
    "allianz stadium": "Allianz Stadium",
    tottenham: "Allianz Stadium",
    "the o2": "The O2",
    o2: "The O2",
    "o2 arena": "The O2",
    "north greenwich": "The O2",
    "excel": "ExCeL London",
    "excel london": "ExCeL London",
    "the excel": "ExCeL London",
    docklands: "ExCeL London",
    birmingham: "Birmingham",
    "birmingham city": "Birmingham",
    "birmingham airport": "Birmingham Airport",
};
const AIRPORT_REGIONS = new Set(["Heathrow", "Gatwick", "Luton", "Stansted", "London City", "Birmingham Airport"]);
const EVENT_REGIONS = new Set(["Wembley", "Allianz Stadium", "The O2", "ExCeL London"]);
const CITY_REGIONS = new Set(["London", "Birmingham"]);
function normalizePlace(value) {
    const key = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    if (!key)
        return { label: "", known: false };
    if (REGION_ALIASES[key])
        return { label: REGION_ALIASES[key], known: true };
    const titled = key.replace(/\b\w/g, (ch) => ch.toUpperCase());
    return { label: titled, known: false };
}
function windowFromPreference(preferredHm, flexibility = "plus_minus_30") {
    const preferred = (0, logic_1.parseHmToMinutes)(preferredHm);
    if (preferred == null)
        throw new Error("Choose a preferred departure time.");
    const slack = (0, logic_1.flexibilityMinutes)(flexibility);
    return { start: (0, logic_1.minutesToHm)(preferred - slack), end: (0, logic_1.minutesToHm)(preferred + slack) };
}
function windowsOverlap(aStart, aEnd, bStart, bEnd) {
    const a0 = (0, logic_1.parseHmToMinutes)(aStart);
    const a1 = (0, logic_1.parseHmToMinutes)(aEnd);
    const b0 = (0, logic_1.parseHmToMinutes)(bStart);
    const b1 = (0, logic_1.parseHmToMinutes)(bEnd);
    if (a0 == null || a1 == null || b0 == null || b1 == null)
        return false;
    const startA = a0 <= a1 ? a0 : a0;
    const endA = a0 <= a1 ? a1 : a1 + 24 * 60;
    const startB = b0 <= b1 ? b0 : b0;
    const endB = b0 <= b1 ? b1 : b1 + 24 * 60;
    return startA <= endB && startB <= endA;
}
function journeyTypeForRegion(destinationRegion) {
    const label = normalizePlace(destinationRegion).label || destinationRegion;
    if (AIRPORT_REGIONS.has(label))
        return "AIRPORT";
    if (EVENT_REGIONS.has(label))
        return "EVENT";
    if (CITY_REGIONS.has(label))
        return "CITY";
    return "OTHER";
}
function destinationMatchingForRegion(destinationRegion) {
    return journeyTypeForRegion(destinationRegion) === "CITY";
}
function previewCompatibleInterest(groups, request) {
    const origin = normalizePlace(request.origin);
    const destination = normalizePlace(request.destinationRegion);
    if (!origin.label || !destination.label || !request.travelDate)
        return null;
    const window = resolveInterestWindow(request);
    const match = findCompatibleInterestGroup(groups, {
        origin: origin.label,
        destinationRegion: destination.label,
        travelDate: request.travelDate,
        timeWindowStart: window.start,
        timeWindowEnd: window.end,
    });
    return match ? toPublicInterestGroup(match) : null;
}
function interestPublicNumber(origin, destination, travelDate, start, end) {
    const o = origin.slice(0, 3).toUpperCase();
    const d = destination.slice(0, 3).toUpperCase();
    return `IG-${travelDate.replace(/-/g, "")}-${o}-${d}-${start.replace(":", "")}-${end.replace(":", "")}`;
}
function timeLabelForWindow(start, end) {
    if (start && start === end)
        return start;
    const mid = (0, logic_1.parseHmToMinutes)(start);
    if (mid == null)
        return `${start}–${end}`;
    if (mid < 12 * 60)
        return "Morning";
    if (mid < 17 * 60)
        return "Afternoon";
    return "Evening";
}
function resolveInterestWindow(input) {
    const flexibility = input.flexibility || "plus_minus_30";
    if (input.timeWindowStart && input.timeWindowEnd) {
        return {
            start: input.timeWindowStart,
            end: input.timeWindowEnd,
            preferred: input.preferredDepartureTime || input.timeWindowStart,
            flexibility,
        };
    }
    const window = windowFromPreference(input.preferredDepartureTime, flexibility);
    return { ...window, preferred: input.preferredDepartureTime, flexibility };
}
function findCompatibleInterestGroup(groups, request) {
    const open = groups.filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW");
    if (request.publicNumber) {
        return open.find((row) => row.publicNumber === request.publicNumber) || null;
    }
    if (request.eventSlug) {
        return open.find((row) => row.eventSlug === request.eventSlug) || null;
    }
    return (open.find((row) => !row.eventPublished &&
        !row.eventSlug &&
        row.origin === request.origin &&
        row.destinationRegion === request.destinationRegion &&
        row.travelDate === request.travelDate &&
        windowsOverlap(row.timeWindowStart, row.timeWindowEnd, request.timeWindowStart, request.timeWindowEnd)) || null);
}
function interestGroupStatusFromCount(count, threshold, current) {
    if (current === "CONVERTED_TO_JOURNEY" || current === "EXPIRED" || current === "CANCELLED")
        return current;
    if (count >= threshold)
        return "READY_FOR_REVIEW";
    return "GATHERING_INTEREST";
}
function toPublicInterestGroup(group) {
    const base = {
        publicNumber: group.publicNumber,
        origin: group.origin,
        destinationRegion: group.destinationRegion,
        travelDate: group.travelDate,
        timeLabel: timeLabelForWindow(group.timeWindowStart, group.timeWindowEnd),
        interestedSeatCount: group.interestedSeatCount,
        status: group.status,
        journeyType: group.journeyType,
        ...(0, shareProgress_1.publicInterestSafeFields)(group),
    };
    if (group.journeyType === "EVENT") {
        return { ...base, ...(0, eventJourneys_1.eventPublicView)(group, base) };
    }
    return base;
}
function publicInterestHasPrivateData(value) {
    const json = JSON.stringify(value || {});
    return [
        "intendedDestinationText",
        "intendedDestinationPostcode",
        "name",
        "email",
        "mobile",
        "uid",
        "interestGroupId",
    ].some((key) => json.includes(`"${key}"`));
}
function adminInterestDestinations(entries) {
    return entries
        .filter((row) => row.status === "ACTIVE")
        .map((row, index) => ({
        index: index + 1,
        entryId: row.id,
        name: row.name,
        intendedDestinationText: row.intendedDestinationText || "",
        timeWindowStart: row.timeWindowStart,
        timeWindowEnd: row.timeWindowEnd,
    }));
}
function isWaitlistWaiting(status) {
    return status === "WAITLISTED" || status === "WAITING";
}
function waitlistJoinedAt(entry) {
    return entry.joinedWaitlistAt || entry.createdAt;
}
function fifoWaitlist(entries, remaining) {
    if (remaining <= 0)
        return null;
    if (entries.some((row) => row.status === "OFFERED"))
        return null;
    return (entries
        .filter((row) => isWaitlistWaiting(row.status) && row.passengers <= remaining)
        .sort((a, b) => {
        const joined = waitlistJoinedAt(a).localeCompare(waitlistJoinedAt(b));
        if (joined !== 0)
            return joined;
        return String(a.id || "").localeCompare(String(b.id || ""));
    })[0] || null);
}
function waitlistOrder(entries) {
    return [...entries].sort((a, b) => {
        const joined = waitlistJoinedAt(a).localeCompare(waitlistJoinedAt(b));
        if (joined !== 0)
            return joined;
        return a.id.localeCompare(b.id);
    });
}
function derivedWaitlistPosition(entries, entryId) {
    const waiting = waitlistOrder(entries).filter((row) => isWaitlistWaiting(row.status) || row.status === "OFFERED");
    const index = waiting.findIndex((row) => row.id === entryId);
    return index >= 0 ? index + 1 : 0;
}
function publicRemainingSeats(occupied, capacity, waitlistOfferOutstanding) {
    if (waitlistOfferOutstanding)
        return 0;
    return Math.max(0, capacity - occupied);
}
