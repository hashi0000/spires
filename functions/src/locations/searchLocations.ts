import * as functions from "firebase-functions/v1";
import { googlePlaceDetails, searchLocationSuggestions } from "./places";

function apiKey(): string {
  const fromEnv = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  if (fromEnv) return fromEnv;
  try {
    const configured = functions.config().google?.places_key || functions.config().places?.key;
    return configured ? String(configured) : "";
  } catch {
    return "";
  }
}

function cors(res: functions.Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

/** Public location search. The API key stays on the server. */
export const searchLocations = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Use GET." });
    return;
  }
  const placeId = String(req.query.placeId || "").trim();
  const query = String(req.query.q || "").trim().slice(0, 120);
  try {
    if (placeId) {
      const details = await googlePlaceDetails(placeId, apiKey());
      res.json({ ok: true, suggestion: details });
      return;
    }
    const result = await searchLocationSuggestions({ query, apiKey: apiKey() });
    res.json({ ok: true, provider: result.provider, suggestions: result.suggestions });
  } catch {
    res.json({ ok: true, provider: "curated", suggestions: [] });
  }
});
