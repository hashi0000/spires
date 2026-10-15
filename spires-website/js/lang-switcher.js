(function () {
  const nav = document.querySelector(".lang-switcher");
  if (!nav) return;
  nav.addEventListener("click", function (event) {
    const link = event.target.closest("a");
    if (!link || link.getAttribute("aria-current") === "page") return;
    if (typeof gtag === "function") {
      gtag("event", "language_select", {
        language: link.getAttribute("hreflang") || "",
        from_language: document.documentElement.lang || "",
        page_path: location.pathname,
      });
    }
  });
})();
