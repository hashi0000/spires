/**
 * UK location search.
 *
 * Popular places use postcodes checked against postcodes.io on 7 November 2026.
 * Coordinates are read from that service at request time. They are not typed in by hand.
 * A Google Places API (New) key, GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY, adds street
 * and business results. Without a key, postcodes and the curated list still work.
 */

export type LocationSuggestion = {
  id: string;
  label: string;
  kind: "place" | "postcode" | "terminal";
  placeId: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  needsProperty: boolean;
};

export type CuratedPlace = {
  id: string;
  label: string;
  postcode: string;
  kind: "place" | "terminal";
  group: string;
};

/** Postcodes confirmed with postcodes.io. London Oxford Airport is Kidlington, not Heathrow. */
export const CURATED_PLACES: CuratedPlace[] = [
  { id: "heathrow-t2", label: "Heathrow Terminal 2", postcode: "TW6 1EW", kind: "terminal", group: "Heathrow Airport" },
  { id: "heathrow-t3", label: "Heathrow Terminal 3", postcode: "TW6 1QG", kind: "terminal", group: "Heathrow Airport" },
  { id: "heathrow-t4", label: "Heathrow Terminal 4", postcode: "TW6 3XA", kind: "terminal", group: "Heathrow Airport" },
  { id: "heathrow-t5", label: "Heathrow Terminal 5", postcode: "TW6 2GA", kind: "terminal", group: "Heathrow Airport" },
  { id: "gatwick-north", label: "Gatwick North Terminal", postcode: "RH6 0PJ", kind: "terminal", group: "Gatwick Airport" },
  { id: "gatwick-south", label: "Gatwick South Terminal", postcode: "RH6 0NP", kind: "terminal", group: "Gatwick Airport" },
  { id: "stansted", label: "London Stansted Airport", postcode: "CM24 1QW", kind: "place", group: "Airports" },
  { id: "luton", label: "London Luton Airport", postcode: "LU2 9LY", kind: "place", group: "Airports" },
  { id: "birmingham", label: "Birmingham Airport", postcode: "B26 3QJ", kind: "place", group: "Airports" },
  { id: "bristol", label: "Bristol Airport", postcode: "BS48 3DY", kind: "place", group: "Airports" },
  { id: "london-city", label: "London City Airport", postcode: "E16 2PX", kind: "place", group: "Airports" },
  { id: "london-oxford", label: "London Oxford Airport, Kidlington", postcode: "OX5 1RA", kind: "place", group: "Airports" },
  { id: "oxford-station", label: "Oxford Station", postcode: "OX1 1HS", kind: "place", group: "Stations" },
  { id: "twickenham", label: "Allianz Stadium, Twickenham", postcode: "TW2 7BA", kind: "place", group: "Venues" },
  { id: "silverstone", label: "Silverstone Circuit", postcode: "NN12 8TN", kind: "place", group: "Venues" },
];

const POPULAR_IDS = ["heathrow-t2", "heathrow-t3", "heathrow-t4", "heathrow-t5", "gatwick-south", "gatwick-north", "oxford-station", "london-oxford"];

const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normalisePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5) return value.toUpperCase().trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isUkPostcode(value: string): boolean {
  return POSTCODE.test(value.trim());
}

export function curatedMatches(query: string): CuratedPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURATED_PLACES.filter((place) => POPULAR_IDS.includes(place.id));
  return CURATED_PLACES.filter((place) => {
    const haystack = `${place.label} ${place.group} ${place.postcode}`.toLowerCase();
    if (q === "heathrow" || q === "lhr") return place.group === "Heathrow Airport";
    if (q === "gatwick" || q === "lgw") return place.group === "Gatwick Airport";
    return haystack.includes(q);
  }).slice(0, 8);
}

export function toSuggestion(
  place: CuratedPlace,
  point: { latitude: number; longitude: number } | null
): LocationSuggestion {
  return {
    id: place.id,
    label: `${place.label}, ${place.postcode}`,
    kind: place.kind,
    placeId: "",
    postcode: place.postcode,
    latitude: point ? point.latitude : null,
    longitude: point ? point.longitude : null,
    needsProperty: false,
  };
}

type PostcodeResult = { latitude: number; longitude: number; postcode: string } | null;

export async function lookupPostcode(
  postcode: string,
  fetchImpl: typeof fetch = fetch
): Promise<PostcodeResult> {
  const code = normalisePostcode(postcode);
  if (!isUkPostcode(code)) return null;
  const response = await fetchImpl(`https://api.postcodes.io/postcodes/${encodeURIComponent(code)}`);
  if (!response.ok) return null;
  const body = (await response.json()) as { result?: { latitude?: number; longitude?: number; postcode?: string } };
  const latitude = Number(body.result?.latitude);
  const longitude = Number(body.result?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, postcode: body.result?.postcode || code };
}

export function postcodeSuggestion(found: { latitude: number; longitude: number; postcode: string }): LocationSuggestion {
  return {
    id: `postcode-${found.postcode.replace(/\s/g, "")}`,
    label: found.postcode,
    kind: "postcode",
    placeId: "",
    postcode: found.postcode,
    latitude: found.latitude,
    longitude: found.longitude,
    needsProperty: true,
  };
}

type GooglePrediction = { placeId?: string; text?: { text?: string } };

export async function googlePredictions(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<LocationSuggestion[]> {
  if (!apiKey || query.trim().length < 3) return [];
  const response = await fetchImpl("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      input: query.trim(),
      includedRegionCodes: ["gb"],
      languageCode: "en",
    }),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { suggestions?: Array<{ placePrediction?: GooglePrediction }> };
  return (body.suggestions || [])
    .map((row) => row.placePrediction)
    .filter((row): row is GooglePrediction => Boolean(row?.text?.text))
    .slice(0, 6)
    .map((row) => ({
      id: `google-${row.placeId || row.text?.text}`,
      label: String(row.text?.text || ""),
      kind: "place" as const,
      placeId: String(row.placeId || ""),
      postcode: "",
      latitude: null,
      longitude: null,
      needsProperty: false,
    }));
}

export async function googlePlaceDetails(
  placeId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<LocationSuggestion | null> {
  if (!apiKey || !placeId || placeId.includes("/")) return null;
  const response = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    id?: string;
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: Array<{ longText?: string; types?: string[] }>;
  };
  const latitude = Number(body.location?.latitude);
  const longitude = Number(body.location?.longitude);
  const postcode = (body.addressComponents || []).find((part) => (part.types || []).includes("postal_code"))?.longText || "";
  const premise = (body.addressComponents || []).some((part) =>
    (part.types || []).some((type) => ["street_number", "premise", "subpremise"].includes(type))
  );
  return {
    id: `google-${body.id || placeId}`,
    label: body.formattedAddress || "",
    kind: "place",
    placeId: body.id || placeId,
    postcode,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    needsProperty: Boolean(postcode) && !premise,
  };
}

export async function searchLocationSuggestions(input: {
  query: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ provider: "google" | "curated"; suggestions: LocationSuggestion[] }> {
  const fetchImpl = input.fetchImpl || fetch;
  const query = input.query.trim();
  const curated = curatedMatches(query);
  const points = await Promise.all(
    curated.map(async (place) => {
      try {
        return await lookupPostcode(place.postcode, fetchImpl);
      } catch {
        return null;
      }
    })
  );
  const curatedSuggestions = curated.map((place, index) => toSuggestion(place, points[index]));
  let google: LocationSuggestion[] = [];
  if (input.apiKey && query.length >= 3) {
    try {
      google = await googlePredictions(query, input.apiKey, fetchImpl);
    } catch {
      google = [];
    }
  }
  if (isUkPostcode(query)) {
    try {
      const found = await lookupPostcode(query, fetchImpl);
      if (found) curatedSuggestions.unshift(postcodeSuggestion(found));
    } catch {
      /* manual entry remains available */
    }
  }
  const seen = new Set<string>();
  const suggestions = [...curatedSuggestions, ...google].filter((row) => {
    const key = row.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  return { provider: google.length ? "google" : "curated", suggestions };
}
