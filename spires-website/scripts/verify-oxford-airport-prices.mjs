/**
 * Checks published Oxford airport fares and that nearby-town pages
 * do not inherit those prices automatically.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const website = join(import.meta.dirname, "..");
const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const code = readFileSync(join(website, "js/airport-prices.js"), "utf8");
const ctx = {
  window: {},
  document: {
    readyState: "complete",
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
  },
};
vm.runInNewContext(code, ctx);
const data = ctx.window.SPIRES_AIRPORT_PRICES;

assert(data.origin && data.origin.id === "oxford", "origin.id must be oxford");
assert(data.origin.name === "Oxford", "origin.name must be Oxford");

const expected = {
  heathrow: { standardCar: [92, 180], vito: [120, 235] },
  gatwick: { standardCar: [140, 270], vito: [175, 340] },
  stansted: { standardCar: [150, 290], vito: [185, 360] },
  luton: { standardCar: [105, 205], vito: [130, 255] },
  birmingham: { standardCar: [110, 215], vito: [145, 280] },
  londonCity: { standardCar: [150, 290], vito: [190, 370] },
  bristol: { standardCar: [165, 320], vito: [205, 400] },
};

for (const [id, classes] of Object.entries(expected)) {
  const route = data.routes[id];
  assert(!!route, "missing route " + id);
  assert(route.origin === "oxford", id + " origin must be oxford, got " + route.origin);
  assert(route.standardCar.oneWay === classes.standardCar[0], id + " SC one way");
  assert(route.standardCar.return === classes.standardCar[1], id + " SC return");
  assert(route.vito.oneWay === classes.vito[0], id + " 8s one way");
  assert(route.vito.return === classes.vito[1], id + " 8s return");
}

assert(
  JSON.stringify(Object.keys(expected)) ===
    JSON.stringify(["heathrow", "gatwick", "stansted", "luton", "birmingham", "londonCity", "bristol"]),
  "expected route order in test data"
);

const nearbyPages = [
  "abingdon-taxis.html",
  "bicester-taxis.html",
  "banbury-to-oxford-taxi.html",
];
for (const file of nearbyPages) {
  const html = readFileSync(join(website, file), "utf8");
  assert(!html.includes("£92"), file + " must not show Oxford Heathrow £92");
  assert(!html.includes("£180 return"), file + " must not show Oxford Heathrow return");
  assert(!html.includes("data-spires-price=\"heathrow"), file + " must not hydrate Oxford Heathrow prices");
  assert(html.toLowerCase().includes("quote"), file + " should still direct customers to a quote");
  assert(html.includes("subject to change"), file + " should say other-town prices are subject to change");
}

const home = readFileSync(join(website, "index.html"), "utf8");
assert(!/SPIRES TAXIS\s*·/i.test(home), "homepage must not have SPIRES TAXIS eyebrow");
assert(!home.includes("hero__label"), "homepage must not have a hero eyebrow");
assert(!home.includes("trust-strip"), "homepage must not have the lower trust strip");
const homeH1 = (home.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "";
assert(
  homeH1.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() ===
    "Spires Taxis. Book ahead with your price agreed before you travel.",
  "homepage H1"
);
assert(home.includes("Book online"), "homepage primary CTA");
assert(home.includes("WhatsApp for a quote"), "homepage WhatsApp CTA");
assert(home.includes("Call now"), "homepage call CTA");
assert(home.includes("Oxford to Stansted"), "homepage should feature Stansted");
assert(home.includes("Do not assume these prices apply"), "homepage should warn other towns not to assume Oxford fares");

const rates = readFileSync(join(website, "rates.html"), "utf8");
assert(rates.includes("Airport prices from Oxford"), "rates heading");
assert(rates.includes("Travelling from outside Oxford?"), "rates outside Oxford note");
assert(rates.includes("subject to change"), "rates should say other-town fares are subject to change");
assert(rates.includes("Do not assume these prices apply"), "rates should warn other towns not to assume Oxford fares");
assert(!rates.includes("From £92"), "do not use From £ on published Oxford fares");

const oldPrices = ["£95 one way", "£185 return", "£125 one way", "£245 return"];
for (const file of ["index.html", "rates.html", "airport-transfers.html", "oxford-to-heathrow-taxi.html"]) {
  const html = readFileSync(join(website, file), "utf8");
  for (const old of oldPrices) {
    assert(!html.includes(old), file + " still has old price " + old);
  }
}

const regional = ctx.window.SPIRES_REGIONAL_FARES;
const expectedRegional = {
  abingdon: {
    heathrow: { standardCar: [105, 205], vito: [138, 270] },
    gatwick: { standardCar: [150, 295], vito: [190, 375] },
    stansted: { standardCar: [160, 315], vito: [195, 380] },
    luton: { standardCar: [115, 225], vito: [150, 290] },
  },
  didcot: {
    heathrow: { standardCar: [110, 216], vito: [140, 275] },
    gatwick: { standardCar: [160, 310], vito: [205, 400] },
    stansted: { standardCar: [175, 340], vito: [215, 420] },
    luton: { standardCar: [130, 255], vito: [160, 310] },
  },
  bicester: {
    heathrow: { standardCar: [110, 205], vito: [140, 275] },
    gatwick: { standardCar: [160, 310], vito: [200, 290] },
    stansted: { standardCar: [165, 320], vito: [210, 410] },
    luton: { standardCar: [110, 215], vito: [142, 280] },
  },
  witney: {
    heathrow: { standardCar: [108, 212], vito: [140, 275] },
    gatwick: { standardCar: [160, 315], vito: [205, 395] },
    stansted: { standardCar: [172, 334], vito: [210, 410] },
    luton: { standardCar: [125, 240], vito: [155, 300] },
  },
};
for (const [originId, airports] of Object.entries(expectedRegional)) {
  const origin = regional[originId];
  assert(!!origin, "missing regional origin " + originId);
  for (const [airportId, classes] of Object.entries(airports)) {
    const route = origin.routes[airportId];
    assert(!!route, originId + " missing " + airportId);
    assert(route.standardCar.oneWay === classes.standardCar[0], originId + " " + airportId + " SC one way");
    assert(route.standardCar.return === classes.standardCar[1], originId + " " + airportId + " SC return");
    assert(route.vito.oneWay === classes.vito[0], originId + " " + airportId + " 8s one way");
    assert(route.vito.return === classes.vito[1], originId + " " + airportId + " 8s return");
  }
}
const bicesterGatwickEight = ctx.window.SPIRES_returnSaving(regional.bicester.routes.gatwick.vito);
assert(bicesterGatwickEight === 110, "Bicester Gatwick 8 Seater saving should calculate to 110, got " + bicesterGatwickEight);
assert(
  ctx.window.SPIRES_saveSentence(110) === "Save £110 compared with two one way bookings.",
  "saving sentence"
);

const columnHeading = "Standard Car one way";
const farePages = {
  "rates.html": ["oxford", "abingdon", "didcot", "bicester", "witney"],
  "airport-transfers.html": ["oxford"],
  "abingdon-airport-transfers.html": ["abingdon"],
  "didcot-airport-transfers.html": ["didcot"],
  "bicester-airport-transfers.html": ["bicester"],
  "witney-airport-transfers.html": ["witney"],
};
for (const [file, origins] of Object.entries(farePages)) {
  const html = readFileSync(join(website, file), "utf8");
  assert(html.includes(columnHeading), file + " missing shared column heading");
  assert(html.includes("8 Seater return"), file + " missing 8 Seater return column");
  assert(html.includes("Fares are fixed per vehicle and include the standard airport charge."), file + " missing fare note");
  for (const origin of origins) {
    assert(html.includes('data-spires-fare-table="' + origin + '"'), file + " missing table " + origin);
  }
}
assert(readFileSync(join(website, "bicester-airport-transfers.html"), "utf8").includes("Save £110 compared with two one way bookings."), "Bicester page should show the calculated £110 saving");
assert(readFileSync(join(website, "rates.html"), "utf8").includes("Save £110 compared with two one way bookings."), "rates page should show the calculated £110 saving");

const homeFares = readFileSync(join(website, "index.html"), "utf8");
assert(homeFares.includes("Fixed airport fares from Oxfordshire"), "homepage Oxfordshire fare heading");
assert(homeFares.includes("Heathrow one way fares"), "homepage Heathrow one way label");
assert(homeFares.includes('href="/abingdon-airport-transfers#airport-fares"'), "homepage Abingdon fare link");
assert(homeFares.includes('href="/didcot-airport-transfers#airport-fares"'), "homepage Didcot fare link");
assert(homeFares.includes('href="/bicester-airport-transfers#airport-fares"'), "homepage Bicester fare link");
assert(homeFares.includes('href="/witney-airport-transfers#airport-fares"'), "homepage Witney fare link");
assert(homeFares.includes('href="/rates#oxfordshire-airport-fares"'), "homepage rates link");
assert(homeFares.includes(">£105 <span>one way</span>"), "homepage Abingdon Heathrow one way");
assert(homeFares.includes(">£138 <span>one way</span>"), "homepage Abingdon 8 Seater");
assert(homeFares.includes(">£110 <span>one way</span>"), "homepage Didcot or Bicester Heathrow one way");
assert(homeFares.includes(">£108 <span>one way</span>"), "homepage Witney Heathrow one way");

if (failures.length) {
  console.error("FAILED:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log("Oxford airport fare scope checks passed.");
