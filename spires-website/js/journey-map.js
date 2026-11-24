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
    return date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
      }).filter(function (stop) {
        return stop.label && Number.isFinite(stop.lat) && Number.isFinite(stop.lng);
      });
    }
    var ends = [
      { label: route.from, lat: Number(route.fromLat), lng: Number(route.fromLng), kind: route.fromKind },
      { label: route.to, lat: Number(route.toLat), lng: Number(route.toLng), kind: route.toKind },
    ];
    return ends.filter(function (stop) {
      return stop.label && Number.isFinite(stop.lat) && Number.isFinite(stop.lng);
    });
  }

  function isItinerary(route) {
    return route.style === "itinerary" || (Array.isArray(route.stops) && route.stops.length >= 3);
  }

  function pathKey(stops) {
    return stops.map(function (stop) {
      return Number(stop.lat).toFixed(3) + "," + Number(stop.lng).toFixed(3);
    }).join("|");
  }

  function offsetPolyline(points, index, count) {
    if (count < 2 || points.length < 2) return points;
    var shift = (index - (count - 1) / 2) * 0.018;
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
      if (line.line) line.line.remove();
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
      var dimmed = selected >= 0 && !on;
      if (line.line) {
        line.line.setStyle({
          opacity: dimmed ? 0.18 : (line.itinerary ? 0.95 : 0.88),
          weight: on ? (line.itinerary ? 5 : 4) : (line.itinerary ? 3.5 : 2.5),
        });
        if (on) line.line.bringToFront();
      }
      (line.markers || []).forEach(function (marker) {
        if (marker.setOpacity) marker.setOpacity(dimmed ? 0 : 1);
        var el = marker.getElement && marker.getElement();
        if (el) el.classList.toggle("is-selected", on);
      });
    });
    var buttons = document.querySelectorAll("[data-route-index]");
    buttons.forEach(function (button) {
      var on = Number(button.getAttribute("data-route-index")) === selected;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) button.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }

  function routeSummary(route) {
    var stops = routeStops(route);
    var path = stops.map(function (stop) { return stop.label; }).join(" to ");
    var text = formatDate(route.date) + ". " + path + ".";
    if (isItinerary(route)) {
      text += " Itinerary between towns (not the exact roads driven).";
    }
    return text;
  }

  function selectRoute(index) {
    selected = index === selected ? -1 : index;
    paintSelection();
    var detail = document.getElementById("journey-map-detail");
    if (!detail) return;
    if (selected < 0) {
      detail.textContent = "Select a journey to see the date and the general areas.";
      return;
    }
    var route = lines[selected] && lines[selected].route;
    if (!route) return;
    detail.textContent = routeSummary(route);
    var line = lines[selected];
    if (map && line && line.latLngs && line.latLngs.length) {
      map.fitBounds(line.latLngs, { padding: [36, 36], maxZoom: 9, animate: !reducedMotion() });
    }
  }

  function stopDot(itinerary, withLabel, label) {
    var colour = itinerary ? "#b8956a" : "#002147";
    var html = '<span class="spires-map__stop-dot" style="border-color:' + colour + ';background:' + (itinerary ? "#fff8ef" : "#fff") + '"></span>';
    if (withLabel && label) {
      html += '<span class="spires-map__stop-label">' + escapeHtml(label) + "</span>";
    }
    return window.L.divIcon({
      className: "spires-map__stop" + (withLabel ? " has-label" : ""),
      html: html,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  function draw(routes) {
    clearLines();
    selected = -1;
    if (!map || !window.L) return;

    var groups = new Map();
    routes.forEach(function (route) {
      var key = pathKey(routeStops(route));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    });
    var seen = new Map();
    var bounds = [];

    routes.forEach(function (route) {
      var stops = routeStops(route);
      if (stops.length < 2) return;
      var key = pathKey(stops);
      var group = groups.get(key) || [route];
      var index = seen.get(key) || 0;
      seen.set(key, index + 1);
      var latLngs = offsetPolyline(stops.map(function (stop) {
        return [stop.lat, stop.lng];
      }), index, group.length);
      var itinerary = isItinerary(route);
      var line = window.L.polyline(latLngs, {
        color: itinerary ? "#b8956a" : "#002147",
        weight: itinerary ? 3.5 : 2.5,
        opacity: itinerary ? 0.95 : 0.88,
        lineCap: "round",
        lineJoin: "round",
        className: itinerary ? "spires-map__line--itinerary" : "spires-map__line--direct",
      });
      line.addTo(map);

      var markers = stops.map(function (stop, stopIndex) {
        var marker = window.L.marker(latLngs[stopIndex], {
          icon: stopDot(itinerary, true, stop.label),
          keyboard: false,
          opacity: 0,
        });
        marker.bindTooltip(stop.label, { direction: "top", opacity: 0.95, className: "spires-map__tip" });
        marker.addTo(map);
        marker.setOpacity(0);
        return marker;
      });

      var record = { line: line, markers: markers, route: route, itinerary: itinerary, latLngs: latLngs };
      lines.push(record);
      latLngs.forEach(function (point) { bounds.push(point); });
      function choose() { selectRoute(lines.indexOf(record)); }
      line.on("click", choose);
      markers.forEach(function (marker) { marker.on("click", choose); });
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
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
      maxZoom: 11,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
  }

  function ensureStopStyles() {
    if (document.getElementById("spires-map-stop-style")) return;
    var style = document.createElement("style");
    style.id = "spires-map-stop-style";
    style.textContent = [
      ".spires-map__stop{background:transparent!important;border:0!important;}",
      ".spires-map__stop-dot{display:block;width:11px;height:11px;border-radius:50%;border:2px solid #002147;box-shadow:0 0 0 2px rgba(255,255,255,.9);}",
      ".spires-map__stop-label{display:none;margin-top:5px;padding:2px 7px;white-space:nowrap;font:600 12px/1.2 'Source Sans 3',system-ui,sans-serif;color:#002147;background:rgba(255,255,255,.96);border:1px solid rgba(0,33,71,.12);border-radius:999px;}",
      ".spires-map__stop.is-selected .spires-map__stop-label{display:inline-block;}",
      ".spires-map__tip{font:600 12px/1.2 'Source Sans 3',system-ui,sans-serif!important;}",
      ".spires-map__legend{display:flex;flex-wrap:wrap;gap:10px 18px;margin:0 0 0.85rem;padding:0;list-style:none;font-size:.92rem;color:#002147;}",
      ".spires-map__legend-item{display:inline-flex;align-items:center;gap:8px;}",
      ".spires-map__swatch{display:inline-block;width:26px;height:3px;border-radius:2px;}",
      ".spires-map__swatch--direct{background:#002147;}",
      ".spires-map__swatch--itinerary{background:#b8956a;}",
      ".spires-map__list-item{display:grid;grid-template-columns:auto 1fr;gap:0.15rem 0.85rem;align-items:baseline;width:100%;text-align:left;min-height:48px;padding:0.7rem 0.85rem;border:1px solid #e4e9ef;border-left:3px solid transparent;border-radius:10px;background:#fff;font:inherit;color:#163a5f;cursor:pointer;}",
      ".spires-map__list-item:hover{border-color:#b8956a;background:#fffaf4;}",
      ".spires-map__list-item[aria-pressed='true']{border-color:#002147;border-left-color:#b8956a;background:#fff8ef;}",
      ".spires-map__list-date{font-size:0.78rem;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#5c6570;}",
      ".spires-map__list-path{grid-column:2;font-size:0.98rem;font-weight:600;color:#002147;}",
      ".spires-map__list-tag{grid-column:2;font-size:0.78rem;color:#8a6b45;}",
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

    var drawable = (data.routes || []).filter(function (route) {
      return routeStops(route).length >= 2;
    });

    drawable.forEach(function (route, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "spires-map__list-item";
      button.setAttribute("data-route-index", String(index));
      button.setAttribute("aria-pressed", "false");
      var stops = routeStops(route);
      var date = document.createElement("span");
      date.className = "spires-map__list-date";
      date.textContent = formatDate(route.date);
      var path = document.createElement("span");
      path.className = "spires-map__list-path";
      path.textContent = stops[0].label + " to " + stops[stops.length - 1].label;
      button.appendChild(date);
      button.appendChild(path);
      if (isItinerary(route) && stops.length > 2) {
        var tag = document.createElement("span");
        tag.className = "spires-map__list-tag";
        tag.textContent = stops.length - 2 + (stops.length - 2 === 1 ? " stop via " : " stops via ") +
          stops.slice(1, -1).map(function (stop) { return stop.label; }).join(", ");
        button.appendChild(tag);
      }
      button.addEventListener("click", function () { selectRoute(index); });
      list.appendChild(button);
    });
    host.appendChild(list);

    var note = document.createElement("p");
    note.className = "spires-numbers__note spires-map__note";
    var hidden = Math.max(0, Number(data.completedJourneys) - Number(data.mappedJourneys));
    note.textContent = hidden
      ? "Each line is one completed journey between towns or postcode districts. Multi stop itineraries connect towns in order. " + hidden + " completed journeys are not drawn because that area was not recorded. Map data from OpenStreetMap."
      : "Each line is one completed journey between towns or postcode districts. Multi stop itineraries connect towns in order. Map data from OpenStreetMap.";
    host.appendChild(note);

    select.addEventListener("change", function () { load(select.value); });

    if (!drawable.length) {
      canvas.remove();
      detail.textContent = "No journeys could be drawn for this month.";
      return;
    }
    loadLeaflet().then(function () {
      ensureMap(canvas);
      draw(drawable);
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
