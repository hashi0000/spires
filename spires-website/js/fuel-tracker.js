/**
 * Renders the UK fuel-price card from the cached /api/uk-fuel-prices endpoint.
 * Informational only — never changes airport fares.
 * Hides itself if no reliable figure is available.
 */
(function () {
  function formatPence(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toFixed(1) + "p / litre";
  }

  function formatWeekDate(value) {
    var raw = String(value || "").trim();
    var m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function hide(root) {
    root.hidden = true;
    root.innerHTML = "";
  }

  function render(root, data) {
    var petrol = formatPence(data.petrolPence);
    var diesel = formatPence(data.dieselPence);
    var updated = formatWeekDate(data.weekCommencing);
    if (!petrol || !diesel || !updated) {
      hide(root);
      return;
    }

    var sourceUrl = data.sourceUrl || "https://www.gov.uk/government/statistics/weekly-road-fuel-prices";
    var sourceName = data.sourceName || "UK Government fuel price data";

    root.hidden = false;
    root.innerHTML =
      '<div class="fuel-tracker__head">' +
      "<h3>UK average fuel prices</h3>" +
      "<p>Published weekly averages, shown for context only. Fuel figures do not change our airport fares.</p>" +
      "</div>" +
      '<div class="fuel-tracker__grid">' +
      '<div class="fuel-tracker__item"><span class="fuel-tracker__label">Petrol</span><span class="fuel-tracker__value">' +
      petrol +
      "</span></div>" +
      '<div class="fuel-tracker__item"><span class="fuel-tracker__label">Diesel</span><span class="fuel-tracker__value">' +
      diesel +
      "</span></div>" +
      "</div>" +
      '<p class="fuel-tracker__meta">Last updated: ' +
      updated +
      "</p>" +
      '<p class="fuel-tracker__source">Source: <a href="' +
      sourceUrl +
      '" target="_blank" rel="noopener noreferrer">' +
      sourceName +
      "</a></p>";
  }

  async function init() {
    var root = document.getElementById("uk-fuel-tracker");
    if (!root) return;
    try {
      var response = await fetch("/api/uk-fuel-prices", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        hide(root);
        return;
      }
      var data = await response.json();
      if (!data || data.available !== true) {
        hide(root);
        return;
      }
      render(root, data);
    } catch (err) {
      hide(root);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
