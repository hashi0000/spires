(function () {
  function londonYmd(date) {
    var fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (row) {
      parts[row.type] = row.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  function sync() {
    var ymd = londonYmd(new Date());
    var offer = ymd >= "2026-10-25" && ymd <= "2026-11-02";
    var halloween = ymd >= "2026-10-25" && ymd <= "2026-10-31";
    var banner = document.getElementById("half-term-offer");
    if (banner) banner.hidden = !offer;
    var hero = document.querySelector(".hero--home");
    if (hero) hero.classList.toggle("hero--halloween", halloween);
    document.querySelectorAll(".halloween-decor").forEach(function (el) {
      el.hidden = !halloween;
    });
  }

  sync();
  document.addEventListener("visibilitychange", sync);
  window.setInterval(sync, 30000);
})();
