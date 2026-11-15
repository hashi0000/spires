/**
 * SOURCE OF TRUTH for currently published OXFORD airport fares.
 *
 * These Oxford fares apply to Oxford. Abingdon, Didcot, Bicester and Witney
 * have their own published fares in REGIONAL. Other towns are quoted.
 *
 * Historical bookings are NOT calculated from this file. Confirmed fares
 * are stored on each Firestore booking as `actualFare`.
 *
 * Per vehicle class:
 *   oneWay  advertised one way fare (null = quote on request)
 *   return  advertised return TOTAL when both legs are booked together
 *
 * Return saving is (oneWay × 2) − return. Do not hard-code a single saving.
 * Wording: "Save £X on a return". Explain once that this compares with two one way bookings.
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
    executive: {
      id: "executive",
      bookingValue: "executive",
      name: "Executive Car",
      examples: "Mercedes E Class or equivalent",
      tableExamples: "Mercedes E Class or&nbsp;equivalent",
      capacity: "Passengers and luggage confirmed before acceptance",
      maxPassengers: null,
    },
  };

  /** Public launch switch. Executive Heathrow transfers are open. */
  var EXECUTIVE_SERVICE_ENABLED = true;

  var EXECUTIVE_FARES = {
    oxford: { oneWay: 150, return: 290 },
    abingdon: { oneWay: 165, return: 320 },
    didcot: { oneWay: 170, return: 330 },
    bicester: { oneWay: 170, return: 330 },
    witney: { oneWay: 170, return: 330 },
  };

  var EXECUTIVE_UNAVAILABLE = { oneWay: null, return: null, available: false };

  function executivePrice(areaId) {
    var fare = EXECUTIVE_FARES[areaId];
    if (!fare) return EXECUTIVE_UNAVAILABLE;
    return { oneWay: fare.oneWay, return: fare.return, available: true };
  }

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
      tableIntro: "Prices are per vehicle and include standard airport pickup or drop off charges.",
      outsideOxfordNote: "Travelling from outside Oxford? Oxford fares apply to Oxford. Abingdon, Didcot, Bicester and Witney each have their own published airport fares. An individual quote is needed when there is no published fare, for nearby villages outside that coverage, or for extra requirements.",
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
        executive: executivePrice("oxford"),
      },
      gatwick: {
        id: "gatwick",
        name: "Gatwick",
        slug: "/oxford-to-gatwick-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 140, return: 270 },
        vito: { oneWay: 175, return: 340 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      stansted: {
        id: "stansted",
        name: "Stansted",
        slug: "/oxford-to-stansted-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 150, return: 290 },
        vito: { oneWay: 185, return: 360 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      luton: {
        id: "luton",
        name: "Luton",
        slug: "/oxford-to-luton-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 105, return: 205 },
        vito: { oneWay: 130, return: 255 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      birmingham: {
        id: "birmingham",
        name: "Birmingham",
        slug: "/oxford-to-birmingham-airport-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 110, return: 215 },
        vito: { oneWay: 145, return: 280 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      londonCity: {
        id: "londonCity",
        name: "London City",
        slug: "/oxford-to-london-city-airport-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 150, return: 290 },
        vito: { oneWay: 190, return: 370 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      bristol: {
        id: "bristol",
        name: "Bristol",
        slug: "/oxford-to-bristol-airport-taxi",
        origin: "oxford",
        published: true,
        standardCar: { oneWay: 165, return: 320 },
        vito: { oneWay: 205, return: 400 },
        executive: EXECUTIVE_UNAVAILABLE,
      },
      eastMidlands: {
        id: "eastMidlands",
        name: "East Midlands",
        slug: null,
        published: false,
        standardCar: { oneWay: null, return: null },
        vito: { oneWay: null, return: null },
        executive: EXECUTIVE_UNAVAILABLE,
      },
    },
  };

  var FARE_NOTE = "Prices are per vehicle and include standard airport pickup or drop off charges.";

  var REGIONAL_ORDER = ["heathrow", "gatwick", "stansted", "luton"];

  var REGIONAL = {
    abingdon: {
      id: "abingdon",
      name: "Abingdon",
      page: "/abingdon-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 105, return: 205 }, vito: { oneWay: 138, return: 270 }, executive: executivePrice("abingdon") },
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
        heathrow: { name: "Heathrow", standardCar: { oneWay: 110, return: 216 }, vito: { oneWay: 140, return: 275 }, executive: executivePrice("didcot") },
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
        heathrow: { name: "Heathrow", standardCar: { oneWay: 110, return: 205 }, vito: { oneWay: 140, return: 275 }, executive: executivePrice("bicester") },
        gatwick: { name: "Gatwick", standardCar: { oneWay: 160, return: 290 }, vito: { oneWay: 200, return: 290 } },
        stansted: { name: "Stansted", standardCar: { oneWay: 165, return: 320 }, vito: { oneWay: 210, return: 410 } },
        luton: { name: "Luton", standardCar: { oneWay: 110, return: 215 }, vito: { oneWay: 142, return: 280 } },
      },
    },
    witney: {
      id: "witney",
      name: "Witney",
      page: "/witney-airport-transfers#airport-fares",
      routes: {
        heathrow: { name: "Heathrow", standardCar: { oneWay: 108, return: 212 }, vito: { oneWay: 140, return: 275 }, executive: executivePrice("witney") },
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
    return "Save " + formatMoney(amount) + " on a return";
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
          executive: regionalRoute.executive || EXECUTIVE_UNAVAILABLE,
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

  function fareStatusHtml(label, text) {
    return '<td data-label="' + label + '"><span class="fare-amount">' + text + "</span></td>";
  }

  function executiveReviewEnabled() {
    if (EXECUTIVE_SERVICE_ENABLED) return true;
    try {
      if (typeof location === "undefined" || !location || !location.hostname) return false;
      var host = String(location.hostname || "");
      var local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "";
      if (!local) return false;
      if (typeof URLSearchParams !== "undefined" && new URLSearchParams(location.search).get("executive") === "0") return false;
      return true;
    } catch (err) {
      return false;
    }
  }

  function showExecutiveColumns(options) {
    if (options && options.executive === true) return true;
    if (options && options.executive === false) return false;
    return executiveReviewEnabled();
  }

  function fareHeadRow(showExecutive) {
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
      (showExecutive
        ? '<th scope="col">Executive Car one way<span class="th-sub">' +
          VEHICLE_CLASSES.executive.tableExamples +
          "</span></th>" +
          '<th scope="col">Executive Car return</th>'
        : "") +
      "</tr>"
    );
  }

  function executiveCells(route) {
    var prices = route && route.executive;
    if (!prices || prices.available === false || !isFiniteNumber(prices.oneWay)) {
      return (
        fareStatusHtml("Executive Car one way", "Not available") +
        fareStatusHtml("Executive Car return", "Not available")
      );
    }
    var labelled = labelledPrices(prices, "Executive Car one way", "Executive Car return");
    return fareOneWayHtml(labelled) + fareReturnHtml(labelled);
  }

  function renderFareBlock(originId, onlyId, options) {
    var routes = routesForOrigin(originId, onlyId);
    var showExecutive = showExecutiveColumns(options);
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
          (showExecutive ? executiveCells(route) : "") +
          "</tr>"
      );
    }
    return { headRow: fareHeadRow(showExecutive), rows: rows.join(""), executive: showExecutive };
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
      var table = el.querySelector("table");
      if (table) table.classList.toggle("airport-fare-table--executive", rendered.executive === true);
    }
  }

  var OTHER_AIRPORT = /\b(gatwick|stansted|luton|birmingham airport|bristol airport|london city(?: airport)?|east midlands|london oxford airport|lgw|stn|ltn|bhx|brs|lcy|ema)\b/i;
  var HEATHROW = /\b(heathrow|lhr)\b/i;
  var SPECIFIC_AREAS = [
    { id: "abingdon", pattern: /\babingdon\b/i },
    { id: "didcot", pattern: /\bdidcot\b/i },
    { id: "bicester", pattern: /\bbicester\b/i },
    { id: "witney", pattern: /\bwitney\b/i },
  ];

  function executiveJourneyText(journey) {
    var parts = [];
    function add(value) {
      if (!value) return;
      if (typeof value === "string") parts.push(value);
      else if (value.address) parts.push(value.address);
    }
    add(journey && journey.pickup);
    add(journey && journey.destination);
    add(journey && journey.returnPickup);
    add(journey && journey.returnDestination);
    var stops = (journey && journey.stops) || [];
    var returnStops = (journey && journey.returnStops) || [];
    for (var i = 0; i < stops.length; i++) add(stops[i]);
    for (var j = 0; j < returnStops.length; j++) add(returnStops[j]);
    return parts.join("\n");
  }

  function classifyExecutiveJourney(journey) {
    var text = executiveJourneyText(journey || {});
    if (!HEATHROW.test(text)) {
      return { ok: false, error: "Executive Car is only available for Heathrow transfers." };
    }
    if (OTHER_AIRPORT.test(text)) {
      return { ok: true, airport: "heathrow", area: null, fareStatus: "quote_required", oneWay: null, returnFare: null };
    }
    var specific = [];
    for (var i = 0; i < SPECIFIC_AREAS.length; i++) {
      if (SPECIFIC_AREAS[i].pattern.test(text)) specific.push(SPECIFIC_AREAS[i].id);
    }
    var area = specific.length === 1 ? specific[0] : specific.length === 0 && /\boxford\b/i.test(text) ? "oxford" : null;
    if (!area) {
      return { ok: true, airport: "heathrow", area: null, fareStatus: "quote_required", oneWay: null, returnFare: null };
    }
    var prices = EXECUTIVE_FARES[area];
    return {
      ok: true,
      airport: "heathrow",
      area: area,
      fareStatus: "published",
      oneWay: prices.oneWay,
      returnFare: prices.return,
    };
  }

  function executiveIconSvg() {
    return (
      '<svg class="executive-icon" viewBox="0 0 64 32" width="64" height="32" aria-hidden="true">' +
      '<path d="M8 20h48M14 20l4-7h20l8 7" fill="none" stroke="#002147" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="20" cy="22" r="3" fill="none" stroke="#b8956a" stroke-width="1.6"/>' +
      '<circle cx="46" cy="22" r="3" fill="none" stroke="#b8956a" stroke-width="1.6"/>' +
      "</svg>"
    );
  }

  function syncExecutiveVisibility() {
    var on = executiveReviewEnabled();
    var blocks = document.querySelectorAll("[data-executive-block]");
    for (var i = 0; i < blocks.length; i++) blocks[i].hidden = !on;
    var held = document.querySelectorAll("[data-executive-held]");
    for (var j = 0; j < held.length; j++) held[j].hidden = on;
    if (!on) return;
    var navLinks = document.querySelectorAll('a[data-nav="heathrow"]');
    for (var n = 0; n < navLinks.length; n++) {
      var item = navLinks[n].parentNode;
      if (!item || !item.parentNode || item.parentNode.querySelector('a[data-nav="executive"]')) continue;
      var li = document.createElement("li");
      var anchor = document.createElement("a");
      anchor.href = "/executive-heathrow-transfers";
      anchor.setAttribute("data-nav", "executive");
      if (navLinks[n].querySelector(".site-nav__name")) {
        anchor.innerHTML = '<span class="site-nav__name">Executive Heathrow</span>';
      } else {
        anchor.textContent = "Executive Heathrow";
      }
      li.appendChild(anchor);
      item.parentNode.insertBefore(li, item.nextSibling);
    }
  }

  function mountExecutivePriceCard() {
    if (!executiveReviewEnabled()) return;
    if (typeof location === "undefined" || !location || !document || typeof document.querySelector !== "function") return;
    var path = String(location.pathname || "").replace(/\.html$/, "").replace(/\/$/, "") || "/";
    var area = null;
    if (
      path === "/oxford-to-heathrow-taxi" ||
      path === "/heathrow-to-oxford-taxi" ||
      path === "/heathrow-airport-taxis" ||
      path === "/oxfordshire-to-heathrow-airport-transfers"
    ) {
      area = "oxford";
    } else if (path === "/abingdon-airport-transfers") area = "abingdon";
    else if (path === "/didcot-airport-transfers") area = "didcot";
    else if (path === "/bicester-airport-transfers") area = "bicester";
    else if (path === "/witney-airport-transfers") area = "witney";
    var host = document.querySelector(".price-options");
    if (!area || !host || host.querySelector("[data-executive-option]")) return;
    var prices = area === "oxford" ? getRoute("heathrow").executive : REGIONAL[area].routes.heathrow.executive;
    var article = document.createElement("article");
    article.className = "price-option executive-card";
    article.setAttribute("data-executive-option", area);
    article.innerHTML =
      executiveIconSvg() +
      "<h3>Executive Car</h3>" +
      '<p class="price-option__examples">Mercedes E Class or equivalent</p>' +
      '<p class="price-option__amount"><span class="fare-amount">' +
      formatMoney(prices.oneWay) +
      '</span> <span class="price-option__unit">one way</span></p>' +
      '<p class="price-option__amount price-option__amount--secondary"><span class="fare-amount">' +
      formatMoney(prices.return) +
      '</span> <span class="price-option__unit">return</span></p>' +
      '<p class="price-save">Save ' +
      formatMoney(prices.oneWay * 2 - prices.return) +
      " on a return</p>" +
      '<p class="price-option__meta">Per vehicle, either direction. Advance booking required.</p>' +
      "<p>Travel between Heathrow and Oxfordshire in a Mercedes E Class or equivalent. An option for business travel, visiting guests or anyone who prefers an executive car. Advance booking required. Subject to availability and confirmation.</p>" +
      "<p>A partner operator may provide the car. Executive Car is the vehicle category. It is not an allocated car, and it does not promise a particular model, luggage space, or extra services.</p>" +
      '<p><a href="/executive-heathrow-transfers">Executive Heathrow transfers</a></p>';
    host.appendChild(article);
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
    syncExecutiveVisibility();
    mountExecutivePriceCard();
    if (typeof Event === "function" && document && typeof document.dispatchEvent === "function") {
      document.dispatchEvent(new Event("spires-prices-ready"));
    }
  }

  window.SPIRES_EXECUTIVE_SERVICE_ENABLED = EXECUTIVE_SERVICE_ENABLED;
  window.SPIRES_EXECUTIVE_FARES = EXECUTIVE_FARES;
  window.SPIRES_executiveServiceEnabled = executiveReviewEnabled;
  window.SPIRES_classifyExecutive = classifyExecutiveJourney;
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
