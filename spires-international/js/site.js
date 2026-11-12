(function () {
  var page = document.body.getAttribute("data-page") || "";
  var header = document.querySelector("[data-site-header]");
  var footer = document.querySelector("[data-site-footer]");

  function link(href, label, id) {
    var current = page === id ? ' aria-current="page"' : "";
    return '<a href="' + href + '"' + current + ">" + label + "</a>";
  }

  if (header) {
    header.innerHTML =
      '<p class="banner"><strong>Private preview.</strong> Fares are not approved. Payments, advertising and public search are turned off.</p>' +
      '<div class="wrap nav">' +
      '<a class="brand" href="index.html"><span>SPIRES</span><span>INTERNATIONAL</span></a>' +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>' +
      '<nav class="nav-links" id="site-nav">' +
      '<details class="menu"><summary>Airport transfers</summary><div class="menu-panel">' +
      link("airport-transfers.html", "All airports", "airports") +
      link("heathrow.html", "Heathrow (LHR)", "heathrow") +
      link("gatwick.html", "Gatwick (LGW)", "gatwick") +
      link("stansted.html", "Stansted (STN)", "stansted") +
      link("luton.html", "Luton (LTN)", "luton") +
      link("birmingham.html", "Birmingham (BHX)", "birmingham") +
      "</div></details>" +
      link("visiting-oxford.html", "Visiting Oxford", "visiting") +
      link("how-it-works.html", "How it works", "how") +
      '<a class="button" href="book.html">Request a quote</a>' +
      "</nav></div>";
    var toggle = header.querySelector(".nav-toggle");
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  if (footer) {
    footer.innerHTML =
      '<footer class="site-footer"><div class="wrap footer-row">' +
      '<div class="footer-brand">SPIRES<small>INTERNATIONAL</small></div>' +
      "<div>Oxford airport transfers</div>" +
      "<div>Operated by Spires Taxis Ltd</div>" +
      "</div><div class=\"wrap fine\" style=\"margin-top:0.8rem\">Licensed private hire operator, Oxford City Council. Private hire operator number 55. All journeys are pre booked. " +
      '<a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a> · <a href="contact.html">Contact</a></div></footer>';
  }

  var consent = document.createElement("div");
  consent.className = "consent";
  consent.hidden = true;
  consent.innerHTML =
    '<div class="wrap"><p style="margin:0">Allow a private measurement record on this preview? Nothing is sent to Google.</p>' +
    '<div><button type="button" class="button" data-consent="granted">Allow</button> <button type="button" class="button secondary" data-consent="denied">No thanks</button></div></div>';
  document.body.appendChild(consent);
  var stored = "";
  try { stored = localStorage.getItem("spires_international_consent") || ""; } catch (e) { stored = ""; }
  if (stored !== "granted" && stored !== "denied") consent.hidden = false;
  consent.addEventListener("click", function (event) {
    var choice = event.target.getAttribute("data-consent");
    if (!choice) return;
    try { localStorage.setItem("spires_international_consent", choice); } catch (e) {}
    consent.hidden = true;
  });
})();
