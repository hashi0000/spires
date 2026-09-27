/**
 * Cached UK average petrol / diesel prices.
 *
 * Source: Department for Energy Security and Net Zero (DESNZ)
 * Weekly road fuel prices — Open Government Licence.
 *
 * Informational only. Never used to calculate airport fares.
 *
 * Official page:
 * https://www.gov.uk/government/statistics/weekly-road-fuel-prices
 */

const GOVUK_PAGE = "https://www.gov.uk/government/statistics/weekly-road-fuel-prices";
const SOURCE_LABEL = "UK Government weekly road fuel prices (DESNZ)";
const USER_AGENT =
  "SpiresTaxisFuelTracker/1.0 (+https://www.spires-taxis.com; bookings@spires-taxis.com)";

const CACHE_MS = 12 * 60 * 60 * 1000;
const MIN_PENCE = 50;
const MAX_PENCE = 400;

let memoryCache = null;

function json(res, status, body, cacheControl) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Cache-Control",
    cacheControl || "public, s-maxage=43200, stale-while-revalidate=1209600"
  );
  res.end(JSON.stringify(body));
}

function isSanePence(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_PENCE && value <= MAX_PENCE;
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let latest = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;
    const weekDate = (cols[0] || "").trim();
    const petrol = Number(cols[1]);
    const diesel = Number(cols[2]);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(weekDate)) continue;
    if (!isSanePence(petrol) || !isSanePence(diesel)) continue;
    latest = { weekDate, petrolPence: petrol, dieselPence: diesel };
  }
  return latest;
}

function pickCurrentCsvUrl(html) {
  const matches = String(html || "").match(
    /https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[a-z0-9]+\/[^"'>\s]*\.csv/gi
  );
  if (!matches || !matches.length) return null;
  const current = matches.find(
    (url) => /2018/i.test(url) && !/2003/i.test(url) && !/2017/i.test(url)
  );
  return current || matches[0];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/csv,text/html,application/octet-stream;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error("Upstream HTTP " + response.status);
  }
  return response.text();
}

async function loadOfficialPrices() {
  const page = await fetchText(GOVUK_PAGE);
  const csvUrl = pickCurrentCsvUrl(page);
  if (!csvUrl) throw new Error("CSV attachment not found");
  const csv = await fetchText(csvUrl);
  const parsed = parseCsv(csv);
  if (!parsed) throw new Error("No valid fuel-price rows");
  return {
    available: true,
    petrolPence: parsed.petrolPence,
    dieselPence: parsed.dieselPence,
    weekCommencing: parsed.weekDate,
    fetchedAt: new Date().toISOString(),
    sourceName: SOURCE_LABEL,
    sourceUrl: GOVUK_PAGE,
    csvUrl,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.end();
    return;
  }

  if (req.method && req.method !== "GET") {
    json(res, 405, { available: false }, "no-store");
    return;
  }

  const now = Date.now();
  if (memoryCache && now - memoryCache.cachedAt < CACHE_MS) {
    json(res, 200, memoryCache.payload);
    return;
  }

  try {
    const payload = await loadOfficialPrices();
    memoryCache = { cachedAt: now, payload };
    json(res, 200, payload);
  } catch (err) {
    if (memoryCache && memoryCache.payload && memoryCache.payload.available) {
      json(res, 200, memoryCache.payload, "public, s-maxage=300, stale-while-revalidate=1209600");
      return;
    }
    json(
      res,
      200,
      { available: false },
      "public, s-maxage=300, stale-while-revalidate=3600"
    );
  }
};
