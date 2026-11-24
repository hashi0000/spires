(function () {
  var ENDPOINT = "https://us-central1-spires-taxis.cloudfunctions.net/publicJourneyMap";
  var leafletLoading = null;
  var map = null;
  var lines = [];
  var selected = -1;

  function slot() {
    return document.querySelector("[data-spires-map]");
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function formatDate(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso;
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  }

  function routeStops(route) {
    if (Array.isArray(route.stops) && route.stops.length >= 2) {
      return route.stops.map(function (stop) {
        return {
          label: stop.label,
          lat: Number(stop.lat),
          lng: Number(stop.lng),
          kind: stop.kind,
        };
      });
    }
    return [
      { label: route.from, lat: Number(route.fromLat), lng: Number(route.fromLng), kind: route.fromKind },
      { label: route.to, lat: Number(route.toLat), lng: Number(route.toLng), kind: route.toKind },
    ];
  }

  function isItinerary(route) {
    return route.style === "itinerary" || (Array.isArray(route.stops) && route.stops.length >= 3);
  }

  function offsetPolyline(points, index, count) {
    if (count < 2 || points.length < 2) return points;
    var shift = (index - (count - 1) / 2) * 0.012;
    var from = points[0];
    var to = points[points.length - 1];
    var dx = to[1] - from[1];
    var dy = to[0] - from[0];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = (-dy / len) * shift;
    var py = (dx / len) * shift;
    return points.map(function (point) {
      return [point[0] + px, point[1] + py];
    });
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise(function (resolve, reject) {
      var css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
      script.onload = function () { resolve(window.L); };
      script.onerror = function () { reject(new Error("map")); };
      document.body.appendChild(script);
    });
    return leafletLoading;
  }

  function clearLines() {
    lines.forEach(function (line) {
      if (line.navy) line.navy.remove();
      if (line.gold) line.gold.remove();
      (line.markers || []).forEach(function (marker) { marker.remove(); });
    });
    lines = [];
  }

  function destroyMap() {
    clearLines();
    if (map) {
      map.remove();
      map = null;
    }
  }

  function paintSelection() {
    lines.forEach(function (line, index) {
      var on = index === selected;
      var active = on || selected < 0;
      if (line.navy) {
        line.navy.setStyle({ opacity: active ? 0.85 : 0.28, weight: on ? 5 : 3 });
        if (on) line.navy.bringToFront();
      }
      if (line.gold) {
        line.gold.setStyle({
          opacity: active ? (line.itinerary ? 0.9 : 0.95) : 0.2,
          weight: on ? (line.itinerary ? 5 : 3) : (line.itinerary ? 3 : 2),
        });
        if (on) line.gold.bringToFront();
      }
      (line.markers || []).forEach(function (marker) {
        if (marker.setOpacity) marker.setOpacity(active ? 1 : 0.35);
      });
    });
    var buttons = document.querySelectorAll("[data-route-index]");
    buttons.forEach(function (button) {
      var on = Number(button.getAttribute("data-route-index")) === selected;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function routeSummary(route) {
    var stops = routeStops(route);
    var path = stops.map(function (stop) { return stop.label; }).join(" → ");
    var text = formatDate(route.date) + ". " + path + ".";
    if (isItinerary(route)) {
      text += " Itinerary between towns (not the exact roads driven).";
    }
    return text;
  }

  function selectRoute(index) {
    selected = index;
    paintSelection();
    var detail = document.getElementById("journey-map-detail");
    var route = lines[index] && lines[index].route;
    if (!detail || !route) return;
    detail.textContent = routeSummary(route);
  }

  function stopIcon(label, itinerary) {
    var colour = itinerary ? "#b8956a" : "#002147";
    return window.L.divIcon({
      className: "spires-map__stop",
      html: '<span class="spires-map__stop-dot" style="border-color:' + colour + '"></span>' +
        '<span class="spires-map__stop-label">' + String(label || "").replace(/</g, "&lt;") + "</span>",
      iconSize: [0, 0],
      iconAnchor: [6, 6],
    });
  }

  function draw(routes) {
    clearLines();
    selected = -1;
    if (!map || !window.L) return;
    var groups = new Map();
    routes.forEach(function (route) {
      var stops = routeStops(route);
      var key = stops.map(function (stop) {
        return Number(stop.lat).toFixed(3) + "," + Number(stop.lng).toFixed(3);
      }).join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    });
    var seen = new Map();
    var bounds = [];
    routes.forEach(function (route) {
      var stops = routeStops(route);
      var key = stops.map(function (stop) {
        return Number(stop.lat).toFixed(3) + "," + Number(stop.lng).toFixed(3);
      }).join("|");
      var group = groups.get(key) || [route];
      var index = seen.get(key) || 0;
      seen.set(key, index + 1);
      var latLngs = offsetPolyline(stops.map(function (stop) {
        return [stop.lat, stop.lng];
      }), index, group.length);
      var itinerary = isItinerary(route);
      var navy = null;
      var gold = null;
      if (itinerary) {
        gold = window.L.polyline(latLngs, {
          color: "#b8956a",
          weight: 3,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        });
        gold.addTo(map);
      } else {
        navy = window.L.polyline(latLngs, { color: "#002147", weight: 3, opacity: 0.85, lineCap: "round" });
        gold = window.L.polyline(latLngs, {
          color: "#b8956a",
          weight: 2,
          opacity: 0.95,
          dashArray: "7 11",
          className: "spires-map__flow",
          lineCap: "round",
        });
        navy.addTo(map);
        gold.addTo(map);
      }
      var markers = stops.map(function (stop, stopIndex) {
        var point = latLngs[stopIndex];
        var marker = window.L.marker(point, {
          icon: stopIcon(stop.label, itinerary),
          keyboard: false,
        });
        marker.bindTooltip(stop.label, { direction: "top", opacity: 0.9 });
        marker.addTo(map);
        bounds.push(point);
        return marker;
      });
      var record = { navy: navy, gold: gold, markers: markers, route: route, itinerary: itinerary };
      lines.push(record);
      function choose() { selectRoute(lines.indexOf(record)); }
      if (navy) navy.on("click", choose);
      if (gold) gold.on("click", choose);
      markers.forEach(function (marker) { marker.on("click", choose); });
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
    paintSelection();
  }

  function ensureMap(canvas) {
    if (map) return map;
    map = window.L.map(canvas, {
      scrollWheelZoom: false,
      zoomAnimation: !reducedMotion(),
      fadeAnimation: !reducedMotion(),
      attributionControl: true,
    }).setView([51.75, -1.25], 7);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
  }

  function ensureStopStyles() {
    if (document.getElementById("spires-map-stop-style")) return;
    var style = document.createElement("style");
    style.id = "spires-map-stop-style";
    style.textContent = [
      ".spires-map__stop{background:transparent;border:0;}",
      ".spires-map__stop-dot{display:block;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #002147;box-shadow:0 0 0 1px rgba(255,255,255,.8);}",
      ".spires-map__stop-label{display:block;margin-top:4px;padding:1px 5px;white-space:nowrap;font:600 11px/1.2 Georgia,'Times New Roman',serif;color:#002147;background:rgba(255,255,255,.92);border-radius:3px;box-shadow:0 1px 2px rgba(0,33,71,.15);}",
      ".spires-map__legend{display:flex;flex-wrap:wrap;gap:12px 18px;margin:0 0 12px;padding:0;list-style:none;font-size:.95rem;color:#002147;}",
      ".spires-map__legend-item{display:inline-flex;align-items:center;gap:8px;}",
      ".spires-map__swatch{display:inline-block;width:28px;height:4px;border-radius:2px;}",
      ".spires-map__swatch--direct{background:linear-gradient(90deg,#002147 0 55%,transparent 55% 65%,#b8956a 65% 100%);}",
      ".spires-map__swatch--itinerary{background:#b8956a;}",
    ].join("");
    document.head.appendChild(style);
  }

  function render(data) {
    var host = slot();
    if (!host) return;
    destroyMap();
    host.innerHTML = "";
    if (!data || !data.show || !Array.isArray(data.months) || !data.months.length) {
      host.remove();
      return;
    }
    ensureStopStyles();
    var heading = document.createElement("h3");
    heading.textContent = "Journey map";
    host.appendChild(heading);

    var controls = document.createElement("div");
    controls.className = "spires-map__controls";
    var label = document.createElement("label");
    label.textContent = "Month";
    var select = document.createElement("select");
    select.id = "journey-map-month";
    data.months.forEach(function (month) {
      var option = document.createElement("option");
      option.value = month.key;
      option.textContent = month.label;
      if (month.key === data.selected) option.selected = true;
      select.appendChild(option);
    });
    if (data.selected) select.value = data.selected;
    label.appendChild(select);
    controls.appendChild(label);
    host.appendChild(controls);

    var stats = document.createElement("p");
    stats.className = "spires-map__stats";
    var destinationCount = Array.isArray(data.destinations) ? data.destinations.length : 0;
    var airportText = Array.isArray(data.airports) && data.airports.length ? data.airports.join(", ") : "None recorded";
    stats.textContent = data.completedJourneys + " completed journeys. " + destinationCount + " destinations. Airports served: " + airportText + ".";
    host.appendChild(stats);

    var legend = document.createElement("ul");
    legend.className = "spires-map__legend";
    legend.setAttribute("aria-label", "Map legend");
    [
      { className: "spires-map__swatch--direct", text: "Direct journeys" },
      { className: "spires-map__swatch--itinerary", text: "Multi stop itinerary" },
    ].forEach(function (item) {
      var li = document.createElement("li");
      li.className = "spires-map__legend-item";
      var swatch = document.createElement("span");
      swatch.className = "spires-map__swatch " + item.className;
      swatch.setAttribute("aria-hidden", "true");
      li.appendChild(swatch);
      li.appendChild(document.createTextNode(item.text));
      legend.appendChild(li);
    });
    host.appendChild(legend);

    var canvas = document.createElement("div");
    canvas.className = "spires-map__canvas" + (reducedMotion() ? " is-still" : "");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    var detail = document.createElement("p");
    detail.id = "journey-map-detail";
    detail.className = "spires-map__detail";
    detail.setAttribute("aria-live", "polite");
    detail.textContent = "Select a journey to see the date and the general areas.";
    host.appendChild(detail);

    var list = document.createElement("div");
    list.className = "spires-map__list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Completed journeys");
    (data.routes || []).forEach(function (route, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-route-index", String(index));
      button.setAttribute("aria-pressed", "false");
      var stops = routeStops(route);
      var path = stops.map(function (stop) { return stop.label; }).join(" → ");
      button.textContent = formatDate(route.date) + ", " + path;
      button.addEventListener("click", function () { selectRoute(index); });
      list.appendChild(button);
    });
    host.appendChild(list);

    var note = document.createElement("p");
    note.className = "spires-numbers__note";
    var hidden = Math.max(0, Number(data.completedJourneys) - Number(data.mappedJourneys));
    note.textContent = hidden
      ? "Each line is one completed journey between towns or postcode districts. Multi stop itineraries connect towns in order. " + hidden + " completed journeys are not drawn because that area was not recorded. Map data from OpenStreetMap."
      : "Each line is one completed journey between towns or postcode districts. Multi stop itineraries connect towns in order. Map data from OpenStreetMap.";
    host.appendChild(note);

    select.addEventListener("change", function () { load(select.value); });

    if (!data.routes || !data.routes.length) {
      canvas.remove();
      detail.textContent = "No journeys could be drawn for this month.";
      return;
    }
    loadLeaflet().then(function () {
      ensureMap(canvas);
      draw(data.routes);
      setTimeout(function () { if (map) map.invalidateSize(); }, 60);
    }).catch(function () {
      canvas.remove();
      detail.textContent = "The map could not be loaded. The journey list is still available.";
    });
  }

  var request = 0;

  function load(month) {
    var token = ++request;
    var url = ENDPOINT + (month ? "?month=" + encodeURIComponent(month) : "");
    return fetch(url)
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (token !== request) return;
        render(data);
      })
      .catch(function () {
        if (token !== request) return;
        var host = slot();
        if (host && !host.childElementCount) host.remove();
      });
  }

  function boot() {
    if (!slot() || slot().dataset.ready === "1") return;
    slot().dataset.ready = "1";
    load("");
  }

  document.addEventListener("spires-numbers-ready", boot);
  boot();
})();
