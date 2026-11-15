/**
 * Heathrow-only Executive checks for the customer form.
 * Keep the area fares and wording aligned with functions/src/quotes/executiveService.ts
 * and spires-website/js/airport-prices.js. The server rejects a journey this check misses.
 */

const OTHER_AIRPORT =
  /\b(gatwick|stansted|luton|birmingham airport|bristol airport|london city(?: airport)?|east midlands|london oxford airport|lgw|stn|ltn|bhx|brs|lcy|ema)\b/i;
const HEATHROW = /\b(heathrow|lhr)\b/i;
const SPECIFIC = [
  ["abingdon", /\babingdon\b/i],
  ["didcot", /\bdidcot\b/i],
  ["bicester", /\bbicester\b/i],
  ["witney", /\bwitney\b/i],
];
const FARES = {
  oxford: { oneWay: 150, return: 290 },
  abingdon: { oneWay: 165, return: 320 },
  didcot: { oneWay: 170, return: 330 },
  bicester: { oneWay: 170, return: 330 },
  witney: { oneWay: 170, return: 330 },
};

function textOf(journey) {
  const parts = [];
  const add = (value) => {
    if (!value) return;
    if (typeof value === "string") parts.push(value);
    else if (value.address) parts.push(value.address);
  };
  add(journey.pickup);
  add(journey.destination);
  add(journey.returnPickup);
  add(journey.returnDestination);
  (journey.stops || []).forEach(add);
  (journey.returnStops || []).forEach(add);
  return parts.join("\n");
}

export function classifyExecutiveJourney(journey) {
  const text = textOf(journey || {});
  if (!HEATHROW.test(text)) {
    return { ok: false, error: "Executive Car is only available for Heathrow transfers." };
  }
  if (OTHER_AIRPORT.test(text)) {
    return { ok: true, fareStatus: "quote_required", proposed: null };
  }
  const specific = SPECIFIC.filter((row) => row[1].test(text)).map((row) => row[0]);
  const area = specific.length === 1 ? specific[0] : specific.length === 0 && /\boxford\b/i.test(text) ? "oxford" : null;
  if (!area) return { ok: true, fareStatus: "quote_required", proposed: null };
  const prices = FARES[area];
  return {
    ok: true,
    fareStatus: "published",
    proposed: journey.bookingType === "return" ? prices.return : prices.oneWay,
  };
}
