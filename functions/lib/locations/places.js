"use strict";
/**
 * UK location search.
 *
 * Popular places use postcodes checked against postcodes.io on 7 November 2026.
 * Coordinates are read from that service at request time. They are not typed in by hand.
 * A Google Places API (New) key, GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY, adds street
 * and business results. Without a key, postcodes and the curated list still work.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURATED_PLACES = void 0;
exports.normalisePostcode = normalisePostcode;
exports.isUkPostcode = isUkPostcode;
exports.curatedMatches = curatedMatches;
exports.toSuggestion = toSuggestion;
exports.lookupPostcode = lookupPostcode;
exports.postcodeSuggestion = postcodeSuggestion;
exports.googlePredictions = googlePredictions;
exports.googlePlaceDetails = googlePlaceDetails;
exports.searchLocationSuggestions = searchLocationSuggestions;
/** Postcodes confirmed with postcodes.io. London Oxford Airport is Kidlington, not Heathrow. */
exports.CURATED_PLACES = [
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
function normalisePostcode(value) {
    const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (compact.length < 5)
        return value.toUpperCase().trim();
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}
function isUkPostcode(value) {
    return POSTCODE.test(value.trim());
}
function curatedMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return exports.CURATED_PLACES.filter((place) => POPULAR_IDS.includes(place.id));
    return exports.CURATED_PLACES.filter((place) => {
        const haystack = `${place.label} ${place.group} ${place.postcode}`.toLowerCase();
        if (q === "heathrow" || q === "lhr")
            return place.group === "Heathrow Airport";
        if (q === "gatwick" || q === "lgw")
            return place.group === "Gatwick Airport";
        return haystack.includes(q);
    }).slice(0, 8);
}
function toSuggestion(place, point) {
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
async function lookupPostcode(postcode, fetchImpl = fetch) {
    const code = normalisePostcode(postcode);
    if (!isUkPostcode(code))
        return null;
    const response = await fetchImpl(`https://api.postcodes.io/postcodes/${encodeURIComponent(code)}`);
    if (!response.ok)
        return null;
    const body = (await response.json());
    const latitude = Number(body.result?.latitude);
    const longitude = Number(body.result?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return null;
    return { latitude, longitude, postcode: body.result?.postcode || code };
}
function postcodeSuggestion(found) {
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
async function googlePredictions(query, apiKey, fetchImpl = fetch) {
    if (!apiKey || query.trim().length < 3)
        return [];
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
    if (!response.ok)
        return [];
    const body = (await response.json());
    return (body.suggestions || [])
        .map((row) => row.placePrediction)
        .filter((row) => Boolean(row?.text?.text))
        .slice(0, 6)
        .map((row) => ({
        id: `google-${row.placeId || row.text?.text}`,
        label: String(row.text?.text || ""),
        kind: "place",
        placeId: String(row.placeId || ""),
        postcode: "",
        latitude: null,
        longitude: null,
        needsProperty: false,
    }));
}
async function googlePlaceDetails(placeId, apiKey, fetchImpl = fetch) {
    if (!apiKey || !placeId || placeId.includes("/"))
        return null;
    const response = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
        },
    });
    if (!response.ok)
        return null;
    const body = (await response.json());
    const latitude = Number(body.location?.latitude);
    const longitude = Number(body.location?.longitude);
    const postcode = (body.addressComponents || []).find((part) => (part.types || []).includes("postal_code"))?.longText || "";
    const premise = (body.addressComponents || []).some((part) => (part.types || []).some((type) => ["street_number", "premise", "subpremise"].includes(type)));
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
async function searchLocationSuggestions(input) {
    const fetchImpl = input.fetchImpl || fetch;
    const query = input.query.trim();
    const curated = curatedMatches(query);
    const points = await Promise.all(curated.map(async (place) => {
        try {
            return await lookupPostcode(place.postcode, fetchImpl);
        }
        catch {
            return null;
        }
    }));
    const curatedSuggestions = curated.map((place, index) => toSuggestion(place, points[index]));
    let google = [];
    if (input.apiKey && query.length >= 3) {
        try {
            google = await googlePredictions(query, input.apiKey, fetchImpl);
        }
        catch {
            google = [];
        }
    }
    if (isUkPostcode(query)) {
        try {
            const found = await lookupPostcode(query, fetchImpl);
            if (found)
                curatedSuggestions.unshift(postcodeSuggestion(found));
        }
        catch {
            /* manual entry remains available */
        }
    }
    const seen = new Set();
    const suggestions = [...curatedSuggestions, ...google].filter((row) => {
        const key = row.label.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    }).slice(0, 8);
    return { provider: google.length ? "google" : "curated", suggestions };
}
