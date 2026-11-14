import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wa = require("./whatsapp-route.js");

const OUTBOUND_FIELDS = [
  "Travel date:",
  "Preferred pickup time:",
  "Pickup address:",
  "Destination / terminal:",
  "Passengers:",
  "Luggage:",
  "One way or return:",
  "Could you please confirm availability?"
];

const INBOUND_FIELDS = [
  "Arrival date:",
  "Flight number:",
  "Arrival terminal:",
  "Destination address:",
  "Passengers:",
  "Luggage:",
  "One way or return:",
  "Could you please confirm availability?"
];

test("Oxford to Heathrow uses the outbound enquiry and is not the return journey", () => {
  const message = wa.enquiryMessage("oxford-to-heathrow");
  assert.equal(
    message.split("\n")[0],
    "Hi Spires Taxis, I'm enquiring about an Oxford to Heathrow Airport transfer."
  );
  for (const line of OUTBOUND_FIELDS) assert.ok(message.includes(line), line);
  assert.equal(message.includes("Arrival date:"), false);
  assert.equal(message.includes("Flight number:"), false);
});

test("Heathrow to Oxford uses the arrival enquiry and is not the outbound journey", () => {
  const message = wa.enquiryMessage("heathrow-to-oxford");
  assert.equal(
    message.split("\n")[0],
    "Hi Spires Taxis, I'm enquiring about a Heathrow Airport to Oxford transfer."
  );
  for (const line of INBOUND_FIELDS) assert.ok(message.includes(line), line);
  assert.equal(message.includes("Travel date:"), false);
  assert.equal(message.includes("Preferred pickup time:"), false);
  assert.notEqual(message, wa.enquiryMessage("oxford-to-heathrow"));
});

test("every other published airport route names that airport and direction", () => {
  const expected = {
    "oxford-to-gatwick": "an Oxford to Gatwick Airport transfer.",
    "oxford-to-stansted": "an Oxford to Stansted Airport transfer.",
    "oxford-to-luton": "an Oxford to Luton Airport transfer.",
    "oxford-to-birmingham": "an Oxford to Birmingham Airport transfer.",
    "oxford-to-bristol": "an Oxford to Bristol Airport transfer.",
    "oxford-to-london-city": "an Oxford to London City Airport transfer.",
    "oxfordshire-to-heathrow": "an Oxfordshire to Heathrow Airport transfer."
  };
  for (const [routeId, ending] of Object.entries(expected)) {
    const message = wa.enquiryMessage(routeId);
    assert.ok(message.startsWith("Hi Spires Taxis, I'm enquiring about " + ending), routeId);
    assert.ok(message.includes("Travel date:"), routeId);
  }
});

test("a future airport can be described with data attributes and no new route id", () => {
  const message = wa.enquiryMessageFromConfig({
    direction: "from-airport",
    airport: "Southend Airport",
    destination: "Oxford"
  });
  assert.equal(
    message.split("\n")[0],
    "Hi Spires Taxis, I'm enquiring about a Southend Airport to Oxford transfer."
  );
  assert.ok(message.includes("Flight number:"));
});

test("links use the existing business number and a URL-encoded message", () => {
  const href = wa.hrefForRoute("oxford-to-heathrow");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://wa.me/447776897772");
  assert.equal(url.searchParams.get("text"), wa.enquiryMessage("oxford-to-heathrow"));
  assert.equal(href.includes(" "), false);
  assert.equal(href.includes("\n"), false);
  assert.equal(href.includes("'"), false);
});

test("the WhatsApp enquiry does not add a website reference", () => {
  const message = wa.enquiryMessage("oxford-to-heathrow");
  assert.equal(message.includes("Website reference:"), false);
  assert.equal(message.includes("ST-"), false);
  const href = wa.hrefForRoute("oxford-to-heathrow");
  assert.equal(decodeURIComponent(href).includes("Website reference:"), false);
});

test("filename mapping stays aligned with the route registry", () => {
  for (const file of Object.keys(wa.ROUTE_FILES)) {
    const routeId = wa.routeIdForFilename(file);
    assert.ok(wa.ROUTES[routeId], file);
    assert.ok(wa.hrefForRoute(routeId).startsWith("https://wa.me/447776897772?text="), file);
  }
});
