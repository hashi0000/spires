export const LANGS = [
  { id: "en", hreflang: "en-GB", prefix: "", label: "English", htmlLang: "en-GB", locale: "en_GB" },
  { id: "ar", hreflang: "ar", prefix: "/ar", label: "العربية", htmlLang: "ar", locale: "ar_AR", dir: "rtl", font: "arabic" },
  { id: "zh", hreflang: "zh-Hans", prefix: "/zh", label: "中文", htmlLang: "zh-Hans", locale: "zh_CN", font: "sc" },
  { id: "es", hreflang: "es", prefix: "/es", label: "Español", htmlLang: "es", locale: "es_ES", font: "latin" },
  { id: "fr", hreflang: "fr", prefix: "/fr", label: "Français", htmlLang: "fr", locale: "fr_FR", font: "latin" },
  { id: "hi", hreflang: "hi", prefix: "/hi", label: "हिन्दी", htmlLang: "hi", locale: "hi_IN", font: "deva" },
  { id: "pl", hreflang: "pl", prefix: "/pl", label: "Polski", htmlLang: "pl", locale: "pl_PL", font: "latin" },
  { id: "pt", hreflang: "pt", prefix: "/pt", label: "Português", htmlLang: "pt", locale: "pt_BR", font: "latin" },
  { id: "de", hreflang: "de", prefix: "/de", label: "Deutsch", htmlLang: "de", locale: "de_DE", font: "latin" },
  { id: "it", hreflang: "it", prefix: "/it", label: "Italiano", htmlLang: "it", locale: "it_IT", font: "latin" },
  { id: "ur", hreflang: "ur", prefix: "/ur", label: "اردو", htmlLang: "ur", locale: "ur_PK", dir: "rtl", font: "arabic" },
];

/** English path → translated slug (empty string = language hub). */
export const PAGE_DEFS = [
  { key: "home", en: "/", slug: "" },
  { key: "heathrowIn", en: "/heathrow-to-oxford-taxi", slug: "/heathrow-to-oxford-taxi" },
  { key: "heathrowOut", en: "/oxford-to-heathrow-taxi", slug: "/oxford-to-heathrow-taxi" },
  { key: "gatwick", en: "/oxford-to-gatwick-taxi", slug: "/oxford-to-gatwick-taxi" },
  { key: "airport", en: "/airport-transfers", slug: "/airport-transfers" },
  { key: "pickup", en: "/how-airport-pickup-works", slug: "/how-airport-pickup-works" },
  { key: "student", en: "/student-taxis", slug: "/international-student-arrivals" },
  { key: "contact", en: "/contact", slug: "/contact" },
];

export function pathFor(lang, page) {
  if (!lang.prefix) return page.en;
  return `${lang.prefix}${page.slug}`;
}

export const LANG_CLUSTERS = PAGE_DEFS.map((page) => {
  const cluster = {};
  for (const lang of LANGS) cluster[lang.hreflang] = pathFor(lang, page);
  return cluster;
});

export function clusterForPath(pathname) {
  const p = pathname === "" ? "/" : pathname;
  return LANG_CLUSTERS.find((cluster) => Object.values(cluster).includes(p)) || null;
}

export function fileFromPath(p) {
  if (p === "/") return "index.html";
  const prefixes = LANGS.map((l) => l.prefix).filter(Boolean);
  if (prefixes.includes(p)) return `${p.slice(1)}/index.html`;
  return `${p.slice(1)}.html`;
}
