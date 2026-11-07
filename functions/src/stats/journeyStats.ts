import { effectiveWorkflowStatus } from "../quotes/quoteWorkflow";

export type JourneyBooking = {
  id?: string;
  status?: string | null;
  adminStatus?: string | null;
  customerStatus?: string | null;
  source?: string | null;
  bookingNumber?: string | null;
  notes?: string | null;
  test?: boolean | null;
  bookingType?: string | null;
  returnTrip?: boolean | null;
  pickupTime?: string | null;
  dateTime?: string | null;
  returnPickupTime?: string | null;
  returnDateTime?: string | null;
  pickup?: string | null;
  pickupLocation?: string | null;
  destination?: string | null;
  returnPickupLocation?: string | null;
  returnDestination?: string | null;
  pickupPlace?: { label?: string; postcode?: string } | null;
  destinationPlace?: { label?: string; postcode?: string } | null;
};

type PlaceGroup = { id: string; label: string; test: RegExp; exclude?: RegExp };

const AIRPORTS: PlaceGroup[] = [
  { id: "heathrow", label: "Heathrow", test: /heathrow|\blhr\b|tw6\s*1|tw6\s*2|tw6\s*3/i },
  { id: "gatwick", label: "Gatwick", test: /gatwick|\blgw\b/i },
  { id: "stansted", label: "Stansted", test: /stansted|\bstn\b/i },
  { id: "luton", label: "Luton Airport", test: /luton airport|london luton|\bltn\b/i },
  { id: "birmingham", label: "Birmingham Airport", test: /birmingham airport|\bbhx\b/i },
  { id: "bristol", label: "Bristol Airport", test: /bristol airport|\bbrs\b/i },
  { id: "london-city", label: "London City Airport", test: /london city airport|\blcy\b/i },
  { id: "london-oxford", label: "London Oxford Airport", test: /london oxford airport|kidlington airport|oxford airport|\box5\s*1ra\b/i },
];

const AREAS: PlaceGroup[] = [
  { id: "abingdon", label: "Abingdon", test: /\babingdon\b/i },
  { id: "didcot", label: "Didcot", test: /\bdidcot\b/i },
  { id: "bicester", label: "Bicester", test: /\bbicester\b/i },
  { id: "witney", label: "Witney", test: /\bwitney\b/i },
  { id: "banbury", label: "Banbury", test: /\bbanbury\b/i },
  { id: "kidlington", label: "Kidlington", test: /\bkidlington\b/i, exclude: /airport/i },
  { id: "oxford", label: "Oxford", test: /\boxford\b/i, exclude: /london oxford airport|oxford airport/i },
];

const SENSITIVE = /school|nursery|college run/i;
export const MIN_PUBLIC_CATEGORY = 5;

export function londonParts(date: Date): { year: number; month: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!year || !month) return null;
  return { year, month };
}

export function previousCalendarMonth(now: Date): { key: string; label: string } {
  const parts = londonParts(now) || { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const month = parts.month === 1 ? 12 : parts.month - 1;
  const year = parts.month === 1 ? parts.year - 1 : parts.year;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return { key, label };
}

export function londonMonthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = londonParts(new Date(value));
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function textOf(booking: JourneyBooking, end: "from" | "to", leg: "out" | "return"): string {
  if (leg === "return") {
    const place = end === "from" ? booking.returnPickupLocation || booking.destination : booking.returnDestination || booking.pickup || booking.pickupLocation;
    return String(place || "");
  }
  if (end === "from") {
    return [booking.pickupPlace?.label, booking.pickupPlace?.postcode, booking.pickupLocation, booking.pickup].filter(Boolean).join(" ");
  }
  return [booking.destinationPlace?.label, booking.destinationPlace?.postcode, booking.destination].filter(Boolean).join(" ");
}

function matchGroup(text: string, groups: PlaceGroup[]): PlaceGroup | null {
  for (const group of groups) {
    if (group.exclude && group.exclude.test(text)) continue;
    if (group.test.test(text)) return group;
  }
  return null;
}

export function isCompletedJourneyBooking(booking: JourneyBooking): boolean {
  if (booking.test === true || booking.source === "test") return false;
  if (/^test/i.test(String(booking.bookingNumber || ""))) return false;
  if (/\btest booking\b/i.test(String(booking.notes || ""))) return false;
  return effectiveWorkflowStatus(booking) === "completed";
}

export type PublicJourneyStats = {
  periodKey: string;
  periodLabel: string;
  completedJourneys: number;
  airports: Record<string, number>;
  areas: Record<string, number>;
  highlights: Array<{ id: string; label: string; count: number }>;
  unclassified: number;
  withheld: number;
  updatedAt: string;
};

export function summariseJourneys(bookings: JourneyBooking[], now: Date, updatedAt: string): PublicJourneyStats {
  const period = previousCalendarMonth(now);
  const airports: Record<string, number> = {};
  const areas: Record<string, number> = {};
  const airportLabels = new Map(AIRPORTS.map((group) => [group.id, group.label]));
  const areaLabels = new Map(AREAS.map((group) => [group.id, group.label]));
  let completedJourneys = 0;
  let unclassified = 0;
  let withheld = 0;
  const seen = new Set<string>();

  for (const booking of bookings) {
    if (!isCompletedJourneyBooking(booking)) continue;
    const isReturn = booking.bookingType === "return" || booking.returnTrip === true;
    const legs: Array<{ when: string | null | undefined; from: string; to: string; role: string }> = [
      {
        role: "out",
        when: booking.pickupTime || booking.dateTime,
        from: textOf(booking, "from", "out"),
        to: textOf(booking, "to", "out"),
      },
    ];
    if (isReturn && (booking.returnPickupTime || booking.returnDateTime)) {
      legs.push({
        role: "return",
        when: booking.returnPickupTime || booking.returnDateTime,
        from: textOf(booking, "from", "return"),
        to: textOf(booking, "to", "return"),
      });
    }
    for (const leg of legs) {
      if (londonMonthKey(leg.when) !== period.key) continue;
      const identity = `${booking.id || booking.bookingNumber || ""}|${leg.role}|${leg.when}|${leg.from}|${leg.to}`.toLowerCase();
      if (seen.has(identity)) continue;
      seen.add(identity);
      completedJourneys += 1;
      const combined = `${leg.from} ${leg.to}`;
      if (SENSITIVE.test(combined)) {
        withheld += 1;
        continue;
      }
      const airport = matchGroup(combined, AIRPORTS);
      const fromArea = matchGroup(leg.from, AREAS);
      const toArea = matchGroup(leg.to, AREAS);
      const areaIds = new Set([fromArea?.id, toArea?.id].filter(Boolean) as string[]);
      if (!airport && areaIds.size === 0) unclassified += 1;
      if (airport) airports[airport.id] = (airports[airport.id] || 0) + 1;
      for (const id of areaIds) areas[id] = (areas[id] || 0) + 1;
    }
  }

  const highlights: PublicJourneyStats["highlights"] = [];
  for (const [id, count] of Object.entries(airports)) {
    if (count >= MIN_PUBLIC_CATEGORY) highlights.push({ id, label: airportLabels.get(id) || id, count });
  }
  for (const [id, count] of Object.entries(areas)) {
    if (count >= MIN_PUBLIC_CATEGORY) highlights.push({ id, label: areaLabels.get(id) || id, count });
  }
  highlights.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    periodKey: period.key,
    periodLabel: period.label,
    completedJourneys,
    airports,
    areas,
    highlights: highlights.slice(0, 4),
    unclassified,
    withheld,
    updatedAt,
  };
}

export function publicJourneyView(stats: PublicJourneyStats | null): Record<string, unknown> {
  if (!stats || !stats.periodKey || stats.completedJourneys <= 0) return { ok: true, show: false };
  const airports = Object.fromEntries(Object.entries(stats.airports || {}).filter(([, count]) => count >= MIN_PUBLIC_CATEGORY));
  const areas = Object.fromEntries(Object.entries(stats.areas || {}).filter(([, count]) => count >= MIN_PUBLIC_CATEGORY));
  return {
    ok: true,
    show: true,
    periodKey: stats.periodKey,
    periodLabel: stats.periodLabel,
    completedJourneys: stats.completedJourneys,
    airports,
    areas,
    highlights: (stats.highlights || []).filter((row) => row.count >= MIN_PUBLIC_CATEGORY).slice(0, 4),
    updatedAt: stats.updatedAt,
  };
}
