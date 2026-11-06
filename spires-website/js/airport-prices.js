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
 * Wording: "Save £X compared with two one way bookings."
 *
 * Regional fares (Abingdon, Didcot, Bicester, Witney) live in REGIONAL.
 * They must not be copied onto Oxford routes or data-spires-price tokens.
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
      tableIntro: "Fares are fixed per vehicle and include the standard airport charge.",
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
        slug: "/oxford-to-stansted-taxi",
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
        slug: "/oxford-to-birmingham-airport-taxi",
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
        slug: "/oxford-to-bristol-airport-taxi",
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

  var FARE_NOTE = "Fares are fixed per vehicle and include the standard airport charge.";

  var REGIONAL_ORDER = ["heathrow", "gatwick", "stansted", "luton"];

  var REGIONAL = {
    abingdon: {
      id: "abingdon",
      name: "Abingdon",
      page: "/abingdon-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 105, return: 205 }, vito: { oneWay: 138, return: 270 } },
        gatwick: { name: "Gatwick", standardCar: { oneWay: 150, return: 295 }, vito: { oneWay: 190, return: 375 } },
        stansted: { name: "Stansted", standardCar: { oneWay: 160, return: 315 }, vito: { oneWay: 195, return: 380 } },
        luton: { name: "Luton", standardCar: { oneWay: 115, return: 225 }, vito: { oneWay: 150, return: 290 } },
      },
    },
    didcot: {
      id: "didcot",
      name: "Didcot",
      page: "/didcot-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 110, return: 216 }, vito: { oneWay: 140, return: 275 } },
        gatwick: { name: "Gatwick", standardCar: { oneWay: 160, return: 310 }, vito: { oneWay: 205, return: 400 } },
        stansted: { name: "Stansted", standardCar: { oneWay: 175, return: 340 }, vito: { oneWay: 215, return: 420 } },
        luton: { name: "Luton", standardCar: { oneWay: 130, return: 255 }, vito: { oneWay: 160, return: 310 } },
      },
    },
    bicester: {
      id: "bicester",
      name: "Bicester",
      page: "/bicester-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 110, return: 205 }, vito: { oneWay: 140, return: 275 } },
        gatwick: { name: "Gatwick", standardCar: { oneWay: 160, return: 310 }, vito: { oneWay: 200, return: 290 } },
        stansted: { name: "Stansted", standardCar: { oneWay: 165, return: 320 }, vito: { oneWay: 210, return: 410 } },
        luton: { name: "Luton", standardCar: { oneWay: 110, return: 215 }, vito: { oneWay: 142, return: 280 } },
      },
    },
    witney: {
      id: "witney",
      name: "Witney",
      page: "/witney-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 108, return: 212 }, vito: { oneWay: 140, return: 275 } },
        gatwick: { name: "Gatwick", standardCar: { oneWay: 160, return: 315 }, vito: { oneWay: 205, return: 395 } },
        stansted: { name: "Stansted", standardCar: { oneWay: 172, return: 334 }, vito: { oneWay: 210, return: 410 } },
        luton: { name: "Luton", standardCar: { oneWay: 125, return: 240 }, vito: { oneWay: 155, return: 300 } },
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

  function saveSentence(amount) {
    return "Save " + formatMoney(amount) + " compared with two one way bookings.";
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
      el.textContent = saveSentence(save);
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

  function fareOneWayHtml(prices) {
    if (!prices || !isFiniteNumber(prices.oneWay)) {
      return '<td data-label="One way"><span class="fare-amount">Quote on request</span></td>';
    }
    return '<td data-label="' + (prices._label || "") + '"><span class="fare-amount">' + formatMoney(prices.oneWay) + "</span></td>";
  }

  function fareReturnHtml(prices) {
    if (!prices || !isFiniteNumber(prices.return)) {
      return '<td data-label="Return"><span class="fare-amount">Quote on request</span></td>';
    }
    var save = returnSaving(prices);
    var note = "";
    if (save) {
      note =
        '<span class="fare-save" data-one-way="' +
        prices.oneWay +
        '" data-return="' +
        prices.return +
        '">' +
        saveSentence(save) +
        "</span>";
    }
    return (
      '<td data-label="' +
      (prices._returnLabel || "") +
      '"><span class="fare-amount">' +
      formatMoney(prices.return) +
      "</span>" +
      note +
      "</td>"
    );
  }

  function labelledPrices(prices, oneWayLabel, returnLabel) {
    return {
      oneWay: prices ? prices.oneWay : null,
      return: prices ? prices.return : null,
      _label: oneWayLabel,
      _returnLabel: returnLabel,
    };
  }

  function fillSavingNote() {
    var el = document.getElementById("airport-return-saving-note");
    if (!el) return;
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

  function routesForOrigin(originId, onlyId) {
    var list = [];
    if (originId === "oxford") {
      for (var i = 0; i < PUBLISHED_ORDER.length; i++) {
        var oxfordRoute = DATA.routes[PUBLISHED_ORDER[i]];
        if (!oxfordRoute || oxfordRoute.published === false) continue;
        list.push(oxfordRoute);
      }
    } else if (REGIONAL[originId]) {
      var origin = REGIONAL[originId];
      for (var j = 0; j < REGIONAL_ORDER.length; j++) {
        var id = REGIONAL_ORDER[j];
        var regionalRoute = origin.routes[id];
        if (!regionalRoute) continue;
        list.push({
          id: id,
          name: regionalRoute.name,
          slug: null,
          featured: id === "heathrow",
          published: true,
          standardCar: regionalRoute.standardCar,
          vito: regionalRoute.vito,
        });
      }
    }
    if (!onlyId) return list;
    var filtered = [];
    for (var k = 0; k < list.length; k++) {
      if (list[k].id === onlyId) filtered.push(list[k]);
    }
    return filtered;
  }

  function fareHeadRow() {
    return (
      "<tr>" +
      '<th scope="col">Airport</th>' +
      '<th scope="col">Standard Car one way<span class="th-sub">' +
      VEHICLE_CLASSES.standardCar.tableExamples +
      "</span></th>" +
      '<th scope="col">Standard Car return</th>' +
      '<th scope="col">8 Seater one way<span class="th-sub">' +
      VEHICLE_CLASSES.vito.tableExamples +
      "</span></th>" +
      '<th scope="col">8 Seater return</th>' +
      "</tr>"
    );
  }

  function renderFareBlock(originId, onlyId) {
    var routes = routesForOrigin(originId, onlyId);
    var rows = [];
    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var standard = labelledPrices(route.standardCar, "Standard Car one way", "Standard Car return");
      var eight = labelledPrices(route.vito, "8 Seater one way", "8 Seater return");
      rows.push(
        "<tr" +
          (route.featured ? ' class="airport-fare-table__row--featured"' : "") +
          ">" +
          '<th scope="row">' +
          airportNameHtml(route) +
          "</th>" +
          fareOneWayHtml(standard) +
          fareReturnHtml(standard) +
          fareOneWayHtml(eight) +
          fareReturnHtml(eight) +
          "</tr>"
      );
    }
    return { headRow: fareHeadRow(), rows: rows.join("") };
  }

  function fillFareTables() {
    var mounts = document.querySelectorAll("[data-spires-fare-table]");
    for (var i = 0; i < mounts.length; i++) {
      var el = mounts[i];
      var rendered = renderFareBlock(
        el.getAttribute("data-spires-fare-table"),
        el.getAttribute("data-spires-fare-route")
      );
      var head = el.querySelector("[data-spires-fare-head]");
      var body = el.querySelector("[data-spires-fare-body]");
      if (head) head.innerHTML = rendered.headRow;
      if (body) body.innerHTML = rendered.rows;
    }
  }

  function fillCalculatedSavings() {
    var nodes = document.querySelectorAll("[data-one-way][data-return]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var save = returnSaving({
        oneWay: Number(el.getAttribute("data-one-way")),
        return: Number(el.getAttribute("data-return")),
      });
      if (!save) {
        el.hidden = true;
        el.textContent = "";
        continue;
      }
      el.hidden = false;
      el.textContent = saveSentence(save);
    }
  }

  function applyPublishedPrices() {
    fillTokens();
    fillSaveBadges();
    fillDisclaimers();
    fillFareTables();
    fillCalculatedSavings();
    fillSavingNote();
    fillIncludedList();
    fillOriginCopy();
  }

  window.SPIRES_VEHICLE_CLASSES = VEHICLE_CLASSES;
  window.SPIRES_VEHICLE_DISCLAIMER = VEHICLE_DISCLAIMER;
  window.SPIRES_AIRPORT_PRICES = DATA;
  window.SPIRES_REGIONAL_FARES = REGIONAL;
  window.SPIRES_FARE_NOTE = FARE_NOTE;
  window.SPIRES_formatMoney = formatMoney;
  window.SPIRES_saveSentence = saveSentence;
  window.SPIRES_getRoute = getRoute;
  window.SPIRES_classPrices = classPrices;
  window.SPIRES_returnSaving = returnSaving;
  window.SPIRES_formatClassPrice = formatClassPrice;
  window.SPIRES_renderFareBlock = renderFareBlock;
  window.SPIRES_applyPublishedPrices = applyPublishedPrices;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPublishedPrices);
  } else {
    applyPublishedPrices();
  }
})();
