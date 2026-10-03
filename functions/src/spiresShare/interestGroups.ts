import { eventPublicView } from "./eventJourneys";
import { publicInterestSafeFields } from "./shareProgress";
import { flexibilityMinutes, minutesToHm, parseHmToMinutes } from "./logic";
import {
  Flexibility,
  InterestGroupStatus,
  JourneyType,
  PublicInterestGroupView,
  ShareInterestEntry,
  ShareInterestGroup,
  ShareWaitlistEntry,
  WaitlistStatus,
} from "./types";

export type InterestRequest = {
  origin: string;
  destinationRegion: string;
  travelDate: string;
  preferredDepartureTime: string;
  flexibility?: Flexibility;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  passengers: number;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  sharedDropoffAcknowledged?: boolean;
  flightNumber?: string;
  flightDepartureTime?: string;
  departureTerminal?: string;
  dropoffTerminal?: string;
  tripType?: "ONE_WAY" | "RETURN";
  eventSlug?: string;
  publicNumber?: string;
};

const REGION_ALIASES: Record<string, string> = {
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

export function normalizePlace(value: string): { label: string; known: boolean } {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return { label: "", known: false };
  if (REGION_ALIASES[key]) return { label: REGION_ALIASES[key], known: true };
  const titled = key.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return { label: titled, known: false };
}

export function windowFromPreference(preferredHm: string, flexibility: Flexibility = "plus_minus_30"): { start: string; end: string } {
  const preferred = parseHmToMinutes(preferredHm);
  if (preferred == null) throw new Error("Choose a preferred departure time.");
  const slack = flexibilityMinutes(flexibility);
  return { start: minutesToHm(preferred - slack), end: minutesToHm(preferred + slack) };
}

export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = parseHmToMinutes(aStart);
  const a1 = parseHmToMinutes(aEnd);
  const b0 = parseHmToMinutes(bStart);
  const b1 = parseHmToMinutes(bEnd);
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  const startA = a0 <= a1 ? a0 : a0;
  const endA = a0 <= a1 ? a1 : a1 + 24 * 60;
  const startB = b0 <= b1 ? b0 : b0;
  const endB = b0 <= b1 ? b1 : b1 + 24 * 60;
  return startA <= endB && startB <= endA;
}

export function journeyTypeForRegion(destinationRegion: string): JourneyType {
  const label = normalizePlace(destinationRegion).label || destinationRegion;
  if (AIRPORT_REGIONS.has(label)) return "AIRPORT";
  if (EVENT_REGIONS.has(label)) return "EVENT";
  if (CITY_REGIONS.has(label)) return "CITY";
  return "OTHER";
}

export function destinationMatchingForRegion(destinationRegion: string): boolean {
  return journeyTypeForRegion(destinationRegion) === "CITY";
}

export function previewCompatibleInterest(
  groups: ShareInterestGroup[],
  request: InterestRequest
): PublicInterestGroupView | null {
  const origin = normalizePlace(request.origin);
  const destination = normalizePlace(request.destinationRegion);
  if (!origin.label || !destination.label || !request.travelDate) return null;
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

export function interestPublicNumber(origin: string, destination: string, travelDate: string, start: string, end: string): string {
  const o = origin.slice(0, 3).toUpperCase();
  const d = destination.slice(0, 3).toUpperCase();
  return `IG-${travelDate.replace(/-/g, "")}-${o}-${d}-${start.replace(":", "")}-${end.replace(":", "")}`;
}

export function timeLabelForWindow(start: string, end: string): string {
  if (start && start === end) return start;
  const mid = parseHmToMinutes(start);
  if (mid == null) return `${start}–${end}`;
  if (mid < 12 * 60) return "Morning";
  if (mid < 17 * 60) return "Afternoon";
  return "Evening";
}

export function resolveInterestWindow(input: InterestRequest): { start: string; end: string; preferred: string; flexibility: Flexibility } {
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

export function findCompatibleInterestGroup(
  groups: ShareInterestGroup[],
  request: {
    origin: string;
    destinationRegion: string;
    travelDate: string;
    timeWindowStart: string;
    timeWindowEnd: string;
    eventSlug?: string;
    publicNumber?: string;
  }
): ShareInterestGroup | null {
  const open = groups.filter(
    (row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW"
  );
  if (request.publicNumber) {
    return open.find((row) => row.publicNumber === request.publicNumber) || null;
  }
  if (request.eventSlug) {
    return open.find((row) => row.eventSlug === request.eventSlug) || null;
  }
  return (
    open.find(
      (row) =>
        !row.eventPublished &&
        !row.eventSlug &&
        row.origin === request.origin &&
        row.destinationRegion === request.destinationRegion &&
        row.travelDate === request.travelDate &&
        windowsOverlap(row.timeWindowStart, row.timeWindowEnd, request.timeWindowStart, request.timeWindowEnd)
    ) || null
  );
}

export function interestGroupStatusFromCount(count: number, threshold: number, current: InterestGroupStatus): InterestGroupStatus {
  if (current === "CONVERTED_TO_JOURNEY" || current === "EXPIRED" || current === "CANCELLED") return current;
  if (count >= threshold) return "READY_FOR_REVIEW";
  return "GATHERING_INTEREST";
}

export function toPublicInterestGroup(group: ShareInterestGroup): PublicInterestGroupView {
  const base: PublicInterestGroupView = {
    publicNumber: group.publicNumber,
    origin: group.origin,
    destinationRegion: group.destinationRegion,
    travelDate: group.travelDate,
    timeLabel: timeLabelForWindow(group.timeWindowStart, group.timeWindowEnd),
    interestedSeatCount: group.interestedSeatCount,
    status: group.status,
    journeyType: group.journeyType,
    ...publicInterestSafeFields(group),
  };
  if (group.journeyType === "EVENT") {
    return { ...base, ...eventPublicView(group, base) } as PublicInterestGroupView;
  }
  return base;
}

export function publicInterestHasPrivateData(value: unknown): boolean {
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

export function adminInterestDestinations(entries: ShareInterestEntry[]) {
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

export function isWaitlistWaiting(status: WaitlistStatus | string): boolean {
  return status === "WAITLISTED" || status === "WAITING";
}

export function waitlistJoinedAt(entry: Pick<ShareWaitlistEntry, "joinedWaitlistAt" | "createdAt">): string {
  return entry.joinedWaitlistAt || entry.createdAt;
}

export function fifoWaitlist<T extends { status: string; passengers: number; createdAt: string; joinedWaitlistAt?: string; id?: string }>(
  entries: T[],
  remaining: number
): T | null {
  if (remaining <= 0) return null;
  if (entries.some((row) => row.status === "OFFERED")) return null;
  return (
    entries
      .filter((row) => isWaitlistWaiting(row.status) && row.passengers <= remaining)
      .sort((a, b) => {
        const joined = waitlistJoinedAt(a).localeCompare(waitlistJoinedAt(b));
        if (joined !== 0) return joined;
        return String(a.id || "").localeCompare(String(b.id || ""));
      })[0] || null
  );
}

export function waitlistOrder(entries: ShareWaitlistEntry[]): ShareWaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const joined = waitlistJoinedAt(a).localeCompare(waitlistJoinedAt(b));
    if (joined !== 0) return joined;
    return a.id.localeCompare(b.id);
  });
}

export function derivedWaitlistPosition(entries: ShareWaitlistEntry[], entryId: string): number {
  const waiting = waitlistOrder(entries).filter((row) => isWaitlistWaiting(row.status) || row.status === "OFFERED");
  const index = waiting.findIndex((row) => row.id === entryId);
  return index >= 0 ? index + 1 : 0;
}

export function publicRemainingSeats(occupied: number, capacity: number, waitlistOfferOutstanding?: boolean): number {
  if (waitlistOfferOutstanding) return 0;
  return Math.max(0, capacity - occupied);
}
