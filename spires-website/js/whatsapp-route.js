/**
 * Route-specific WhatsApp click-to-chat links for airport landing pages.
 *
 * A page opts in with data-wa-route on <body> (a known route id), or with
 * data-wa-direction plus data-wa-airport for a route that is not listed yet:
 *
 *   <body data-wa-route="oxford-to-heathrow">
 *   <body data-wa-direction="to-airport" data-wa-origin="Oxford" data-wa-airport="Southend Airport">
 *   <body data-wa-direction="from-airport" data-wa-airport="Gatwick Airport" data-wa-destination="Oxford">
 *
 * Every Spires Taxis wa.me link on that page is then given the same prefilled
 * enquiry, including header, fare, footer, floating, and mobile-bar buttons.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.SpiresWhatsApp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var WHATSAPP_NUMBER = "447776897772";

  var AIRPORT_NAMES = {
    heathrow: "Heathrow Airport",
    gatwick: "Gatwick Airport",
    stansted: "Stansted Airport",
    luton: "Luton Airport",
    birmingham: "Birmingham Airport",
    bristol: "Bristol Airport",
    "london-city": "London City Airport"
  };

  var ROUTES = {
    "oxford-to-heathrow": { direction: "to-airport", origin: "Oxford", airport: "heathrow" },
    "heathrow-to-oxford": { direction: "from-airport", airport: "heathrow", destination: "Oxford" },
    "oxford-to-gatwick": { direction: "to-airport", origin: "Oxford", airport: "gatwick" },
    "oxford-to-stansted": { direction: "to-airport", origin: "Oxford", airport: "stansted" },
    "oxford-to-luton": { direction: "to-airport", origin: "Oxford", airport: "luton" },
    "oxford-to-birmingham": { direction: "to-airport", origin: "Oxford", airport: "birmingham" },
    "oxford-to-bristol": { direction: "to-airport", origin: "Oxford", airport: "bristol" },
    "oxford-to-london-city": { direction: "to-airport", origin: "Oxford", airport: "london-city" },
    "oxfordshire-to-heathrow": { direction: "to-airport", origin: "Oxfordshire", airport: "heathrow" }
  };

  var ROUTE_FILES = {
    "oxford-to-heathrow-taxi.html": "oxford-to-heathrow",
    "heathrow-to-oxford-taxi.html": "heathrow-to-oxford",
    "oxford-to-gatwick-taxi.html": "oxford-to-gatwick",
    "oxford-to-stansted-taxi.html": "oxford-to-stansted",
    "oxford-to-luton-taxi.html": "oxford-to-luton",
    "oxford-to-birmingham-airport-taxi.html": "oxford-to-birmingham",
    "oxford-to-bristol-airport-taxi.html": "oxford-to-bristol",
    "oxford-to-london-city-airport-taxi.html": "oxford-to-london-city",
    "oxfordshire-to-heathrow-airport-transfers.html": "oxfordshire-to-heathrow"
  };

  function indefiniteArticle(phrase) {
    return /^[aeiou]/i.test(String(phrase || "").trim()) ? "an" : "a";
  }

  function airportLabel(value) {
    if (!value) return "";
    return AIRPORT_NAMES[value] || value;
  }

  function outboundMessage(origin, airportName) {
    return [
      "Hi Spires Taxis, I'm enquiring about " + indefiniteArticle(origin) + " " + origin + " to " + airportName + " transfer.",
      "",
      "Travel date:",
      "Preferred pickup time:",
      "Pickup address:",
      "Destination / terminal:",
      "Passengers:",
      "Luggage:",
      "One way or return:",
      "",
      "Could you please confirm availability?"
    ].join("\n");
  }

  function inboundMessage(airportName, destination) {
    return [
      "Hi Spires Taxis, I'm enquiring about " + indefiniteArticle(airportName) + " " + airportName + " to " + destination + " transfer.",
      "",
      "Arrival date:",
      "Flight number:",
      "Arrival terminal:",
      "Destination address:",
      "Passengers:",
      "Luggage:",
      "One way or return:",
      "",
      "Could you please confirm availability?"
    ].join("\n");
  }

  function enquiryMessageFromConfig(config) {
    if (!config) return "";
    if (config.route && ROUTES[config.route]) return enquiryMessage(config.route);
    var airport = airportLabel(config.airport);
    if (!airport) return "";
    if (config.direction === "from-airport") {
      return inboundMessage(airport, config.destination || "Oxford");
    }
    if (config.direction === "to-airport") {
      return outboundMessage(config.origin || "Oxford", airport);
    }
    return "";
  }

  function enquiryMessage(routeId) {
    var route = ROUTES[routeId];
    if (!route) return "";
    return enquiryMessageFromConfig({
      direction: route.direction,
      origin: route.origin,
      destination: route.destination,
      airport: route.airport
    });
  }

  function encodeWhatsAppText(message) {
    return encodeURIComponent(message).replace(/'/g, "%27");
  }

  function whatsappHref(message) {
    if (!message) return "";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeWhatsAppText(message);
  }

  function websiteEnquiryRef() {
    var key = "spires_website_enquiry_ref";
    try {
      var existing = sessionStorage.getItem(key) || "";
      if (/^ST-[A-Z0-9]{6}$/.test(existing)) return existing;
      var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      var values = new Uint32Array(6);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(values);
      var body = "";
      for (var i = 0; i < 6; i++) body += alphabet[(values[i] || Math.floor(Math.random() * alphabet.length)) % alphabet.length];
      var ref = "ST-" + body;
      sessionStorage.setItem(key, ref);
      return ref;
    } catch (error) {
      return "";
    }
  }

  function withWebsiteReference(message, ref) {
    if (!message) return "";
    if (!/^ST-[A-Z0-9]{6}$/.test(String(ref || ""))) return message;
    if (message.indexOf("gclid=") !== -1 || message.indexOf("Website reference:") !== -1) return message;
    return message + "\n\nWebsite reference: " + ref;
  }

  function hrefForRoute(routeId) {
    return whatsappHref(enquiryMessage(routeId));
  }

  function hrefFromElement(el) {
    if (!el || !el.getAttribute) return "";
    var route = el.getAttribute("data-wa-route");
    if (route && ROUTES[route]) return hrefForRoute(route);
    var direction = el.getAttribute("data-wa-direction");
    if (!direction) return "";
    return whatsappHref(enquiryMessageFromConfig({
      direction: direction,
      origin: el.getAttribute("data-wa-origin"),
      destination: el.getAttribute("data-wa-destination"),
      airport: el.getAttribute("data-wa-airport")
    }));
  }

  function hrefFromDocument(doc) {
    var documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef || !documentRef.body) return "";
    return hrefFromElement(documentRef.body);
  }

  function isBusinessWhatsApp(url) {
    if (!url) return false;
    if (url.indexOf("wa.me/" + WHATSAPP_NUMBER) !== -1) return true;
    if (url.indexOf("api.whatsapp.com/") !== -1 && url.indexOf(WHATSAPP_NUMBER) !== -1) return true;
    return false;
  }

  function applyHref(doc, href) {
    if (!doc || !href || !doc.querySelectorAll) return 0;
    var links = doc.querySelectorAll("a[href]");
    var updated = 0;
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.getAttribute("data-wa-preserve") === "true") continue;
      var current = link.getAttribute("href") || "";
      if (!isBusinessWhatsApp(current)) continue;
      if (current !== href) {
        link.setAttribute("href", href);
        updated++;
      }
    }
    return updated;
  }

  function applyToDocument(doc) {
    var href = hrefFromDocument(doc);
    if (!href) return 0;
    var ref = websiteEnquiryRef();
    if (ref) {
      try {
        var message = new URL(href).searchParams.get("text") || "";
        var next = whatsappHref(withWebsiteReference(message, ref));
        if (next) href = next;
      } catch (error) {
        href = hrefFromDocument(doc);
      }
    }
    return applyHref(doc, href);
  }

  function routeIdForFilename(filename) {
    var base = String(filename || "").split(/[/\\]/).pop();
    return ROUTE_FILES[base] || "";
  }

  function boot() {
    if (typeof document === "undefined") return;
    applyToDocument(document);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  return {
    WHATSAPP_NUMBER: WHATSAPP_NUMBER,
    AIRPORT_NAMES: AIRPORT_NAMES,
    ROUTES: ROUTES,
    ROUTE_FILES: ROUTE_FILES,
    enquiryMessage: enquiryMessage,
    withWebsiteReference: withWebsiteReference,
    enquiryMessageFromConfig: enquiryMessageFromConfig,
    whatsappHref: whatsappHref,
    hrefForRoute: hrefForRoute,
    hrefFromElement: hrefFromElement,
    hrefFromDocument: hrefFromDocument,
    applyHref: applyHref,
    applyToDocument: applyToDocument,
    routeIdForFilename: routeIdForFilename
  };
});
