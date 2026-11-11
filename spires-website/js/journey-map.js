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

  function offsetEnds(from, to, index, count) {
    if (count < 2) return [from, to];
    var shift = (index - (count - 1) / 2) * 0.012;
    var dx = to[1] - from[1];
    var dy = to[0] - from[0];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = (-dy / len) * shift;
    var py = (dx / len) * shift;
    return [
      [from[0] + px, from[1] + py],
      [to[0] + px, to[1] + py],
    ];
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
      line.navy.remove();
      line.gold.remove();
      line.dot.remove();
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
      line.navy.setStyle({ opacity: on || selected < 0 ? 0.85 : 0.28, weight: on ? 5 : 3 });
      line.gold.setStyle({ opacity: on || selected < 0 ? 0.95 : 0.2, weight: on ? 3 : 2 });
      if (on) {
        line.navy.bringToFront();
        line.gold.bringToFront();
      }
    });
    var buttons = document.querySelectorAll("[data-route-index]");
    buttons.forEach(function (button) {
      var on = Number(button.getAttribute("data-route-index")) === selected;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function selectRoute(index) {
    selected = index;
    paintSelection();
    var detail = document.getElementById("journey-map-detail");
    var route = lines[index] && lines[index].route;
    if (!detail || !route) return;
    detail.textContent = formatDate(route.date) + ". " + route.from + " to " + route.to + ".";
  }

  function draw(routes) {
    clearLines();
    selected = -1;
    if (!map || !window.L) return;
    var groups = new Map();
    routes.forEach(function (route) {
      var key = [route.fromLat, route.fromLng, route.toLat, route.toLng].map(function (n) { return Number(n).toFixed(3); }).sort().join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    });
    var seen = new Map();
    var bounds = [];
    routes.forEach(function (route) {
      var key = [route.fromLat, route.fromLng, route.toLat, route.toLng].map(function (n) { return Number(n).toFixed(3); }).sort().join("|");
      var group = groups.get(key) || [route];
      var index = seen.get(key) || 0;
      seen.set(key, index + 1);
      var ends = offsetEnds([route.fromLat, route.fromLng], [route.toLat, route.toLng], index, group.length);
      var navy = window.L.polyline(ends, { color: "#002147", weight: 3, opacity: 0.85, lineCap: "round" });
      var gold = window.L.polyline(ends, { color: "#b8956a", weight: 2, opacity: 0.95, dashArray: "7 11", className: "spires-map__flow", lineCap: "round" });
      var dot = window.L.circleMarker(ends[1], { radius: 4, color: "#002147", weight: 2, fillColor: "#b8956a", fillOpacity: 0.95 });
      navy.addTo(map);
      gold.addTo(map);
      dot.addTo(map);
      var record = { navy: navy, gold: gold, dot: dot, route: route };
      lines.push(record);
      bounds.push(ends[0], ends[1]);
      function choose() { selectRoute(lines.indexOf(record)); }
      navy.on("click", choose);
      gold.on("click", choose);
      dot.on("click", choose);
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

  function render(data) {
    var host = slot();
    if (!host) return;
    destroyMap();
    host.innerHTML = "";
    if (!data || !data.show || !Array.isArray(data.months) || !data.months.length) {
      host.remove();
      return;
    }
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
      button.textContent = formatDate(route.date) + ", " + route.from + " to " + route.to;
      button.addEventListener("click", function () { selectRoute(index); });
      list.appendChild(button);
    });
    host.appendChild(list);

    var note = document.createElement("p");
    note.className = "spires-numbers__note";
    var hidden = Math.max(0, Number(data.completedJourneys) - Number(data.mappedJourneys));
    note.textContent = hidden
      ? "Each line is one completed journey between the town or postcode district at each end. " + hidden + " completed journeys are not drawn because that area was not recorded. Map data from OpenStreetMap."
      : "Each line is one completed journey between the town or postcode district at each end. Map data from OpenStreetMap.";
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
