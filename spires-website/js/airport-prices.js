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
 *   oneWay       — advertised one-way fare (null = quote on request)
 *   return       — advertised return TOTAL when both journeys are booked together
 *   returnPerLeg — published per-leg rate while one-way has not been set yet
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
      capacity: "Up to 4 passengers",
      maxPassengers: 4,
    },
    vito: {
      id: "vito",
      bookingValue: "8_seater",
      name: "Mercedes Vito",
      examples: "Mercedes Vito or similar",
      capacity: "Up to 8 passengers",
      maxPassengers: 8,
    },
  };

  var VEHICLE_DISCLAIMER =
    "Vehicle models shown are examples of the type of vehicle normally provided. The exact make and model may vary depending on availability. We will provide a suitable vehicle for the passenger and luggage requirements confirmed at the time of booking.";

  var DATA = {
    currency: "GBP",
    currencySymbol: "£",
    includes:
      "Flight monitoring on collections, meet & greet where arranged, normal airport approach charges, and 50 minutes complimentary waiting from the actual landing time.",
    routes: {
      heathrow: {
        id: "heathrow",
        name: "Heathrow",
        slug: "/oxford-to-heathrow-taxi",
        distanceMilesApprox: "45–50",
        durationMinutesApprox: "60–90",
        terminals: ["2", "3", "4", "5"],
        published: true,
        standardCar: { oneWay: 95, return: 185 },
        vito: { oneWay: null, returnPerLeg: 110 },
      },
      gatwick: {
        id: "gatwick",
        name: "Gatwick",
        slug: "/oxford-to-gatwick-taxi",
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 130 },
        vito: { oneWay: null, returnPerLeg: 170 },
      },
      stansted: {
        id: "stansted",
        name: "Stansted",
        slug: null,
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 145 },
        vito: { oneWay: null, returnPerLeg: 180 },
      },
      luton: {
        id: "luton",
        name: "Luton",
        slug: "/oxford-to-luton-taxi",
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 100 },
        vito: { oneWay: null, returnPerLeg: 125 },
      },
      birmingham: {
        id: "birmingham",
        name: "Birmingham",
        slug: null,
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 105 },
        vito: { oneWay: null, returnPerLeg: 135 },
      },
      londonCity: {
        id: "londonCity",
        name: "London City",
        slug: null,
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 145 },
        vito: { oneWay: null, returnPerLeg: 180 },
      },
      bristol: {
        id: "bristol",
        name: "Bristol",
        slug: null,
        published: true,
        standardCar: { oneWay: null, returnPerLeg: 162 },
        vito: { oneWay: null, returnPerLeg: 195 },
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
    if (isFiniteNumber(prices.returnPerLeg)) return prices.returnPerLeg * 2;
    return null;
  }

  function formatClassPrice(prices) {
    if (!prices) return "Quote on request";
    if (isFiniteNumber(prices.oneWay) && isFiniteNumber(prices.return)) {
      return formatMoney(prices.oneWay) + " one way / " + formatMoney(prices.return) + " return";
    }
    if (isFiniteNumber(prices.returnPerLeg)) {
      return "From " + formatMoney(prices.returnPerLeg);
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
    if (isFiniteNumber(prices.returnPerLeg)) return "From " + formatMoney(prices.returnPerLeg);
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
    if (field === "returnPerLeg") {
      return isFiniteNumber(prices.returnPerLeg) ? formatMoney(prices.returnPerLeg) : null;
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

  function fillRatesTable() {
    var tbody = document.getElementById("airport-price-tbody");
    if (!tbody) return;
    var order = [
      "heathrow",
      "gatwick",
      "stansted",
      "luton",
      "birmingham",
      "londonCity",
      "bristol",
    ];
    tbody.innerHTML = order
      .map(function (id) {
        var r = DATA.routes[id];
        if (!r || r.published === false) return "";
        var name = r.slug ? '<a href="' + r.slug + '">' + r.name + "</a>" : r.name;
        var standard = formatClassPrice(r.standardCar);
        var vito = formatClassPrice(r.vito);
        var save = returnSaving(r.standardCar);
        var saveHtml = save
          ? '<div class="price-save price-save--table">Save ' +
            formatMoney(save) +
            " when booking your return together</div>"
          : "";
        return (
          "<tr><td>" +
          name +
          "</td><td>" +
          standard +
          saveHtml +
          "</td><td>" +
          vito +
          "</td></tr>"
        );
      })
      .join("");
  }

  function applyPublishedPrices() {
    fillTokens();
    fillSaveBadges();
    fillDisclaimers();
    fillRatesTable();
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
