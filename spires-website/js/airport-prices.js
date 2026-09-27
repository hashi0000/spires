/**
 * SOURCE OF TRUTH for currently published airport fares.
 *
 * Change Heathrow / Gatwick / Luton (etc.) prices here. Customer-facing
 * pages hydrate from this file. HTML fallbacks exist for SEO / no-JS and
 * should be updated at the same time as this file.
 *
 * Historical bookings are NOT calculated from this file. Confirmed fares
 * are stored on each Firestore booking as `actualFare`.
 *
 * Per vehicle class:
 *   oneWay  advertised one way fare (null = quote on request)
 *   return  advertised return TOTAL when both journeys are booked together
 *
 * Return saving is (oneWay × 2) − return. Do not hard-code “Save £5”.
 */
(function () {
  var VEHICLE_CLASSES = {
    standardCar: {
      id: "standardCar",
      bookingValue: "standard",
      name: "Standard Car",
      examples: "Toyota RAV4 / Corolla or similar",
      tableExamples: "RAV4 / Corolla or similar",
      capacity: "Up to 4 passengers",
      maxPassengers: 4,
    },
    vito: {
      id: "vito",
      bookingValue: "8_seater",
      name: "8-Seater",
      examples: "Mercedes Vito or similar",
      tableExamples: "Mercedes Vito or similar",
      capacity: "Up to 8 passengers",
      maxPassengers: 8,
    },
  };

  var VEHICLE_DISCLAIMER =
    "Vehicle models are examples only and may vary depending on availability and booking requirements. Luggage capacity depends on passenger numbers. Please tell us about large or additional luggage when booking.";

  var PUBLISHED_ORDER = [
    "heathrow",
    "luton",
    "birmingham",
    "gatwick",
    "stansted",
    "londonCity",
    "bristol",
  ];

  var DATA = {
    currency: "GBP",
    currencySymbol: "£",
    includes: [
      "Flight monitoring",
      "Meet & greet",
      "Airport charges",
      "50 minutes complimentary waiting from actual landing",
    ],
    routes: {
      heathrow: {
        id: "heathrow",
        name: "Heathrow",
        slug: "/oxford-to-heathrow-taxi",
        distanceMilesApprox: "45–50",
        durationMinutesApprox: "60–90",
        terminals: ["2", "3", "4", "5"],
        published: true,
        featured: true,
        standardCar: { oneWay: 95, return: 185 },
        vito: { oneWay: 125, return: 245 },
      },
      luton: {
        id: "luton",
        name: "Luton",
        slug: "/oxford-to-luton-taxi",
        published: true,
        standardCar: { oneWay: 110, return: 215 },
        vito: { oneWay: 145, return: 285 },
      },
      birmingham: {
        id: "birmingham",
        name: "Birmingham",
        slug: null,
        published: true,
        standardCar: { oneWay: 115, return: 225 },
        vito: { oneWay: 150, return: 295 },
      },
      gatwick: {
        id: "gatwick",
        name: "Gatwick",
        slug: "/oxford-to-gatwick-taxi",
        published: true,
        standardCar: { oneWay: 150, return: 295 },
        vito: { oneWay: 195, return: 385 },
      },
      stansted: {
        id: "stansted",
        name: "Stansted",
        slug: null,
        published: true,
        standardCar: { oneWay: 160, return: 315 },
        vito: { oneWay: 205, return: 405 },
      },
      londonCity: {
        id: "londonCity",
        name: "London City",
        slug: null,
        published: true,
        standardCar: { oneWay: 160, return: 315 },
        vito: { oneWay: 205, return: 405 },
      },
      bristol: {
        id: "bristol",
        name: "Bristol",
        slug: null,
        published: true,
        standardCar: { oneWay: 175, return: 345 },
        vito: { oneWay: 220, return: 435 },
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
      el.textContent = "Save " + formatMoney(save) + " when booking your return together";
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
        "Book both journeys together and save " + formatMoney(amounts[0]) + " on the return fare.";
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
