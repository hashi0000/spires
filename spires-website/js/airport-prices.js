/**
 * SOURCE OF TRUTH for currently published OXFORD airport fares.
 *
 * These fares apply only to journeys TO or FROM OXFORD (for example
 * Oxford ↔ Heathrow). They do not apply automatically to Abingdon,
 * Kidlington, Witney, Bicester, Didcot or other nearby towns.
 *
 * Historical bookings are NOT calculated from this file. Confirmed fares
 * are stored on each Firestore booking as `actualFare`.
 *
 * Per vehicle class:
 *   oneWay  advertised one way fare (null = quote on request)
 *   return  advertised return TOTAL when both Oxford legs are booked together
 *
 * Return saving is (oneWay × 2) − return. Do not hard-code a single saving.
 */
(function () {
  var VEHICLE_CLASSES = {
    standardCar: {
      id: "standardCar",
      bookingValue: "standard",
      name: "Standard Car",
      examples: "Toyota RAV4 / Corolla or similar",
      tableExamples: "RAV4 / Corolla or&nbsp;similar",
      capacity: "Up to 4 passengers",
      maxPassengers: 4,
    },
    vito: {
      id: "vito",
      bookingValue: "8_seater",
      name: "8 Seater",
      examples: "Mercedes Vito or similar",
      tableExamples: "Mercedes Vito or&nbsp;similar",
      capacity: "Up to 8 passengers",
      maxPassengers: 8,
    },
  };

  var VEHICLE_DISCLAIMER =
    "Vehicle models are examples only and may vary depending on availability and booking requirements. Luggage capacity depends on passenger numbers. Please tell us about large or additional luggage when booking.";

  var PUBLISHED_ORDER = [
    "heathrow",
    "gatwick",
    "stansted",
    "luton",
    "birmingham",
    "londonCity",
    "bristol",
  ];

  var DATA = {
    currency: "GBP",
    currencySymbol: "£",
    origin: {
      id: "oxford",
      name: "Oxford",
      fareScope: "journeys to or from Oxford",
      tableIntro: "Fixed fares for airport transfers to or from Oxford. Airport charges are included.",
      outsideOxfordNote: "Travelling from outside Oxford? Do not assume these prices apply. Fares from other towns are quoted separately and are subject to change. Send us your pickup address for a quote.",
    },
    waitingPolicy: {
      freeMinutesAfterActualLanding: 50,
      chargeBlockMinutes: 30,
      chargePerBlock: 10,
    },
    includes: [
      "Airport charges included",
      "Flight monitoring included for airport collections",
      "50 minutes waiting from actual landing included for airport collections",
    ],
    routes: {
      heathrow: {
        id: "heathrow",
        name: "Heathrow",
        slug: "/oxford-to-heathrow-taxi",
        origin: "oxford",
        distanceMilesApprox: "45–50",
        durationMinutesApprox: "60–90",
        terminals: ["2", "3", "4", "5"],
        published: true,
        featured: true,
        standardCar: { oneWay: 92, return: 180 },
        vito: { oneWay: 120, return: 235 },
      },
      gatwick: {
        id: "gatwick",
        name: "Gatwick",
        slug: "/oxford-to-gatwick-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 140, return: 270 },
        vito: { oneWay: 175, return: 340 },
      },
      stansted: {
        id: "stansted",
        name: "Stansted",
        slug: null,
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 150, return: 290 },
        vito: { oneWay: 185, return: 360 },
      },
      luton: {
        id: "luton",
        name: "Luton",
        slug: "/oxford-to-luton-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 105, return: 205 },
        vito: { oneWay: 130, return: 255 },
      },
      birmingham: {
        id: "birmingham",
        name: "Birmingham",
        slug: null,
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 110, return: 215 },
        vito: { oneWay: 145, return: 280 },
      },
      londonCity: {
        id: "londonCity",
        name: "London City",
        slug: "/oxford-to-london-city-airport-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 150, return: 290 },
        vito: { oneWay: 190, return: 370 },
      },
      bristol: {
        id: "bristol",
        name: "Bristol",
        slug: null,
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 165, return: 320 },
        vito: { oneWay: 205, return: 400 },
      },
      eastMidlands: {
        id: "eastMidlands",
        name: "East Midlands",
        slug: null,
        published: false,
        standardCar: { oneWay: null, return: null },
        vito: { oneWay: null, return: null },
      },
    },
  };

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function formatMoney(amount) {
    if (!isFiniteNumber(Number(amount))) return "";
    return DATA.currencySymbol + Number(amount).toFixed(0);
  }

  function getRoute(id) {
    return DATA.routes[id] || null;
  }

  function classPrices(routeId, classId) {
    var route = getRoute(routeId);
    if (!route) return null;
    return route[classId] || null;
  }

  function returnSaving(prices) {
    if (!prices || !isFiniteNumber(prices.oneWay) || !isFiniteNumber(prices.return)) {
      return null;
    }
    var save = prices.oneWay * 2 - prices.return;
    return save > 0 ? save : null;
  }

  function returnTotal(prices) {
    if (!prices) return null;
    if (isFiniteNumber(prices.return)) return prices.return;
    return null;
  }

  function formatClassPrice(prices) {
    if (!prices) return "Quote on request";
    if (isFiniteNumber(prices.oneWay) && isFiniteNumber(prices.return)) {
      return formatMoney(prices.oneWay) + " one way / " + formatMoney(prices.return) + " return";
    }
    if (isFiniteNumber(prices.return)) {
      return "Return " + formatMoney(prices.return);
    }
    if (isFiniteNumber(prices.oneWay)) {
      return formatMoney(prices.oneWay) + " one way";
    }
    return "Quote on request";
  }

  function headlineFrom(prices) {
    if (!prices) return "";
    if (isFiniteNumber(prices.oneWay)) return formatMoney(prices.oneWay);
    if (isFiniteNumber(prices.return)) return "From " + formatMoney(prices.return);
    return "";
  }

  function resolveToken(token) {
    if (token === "disclaimer") return VEHICLE_DISCLAIMER;

    var parts = String(token || "").split(".");
    if (parts[0] === "vehicle" && parts[1] && VEHICLE_CLASSES[parts[1]]) {
      var vc = VEHICLE_CLASSES[parts[1]];
      if (parts[2] === "name") return vc.name;
      if (parts[2] === "examples") return vc.examples;
      if (parts[2] === "capacity") return vc.capacity;
      if (parts[2] === "tableExamples") return vc.tableExamples || vc.examples;
      return vc.name;
    }

    var route = getRoute(parts[0]);
    if (!route) return null;
    var prices = route[parts[1]];
    if (!prices) return null;
    var field = parts[2] || "summary";
    if (field === "oneWay") return isFiniteNumber(prices.oneWay) ? formatMoney(prices.oneWay) : null;
    if (field === "return") {
      var total = returnTotal(prices);
      return isFiniteNumber(total) ? formatMoney(total) : null;
    }
    if (field === "summary") return formatClassPrice(prices);
    if (field === "headline") return headlineFrom(prices);
    if (field === "save") {
      var save = returnSaving(prices);
      return save ? formatMoney(save) : null;
    }
    return null;
  }

  function fillSaveBadges() {
    var nodes = document.querySelectorAll("[data-spires-save]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var token = el.getAttribute("data-spires-save") || "";
      var parts = token.split(".");
      var prices = classPrices(parts[0], parts[1]);
      var save = returnSaving(prices);
      if (!save) {
        el.hidden = true;
        el.textContent = "";
        continue;
      }
      el.hidden = false;
      el.textContent = "Save " + formatMoney(save) + " when booking both journeys together.";
    }
  }

  function fillTokens() {
    var nodes = document.querySelectorAll("[data-spires-price]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var value = resolveToken(el.getAttribute("data-spires-price"));
      if (value) el.textContent = value;
    }
  }

  function fillDisclaimers() {
    var nodes = document.querySelectorAll("[data-spires-disclaimer]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = VEHICLE_DISCLAIMER;
    }
  }

  function airportNameHtml(route) {
    if (route.slug) return '<a href="' + route.slug + '">' + route.name + "</a>";
    return route.name;
  }

  function fareStackHtml(prices) {
    if (prices && isFiniteNumber(prices.oneWay) && isFiniteNumber(prices.return)) {
      return (
        '<div class="fare-stack">' +
        '<span class="fare-stack__line">' +
        formatMoney(prices.oneWay) +
        " one way</span>" +
        '<span class="fare-stack__line fare-stack__line--return">' +
        formatMoney(prices.return) +
        " return</span>" +
        "</div>"
      );
    }
    return (
      '<div class="fare-stack"><span class="fare-stack__line">' +
      formatClassPrice(prices) +
      "</span></div>"
    );
  }

  function fillSavingNote() {
    var el = document.getElementById("airport-return-saving-note");
    if (!el) return;
    var amounts = [];
    for (var i = 0; i < PUBLISHED_ORDER.length; i++) {
      var route = DATA.routes[PUBLISHED_ORDER[i]];
      if (!route || route.published === false) continue;
      var standardSave = returnSaving(route.standardCar);
      var eightSave = returnSaving(route.vito);
      if (standardSave && amounts.indexOf(standardSave) === -1) amounts.push(standardSave);
      if (eightSave && amounts.indexOf(eightSave) === -1) amounts.push(eightSave);
    }
    if (amounts.length === 1) {
      el.textContent =
        "Save " + formatMoney(amounts[0]) + " when booking both journeys together.";
      el.hidden = false;
      return;
    }
    if (amounts.length > 1) {
      el.textContent = "Book both journeys together and save on the return fare.";
      el.hidden = false;
      return;
    }
    el.textContent = "";
    el.hidden = true;
  }

  function fillIncludedList() {
    var el = document.getElementById("airport-included-list");
    if (!el || !DATA.includes || !DATA.includes.length) return;
    el.innerHTML = DATA.includes.map(function (item) {
      return "<li>" + item + "</li>";
    }).join("");
  }

  function fillOriginCopy() {
    var origin = DATA.origin || {};
    var map = {
      tableIntro: origin.tableIntro,
      outsideOxfordNote: origin.outsideOxfordNote,
      fareScope: origin.fareScope,
    };
    var nodes = document.querySelectorAll("[data-spires-origin]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-spires-origin");
      if (key && map[key]) nodes[i].textContent = map[key];
    }
  }

  function fillRatesTable() {
    var tbody = document.getElementById("airport-price-tbody");
    var cards = document.getElementById("airport-price-cards");
    var rows = [];
    var cardHtml = [];

    for (var i = 0; i < PUBLISHED_ORDER.length; i++) {
      var id = PUBLISHED_ORDER[i];
      var route = DATA.routes[id];
      if (!route || route.published === false) continue;
      var name = airportNameHtml(route);
      var cardFeatured = route.featured ? " airport-fare-card--featured" : "";
      rows.push(
        "<tr" +
          (route.featured ? ' class="airport-fare-table__row--featured"' : "") +
          ">" +
          '<th scope="row">' +
          name +
          "</th>" +
          "<td>" +
          fareStackHtml(route.standardCar) +
          "</td>" +
          "<td>" +
          fareStackHtml(route.vito) +
          "</td>" +
          "</tr>"
      );

      cardHtml.push(
        '<article class="airport-fare-card' +
          cardFeatured +
          '">' +
          '<h3 class="airport-fare-card__name">' +
          name +
          "</h3>" +
          '<div class="airport-fare-card__grid">' +
          '<div class="airport-fare-card__col">' +
          '<p class="airport-fare-card__class">' +
          VEHICLE_CLASSES.standardCar.name +
          "</p>" +
          '<p class="airport-fare-card__examples">' +
          VEHICLE_CLASSES.standardCar.tableExamples +
          "</p>" +
          fareStackHtml(route.standardCar) +
          "</div>" +
          '<div class="airport-fare-card__col">' +
          '<p class="airport-fare-card__class">' +
          VEHICLE_CLASSES.vito.name +
          "</p>" +
          '<p class="airport-fare-card__examples">' +
          VEHICLE_CLASSES.vito.tableExamples +
          "</p>" +
          fareStackHtml(route.vito) +
          "</div>" +
          "</div>" +
          '<p class="airport-fare-card__included">Airport charges included</p>' +
          "</article>"
      );
    }

    if (tbody) tbody.innerHTML = rows.join("");
    if (cards) cards.innerHTML = cardHtml.join("");
  }

  function applyPublishedPrices() {
    fillTokens();
    fillSaveBadges();
    fillDisclaimers();
    fillRatesTable();
    fillSavingNote();
    fillIncludedList();
    fillOriginCopy();
  }

  window.SPIRES_VEHICLE_CLASSES = VEHICLE_CLASSES;
  window.SPIRES_VEHICLE_DISCLAIMER = VEHICLE_DISCLAIMER;
  window.SPIRES_AIRPORT_PRICES = DATA;
  window.SPIRES_formatMoney = formatMoney;
  window.SPIRES_getRoute = getRoute;
  window.SPIRES_classPrices = classPrices;
  window.SPIRES_returnSaving = returnSaving;
  window.SPIRES_formatClassPrice = formatClassPrice;
  window.SPIRES_applyPublishedPrices = applyPublishedPrices;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPublishedPrices);
  } else {
    applyPublishedPrices();
  }
})();
