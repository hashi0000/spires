(function () {
  var ENDPOINT = "https://us-central1-spires-taxis.cloudfunctions.net/publicJourneyStats";
  var path = window.location.pathname.replace(/\/index\.html$/, "/");

  function pageKey() {
    if (path === "/" || path === "") return "home";
    if (path.indexOf("heathrow") !== -1) return "heathrow";
    if (path.indexOf("gatwick") !== -1) return "gatwick";
    if (path.indexOf("stansted") !== -1) return "stansted";
    if (path.indexOf("luton") !== -1) return "luton";
    if (path.indexOf("birmingham") !== -1) return "birmingham";
    if (path.indexOf("bristol") !== -1) return "bristol";
    if (path.indexOf("london-city") !== -1) return "london-city";
    if (path.indexOf("abingdon") !== -1) return "abingdon";
    if (path.indexOf("didcot") !== -1) return "didcot";
    if (path.indexOf("bicester") !== -1) return "bicester";
    if (path.indexOf("witney") !== -1) return "witney";
    if (path.indexOf("oxford-taxis") !== -1) return "oxford";
    return "";
  }

  function countFor(data, key) {
    if (key === "home") return data.completedJourneys;
    if (data.airports && data.airports[key]) return data.airports[key];
    if (data.areas && data.areas[key]) return data.areas[key];
    return 0;
  }

  function sentence(data, key, count) {
    var period = "Completed journeys in " + data.periodLabel;
    if (key === "home") return period + ": " + count + ".";
    var place = key === "london-city" ? "London City Airport" : key.charAt(0).toUpperCase() + key.slice(1);
    return count + " completed journeys starting or ending at " + place + " in " + data.periodLabel + ".";
  }

  var key = pageKey();
  if (!key) return;
  fetch(ENDPOINT)
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data || !data.show) return;
      var count = countFor(data, key);
      if (!count || count < 1) return;
      if (key !== "home" && count < 5) return;
      var section = document.createElement("section");
      section.className = "section spires-numbers";
      section.setAttribute("aria-label", "Spires in numbers");
      var highlights = "";
      if (key === "home" && Array.isArray(data.highlights)) {
        highlights = "<ul class=\"spires-numbers__list\">" + data.highlights.map(function (row) {
          return "<li>" + row.count + " completed journeys starting or ending at " + row.label + "</li>";
        }).join("") + "</ul><p class=\"spires-numbers__note\">Route figures are journeys to or from that place. They are not added together.</p>";
      }
      var mapSlot = key === "home" ? "<div class=\"spires-map\" data-spires-map></div>" : "";
      section.innerHTML = "<div class=\"container\"><h2>Spires in numbers</h2><p>" + sentence(data, key, count) + "</p>" + highlights + mapSlot + "<p class=\"spires-numbers__note\">Figures updated " + new Date(data.updatedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }) + ".</p></div>";
      var anchor = document.querySelector("footer") || document.body;
      anchor.parentNode.insertBefore(section, anchor);
      if (key === "home") {
        section.setAttribute("data-spires-numbers", "home");
        document.dispatchEvent(new Event("spires-numbers-ready"));
      }
    })
    .catch(function () { /* the section stays hidden when figures are unavailable */ });
})();
