/**
 * Central airport pricing for Spires Taxis marketing site.
 * All published airport figures are return-booking prices per leg (per vehicle).
 * One-way-only airport fares are not published — quote on request.
 */
window.SPIRES_AIRPORT_PRICES = {
  currency: "GBP",
  currencySymbol: "£",
  model: "return_booking_per_leg",
  modelLabel:
    "Return-booking price per leg — the amount charged for each direction when you book a return airport journey. Price is per vehicle, not per passenger.",
  oneWayPolicy:
    "One-way-only airport journeys are quoted separately. Message us with date, pickup address, terminal and passengers for a confirmed fare.",
  includes:
    "Flight monitoring on collections, meet & greet where arranged, normal airport approach charges, and waiting time within our standard allowance after landing.",
  routes: {
    heathrow: {
      id: "heathrow",
      name: "Heathrow",
      slug: "/oxford-to-heathrow-taxi",
      distanceMilesApprox: "45–50",
      durationMinutesApprox: "60–90",
      terminals: ["2", "3", "4", "5"],
      upTo4: 87,
      vitoUpTo8: 110,
    },
    gatwick: {
      id: "gatwick",
      name: "Gatwick",
      slug: "/oxford-to-gatwick-taxi",
      upTo4: 130,
      vitoUpTo8: 170,
    },
    stansted: {
      id: "stansted",
      name: "Stansted",
      slug: null,
      upTo4: 145,
      vitoUpTo8: 180,
    },
    luton: {
      id: "luton",
      name: "Luton",
      slug: "/oxford-to-luton-taxi",
      upTo4: 100,
      vitoUpTo8: 125,
    },
    birmingham: {
      id: "birmingham",
      name: "Birmingham",
      slug: null,
      upTo4: 105,
      vitoUpTo8: 135,
    },
    londonCity: {
      id: "londonCity",
      name: "London City",
      slug: null,
      upTo4: 145,
      vitoUpTo8: 180,
    },
    bristol: {
      id: "bristol",
      name: "Bristol",
      slug: null,
      upTo4: 162,
      vitoUpTo8: 195,
    },
  },
};

window.SPIRES_formatMoney = function (amount) {
  const data = window.SPIRES_AIRPORT_PRICES;
  return data.currencySymbol + Number(amount).toFixed(0);
};

window.SPIRES_getRoute = function (id) {
  return window.SPIRES_AIRPORT_PRICES.routes[id] || null;
};
