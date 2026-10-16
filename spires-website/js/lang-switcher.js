(function () {
  if (window.__spiresLangMenu) return;
  window.__spiresLangMenu = true;

  var LANGS = [
    { id: "en", hreflang: "en-GB", prefix: "", label: "English" },
    { id: "ar", hreflang: "ar", prefix: "/ar", label: "العربية" },
    { id: "zh", hreflang: "zh-Hans", prefix: "/zh", label: "中文" },
    { id: "es", hreflang: "es", prefix: "/es", label: "Español" },
    { id: "fr", hreflang: "fr", prefix: "/fr", label: "Français" },
    { id: "hi", hreflang: "hi", prefix: "/hi", label: "हिन्दी" },
    { id: "pl", hreflang: "pl", prefix: "/pl", label: "Polski" },
    { id: "pt", hreflang: "pt", prefix: "/pt", label: "Português" },
    { id: "de", hreflang: "de", prefix: "/de", label: "Deutsch" },
    { id: "it", hreflang: "it", prefix: "/it", label: "Italiano" },
    { id: "ur", hreflang: "ur", prefix: "/ur", label: "اردو" },
  ];

  var ROUTES = [
    { en: "/", slug: "" },
    { en: "/heathrow-to-oxford-taxi", slug: "/heathrow-to-oxford-taxi" },
    { en: "/oxford-to-heathrow-taxi", slug: "/oxford-to-heathrow-taxi" },
    { en: "/oxford-to-gatwick-taxi", slug: "/oxford-to-gatwick-taxi" },
    { en: "/airport-transfers", slug: "/airport-transfers" },
    { en: "/how-airport-pickup-works", slug: "/how-airport-pickup-works" },
    { en: "/student-taxis", slug: "/international-student-arrivals" },
    { en: "/contact", slug: "/contact" },
  ];

  function injectFonts() {
    if (document.querySelector("link[data-i18n-fonts]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-i18n-fonts", "1");
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@600;700&family=Noto+Sans+SC:wght@600;700&family=Noto+Sans+Devanagari:wght@600;700&display=swap";
    document.head.appendChild(link);
  }

  function cleanPath() {
    var p = (location.pathname || "/").replace(/\/+$/, "");
    return p || "/";
  }

  function langFromPath(pathname) {
    for (var i = 1; i < LANGS.length; i++) {
      var prefix = LANGS[i].prefix;
      if (pathname === prefix || pathname.indexOf(prefix + "/") === 0) return LANGS[i];
    }
    return LANGS[0];
  }

  function routeFromPath(pathname) {
    var current = langFromPath(pathname);
    var rest = current.prefix ? pathname.slice(current.prefix.length) || "" : pathname;
    if (rest === "") rest = "/";
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      if (current.id === "en") {
        if (r.en === rest || r.en === pathname) return r;
      } else if ((r.slug || "") === rest || current.prefix + (r.slug || "") === pathname) {
        return r;
      }
    }
    return null;
  }

  function hrefFor(lang, route) {
    if (!lang.prefix) return route ? route.en : "/";
    if (!route) return lang.prefix;
    return lang.prefix + (route.slug || "");
  }

  function currentLang() {
    return langFromPath(cleanPath());
  }

  function fillPanel(panel, current, route) {
    panel.innerHTML = "";
    LANGS.forEach(function (lang) {
      var a = document.createElement("a");
      a.href = hrefFor(lang, route);
      a.setAttribute("hreflang", lang.hreflang);
      a.setAttribute("lang", lang.hreflang);
      a.setAttribute("role", "option");
      a.textContent = lang.label;
      if (lang.id === current.id) a.setAttribute("aria-current", "page");
      panel.appendChild(a);
    });
  }

  function closeAll(except) {
    document.querySelectorAll("[data-lang-menu]").forEach(function (root) {
      if (root === except) return;
      var btn = root.querySelector(".lang-menu__btn");
      var panel = root.querySelector(".lang-menu__panel");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
      root.classList.remove("is-open");
    });
  }

  function bindMenu(root, current, route) {
    var btn = root.querySelector(".lang-menu__btn");
    var panel = root.querySelector(".lang-menu__panel");
    var label = root.querySelector("[data-lang-current]");
    if (!btn || !panel) return;
    if (label) label.textContent = current.label;
    fillPanel(panel, current, route);

    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var open = btn.getAttribute("aria-expanded") === "true";
      closeAll();
      if (!open) {
        btn.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        root.classList.add("is-open");
      }
    });

    panel.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link || link.getAttribute("aria-current") === "page") return;
      if (typeof gtag === "function") {
        gtag("event", "language_select", {
          language: link.getAttribute("hreflang") || "",
          from_language: document.documentElement.lang || "",
          page_path: location.pathname,
        });
      }
    });
  }

  injectFonts();
  var path = cleanPath();
  var current = currentLang();
  var route = routeFromPath(path);
  document.querySelectorAll("[data-lang-menu]").forEach(function (root) {
    bindMenu(root, current, route);
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-lang-menu]")) return;
    closeAll();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeAll();
  });
})();
