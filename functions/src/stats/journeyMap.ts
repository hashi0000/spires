import { JourneyBooking, isCompletedJourneyBooking, londonMonthKey } from "./journeyStats";

/**
 * Public journey map.
 * Coordinates come from postcodes.io outward-code centroids at aggregation time.
 * They are not copied from a booking and they are not typed in here.
 */

const SENSITIVE = /school|nursery|college run/i;
const FULL_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/i;
const OUTCODE_ONLY = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

type PlaceKind = "airport" | "area";

type PlaceRule = { label: string; outcode: string; test: RegExp; exclude?: RegExp };

const AIRPORTS: PlaceRule[] = [
  { label: "Heathrow", outcode: "TW6", test: /heathrow|\blhr\b/i },
  { label: "Gatwick", outcode: "RH6", test: /gatwick|\blgw\b/i },
  { label: "Stansted", outcode: "CM24", test: /stansted|\bstn\b/i },
  { label: "Luton Airport", outcode: "LU2", test: /luton airport|london luton|\bltn\b/i },
  { label: "Birmingham Airport", outcode: "B26", test: /birmingham airport|\bbhx\b/i },
  { label: "Bristol Airport", outcode: "BS48", test: /bristol airport|\bbrs\b/i },
  { label: "London City Airport", outcode: "E16", test: /london city airport|\blcy\b/i },
  { label: "London Oxford Airport", outcode: "OX5", test: /london oxford airport|kidlington airport|oxford airport/i },
];

const TOWNS: PlaceRule[] = [
  { label: "Abingdon", outcode: "OX14", test: /\babingdon\b/i },
  { label: "Didcot", outcode: "OX11", test: /\bdidcot\b/i },
  { label: "Bicester", outcode: "OX26", test: /\bbicester\b/i },
  { label: "Witney", outcode: "OX28", test: /\bwitney\b/i },
  { label: "Banbury", outcode: "OX16", test: /\bbanbury\b/i },
  { label: "Kidlington", outcode: "OX5", test: /\bkidlington\b/i, exclude: /airport/i },
  { label: "Wantage", outcode: "OX12", test: /\bwantage\b/i },
  { label: "Wallingford", outcode: "OX10", test: /\bwallingford\b/i },
  { label: "Thame", outcode: "OX9", test: /\bthame\b/i },
  { label: "Woodstock", outcode: "OX20", test: /\bwoodstock\b/i },
  { label: "Oxford", outcode: "OX1", test: /\boxford\b/i, exclude: /london oxford airport|oxford airport/i },
];

export type ApproxPlace = { label: string; outcode: string; kind: PlaceKind };

export type PublicJourneyRoute = {
  date: string;
  from: string;
  to: string;
  fromKind: PlaceKind;
  toKind: PlaceKind;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
};

export type JourneyMapMonth = {
  key: string;
  label: string;
  completedJourneys: number;
  mappedJourneys: number;
  destinations: string[];
  airports: string[];
  routes: PublicJourneyRoute[];
};

export type JourneyMapDraftRoute = {
  date: string;
  from: string;
  to: string;
  fromKind: PlaceKind;
  toKind: PlaceKind;
  fromOutcode: string;
  toOutcode: string;
};

export type JourneyMapMonthDraft = {
  key: string;
  label: string;
  completedJourneys: number;
  destinations: string[];
  airports: string[];
  routes: JourneyMapDraftRoute[];
};

type Point = { lat: number; lng: number };

function endText(booking: JourneyBooking, end: "from" | "to", leg: "out" | "return"): string {
  if (leg === "return") {
    const place = end === "from" ? booking.returnPickupLocation || booking.destination : booking.returnDestination || booking.pickup || booking.pickupLocation;
    return String(place || "");
  }
  if (end === "from") {
    return [booking.pickupPlace?.label, booking.pickupPlace?.postcode, booking.pickupLocation, booking.pickup].filter(Boolean).join(" ");
  }
  return [booking.destinationPlace?.label, booking.destinationPlace?.postcode, booking.destination].filter(Boolean).join(" ");
}

export function outwardCode(value: string): string | null {
  const full = value.toUpperCase().match(FULL_POSTCODE);
  if (full) return full[1].replace(/\s+/g, "");
  const trimmed = value.trim().toUpperCase();
  if (OUTCODE_ONLY.test(trimmed)) return trimmed;
  return null;
}

function matchRule(text: string, rules: PlaceRule[]): PlaceRule | null {
  for (const rule of rules) {
    if (rule.exclude && rule.exclude.test(text)) continue;
    if (rule.test.test(text)) return rule;
  }
  return null;
}

/** Town, airport, or postcode district. Never a street or house number. */
export function approximatePlace(value: string): ApproxPlace | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || SENSITIVE.test(text)) return null;
  const airport = matchRule(text, AIRPORTS);
  if (airport) return { label: airport.label, outcode: airport.outcode, kind: "airport" };
  const district = outwardCode(text);
  const town = matchRule(text, TOWNS);
  if (district) {
    return { label: town?.label || district, outcode: district, kind: "area" };
  }
  if (town) return { label: town.label, outcode: town.outcode, kind: "area" };
  return null;
}

export function londonDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

function isSynthetic(booking: JourneyBooking): boolean {
  if ((booking as { syntheticMeasurementTest?: boolean }).syntheticMeasurementTest === true) return true;
  if (/^synthetic-measurement-/i.test(String(booking.id || ""))) return true;
  if (/synthetic measurement test/i.test(String(booking.notes || ""))) return true;
  return false;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function draftJourneyMap(bookings: JourneyBooking[]): JourneyMapMonthDraft[] {
  const months = new Map<string, JourneyMapMonthDraft>();
  const seen = new Set<string>();

  for (const booking of bookings) {
    if (isSynthetic(booking) || !isCompletedJourneyBooking(booking)) continue;
    const isReturn = booking.bookingType === "return" || booking.returnTrip === true;
    const legs: Array<{ role: string; when: string | null | undefined; from: string; to: string }> = [
      {
        role: "out",
        when: booking.pickupTime || booking.dateTime,
        from: endText(booking, "from", "out"),
        to: endText(booking, "to", "out"),
      },
    ];
    if (isReturn && (booking.returnPickupTime || booking.returnDateTime)) {
      legs.push({
        role: "return",
        when: booking.returnPickupTime || booking.returnDateTime,
        from: endText(booking, "from", "return"),
        to: endText(booking, "to", "return"),
      });
    }
    for (const leg of legs) {
      const key = londonMonthKey(leg.when);
      const date = londonDateKey(leg.when);
      if (!key || !date) continue;
      const identity = `${booking.id || booking.bookingNumber || ""}|${leg.role}|${leg.when}|${leg.from}|${leg.to}`.toLowerCase();
      if (seen.has(identity)) continue;
      seen.add(identity);
      let month = months.get(key);
      if (!month) {
        month = { key, label: monthLabel(key), completedJourneys: 0, destinations: [], airports: [], routes: [] };
        months.set(key, month);
      }
      month.completedJourneys += 1;
      if (SENSITIVE.test(`${leg.from} ${leg.to}`)) continue;
      const from = approximatePlace(leg.from);
      const to = approximatePlace(leg.to);
      if (!from || !to) continue;
      month.routes.push({
        date,
        from: from.label,
        to: to.label,
        fromKind: from.kind,
        toKind: to.kind,
        fromOutcode: from.outcode,
        toOutcode: to.outcode,
      });
    }
  }

  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function materialiseJourneyMap(
  drafts: JourneyMapMonthDraft[],
  points: Map<string, Point>
): { latest: string | null; months: JourneyMapMonth[] } {
  const months = drafts.map((draft) => {
    const routes: PublicJourneyRoute[] = [];
    for (const route of draft.routes) {
      const from = points.get(route.fromOutcode);
      const to = points.get(route.toOutcode);
      if (!from || !to) continue;
      if (from.lat === to.lat && from.lng === to.lng) continue;
      routes.push({
        date: route.date,
        from: route.from,
        to: route.to,
        fromKind: route.fromKind,
        toKind: route.toKind,
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
      });
    }
    routes.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    const airports = sortedUnique(
      routes.flatMap((route) => [
        route.fromKind === "airport" ? route.from : "",
        route.toKind === "airport" ? route.to : "",
      ]).filter(Boolean)
    );
    const destinations = sortedUnique(routes.map((route) => route.to));
    return {
      key: draft.key,
      label: draft.label,
      completedJourneys: draft.completedJourneys,
      mappedJourneys: routes.length,
      destinations,
      airports,
      routes,
    };
  });
  return { latest: months[0]?.key || null, months };
}

export async function lookupOutcodePoints(
  codes: string[],
  fetcher: typeof fetch = fetch
): Promise<Map<string, Point>> {
  const points = new Map<string, Point>();
  const unique = [...new Set(codes.map((code) => code.toUpperCase()))];
  for (let i = 0; i < unique.length; i += 6) {
    const batch = unique.slice(i, i + 6);
    await Promise.all(batch.map(async (code) => {
      try {
        const response = await fetcher(`https://api.postcodes.io/outcodes/${encodeURIComponent(code)}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return;
        const body = await response.json() as { status?: number; result?: { latitude?: number; longitude?: number } };
        const lat = Number(body.result?.latitude);
        const lng = Number(body.result?.longitude);
        if (body.status !== 200 || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (lat < 49 || lat > 61 || lng < -8.5 || lng > 2) return;
        points.set(code, { lat: roundCoord(lat), lng: roundCoord(lng) });
      } catch {
        /* a missing district is left unmapped rather than guessed */
      }
    }));
  }
  return points;
}

export function outcodesIn(drafts: JourneyMapMonthDraft[]): string[] {
  const codes = new Set<string>();
  for (const month of drafts) {
    for (const route of month.routes) {
      codes.add(route.fromOutcode);
      codes.add(route.toOutcode);
    }
  }
  return [...codes];
}

export function defaultMapMonth(keys: string[], now: Date): string | null {
  const sorted = [...new Set(keys)].filter((key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key)).sort();
  if (!sorted.length) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const current = year && month ? `${year}-${month}` : "";
  const finished = sorted.filter((key) => key < current);
  return finished[finished.length - 1] || sorted[sorted.length - 1];
}

export function publicJourneyMapView(
  stored: { latest: string | null; updatedAt: string; months: Array<Omit<JourneyMapMonth, "routes">> },
  month: JourneyMapMonth | null,
  selected: string | null
): Record<string, unknown> {
  if (!stored.latest || !selected || !month) return { ok: true, show: false };
  return {
    ok: true,
    show: true,
    updatedAt: stored.updatedAt,
    latest: stored.latest,
    selected,
    months: stored.months.map((row) => ({ key: row.key, label: row.label })),
    completedJourneys: month.completedJourneys,
    mappedJourneys: month.mappedJourneys,
    destinations: month.destinations,
    airports: month.airports,
    routes: month.routes.map((route) => ({
      date: route.date,
      from: route.from,
      to: route.to,
      fromKind: route.fromKind,
      toKind: route.toKind,
      fromLat: route.fromLat,
      fromLng: route.fromLng,
      toLat: route.toLat,
      toLng: route.toLng,
    })),
  };
}
