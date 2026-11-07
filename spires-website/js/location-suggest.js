(function () {
  var ENDPOINT = "https://us-central1-spires-taxis.cloudfunctions.net/searchLocations";
  var FALLBACK = [
    "Heathrow Terminal 2, TW6 1EW",
    "Heathrow Terminal 3, TW6 1QG",
    "Heathrow Terminal 4, TW6 3XA",
    "Heathrow Terminal 5, TW6 2GA",
    "Gatwick South Terminal, RH6 0NP",
    "Gatwick North Terminal, RH6 0PJ",
    "Oxford Station, OX1 1HS",
    "London Oxford Airport, Kidlington, OX5 1RA"
  ];

  function fallback(query) {
    var q = String(query || "").trim().toLowerCase();
    return FALLBACK.filter(function (label) {
      return !q || label.toLowerCase().indexOf(q) !== -1;
    }).map(function (label) {
      return { id: label, label: label, needsProperty: false };
    });
  }

  function attach(input) {
    if (!input || input.dataset.locationReady) return;
    input.dataset.locationReady = "1";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("autocomplete", "off");
    var wrap = document.createElement("div");
    wrap.className = "loc-suggest";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var list = document.createElement("ul");
    list.className = "loc-suggest__list";
    list.hidden = true;
    list.setAttribute("role", "listbox");
    wrap.appendChild(list);
    var note = document.createElement("p");
    note.className = "loc-suggest__note";
    note.hidden = true;
    note.textContent = "This postcode covers more than one property. Add the building, flat or entrance to the address.";
    wrap.appendChild(note);
    var items = [];
    var active = 0;
    var token = 0;
    var timer = 0;

    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }

    function render() {
      list.innerHTML = "";
      items.forEach(function (item, index) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", index === active ? "true" : "false");
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.addEventListener("mousedown", function (event) {
          event.preventDefault();
          choose(item);
        });
        li.appendChild(button);
        list.appendChild(li);
      });
      list.hidden = items.length === 0;
      input.setAttribute("aria-expanded", list.hidden ? "false" : "true");
    }

    function choose(item) {
      input.value = item.label;
      if (item.latitude == null && item.longitude == null && !item.placeId) delete input.dataset.place;
      else input.dataset.place = JSON.stringify(item);
      note.hidden = item.needsProperty !== true;
      close();
    }

    function search(query) {
      var current = ++token;
      fetch(ENDPOINT + "?q=" + encodeURIComponent(query || ""))
        .then(function (response) { return response.json(); })
        .then(function (body) {
          if (current !== token) return;
          items = Array.isArray(body.suggestions) && body.suggestions.length ? body.suggestions : fallback(query);
          active = 0;
          render();
        })
        .catch(function () {
          if (current !== token) return;
          items = fallback(query);
          active = 0;
          render();
        });
    }

    input.addEventListener("focus", function () { search(input.value); });
    input.addEventListener("input", function () {
      delete input.dataset.place;
      note.hidden = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { search(input.value); }, 280);
    });
    input.addEventListener("keydown", function (event) {
      if (list.hidden || !items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        active = Math.min(items.length - 1, active + 1);
        render();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        active = Math.max(0, active - 1);
        render();
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(items[active]);
      } else if (event.key === "Escape") close();
    });
    document.addEventListener("mousedown", function (event) {
      if (!wrap.contains(event.target)) close();
    });
  }

  function start() {
    document.querySelectorAll("input[name='pickup'], input[name='destination'], input[name='returnPickupLocation'], input[name='returnDestination']").forEach(attach);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
