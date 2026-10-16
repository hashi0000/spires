#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LANGS, PAGE_DEFS, LANG_CLUSTERS, pathFor, fileFromPath } from './lib/i18n-clusters.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.spires-taxis.com';
const SKIP_WRITE = new Set(["en", "ar", "zh"]);

const FONT = {
  latin:
    "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&display=swap",
  arabic:
    "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap",
  sc: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Noto+Sans+SC:wght@400;600;700&display=swap",
  deva: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap",
};

function wa(text) {
  return `https://wa.me/447776897772?text=${encodeURIComponent(text)}`;
}

function hreflangBlock(enPath) {
  const cluster = LANG_CLUSTERS.find((c) => c["en-GB"] === enPath);
  const lines = Object.entries(cluster).map(([hl, p]) => {
    const href = p === "/" ? `${BASE}/` : `${BASE}${p}`;
    return `  <link rel="alternate" hreflang="${hl}" href="${href}">`;
  });
  const def = cluster["en-GB"] === "/" ? `${BASE}/` : `${BASE}${cluster["en-GB"]}`;
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${def}">`);
  return lines.join("\n");
}

function formHtml(lang, labels, landing, service) {
  return `      <form action="https://formspree.io/f/meozaolo" method="POST" class="booking-form">
          <input type="hidden" name="_next" value="${BASE}/thank-you">
          <input type="hidden" name="_subject" value="New Taxi Booking Request">
          <input type="hidden" name="language" value="${lang.htmlLang}">
          <input type="hidden" name="landing_page" value="${landing}">
          <input type="hidden" name="service" value="${service}">
          <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="form-field"><label for="name">${labels.name}</label><input type="text" id="name" name="name" required></div>
          <div class="form-field"><label for="email">${labels.email}</label><input type="email" id="email" name="email" required></div>
          <div class="form-field"><label for="phone">${labels.phone}</label><input type="tel" id="phone" name="phone" required></div>
          <div class="form-field"><label for="pickup">${labels.pickup}</label><input type="text" id="pickup" name="pickup" required></div>
          <div class="form-field"><label for="destination">${labels.drop}</label><input type="text" id="destination" name="destination" required></div>
          <div class="form-field"><label for="date">${labels.date}</label><input type="date" id="date" name="date" required></div>
          <div class="form-field"><label for="message">${labels.message}</label><textarea id="message" name="message" rows="4"></textarea></div>
          <div class="btn-group"><button type="submit" class="btn btn--primary">${labels.submit}</button></div>
        </form>`;
}

function cards(items) {
  return `<div class="i18n-links fade-in">
${items.map((it) => `        <a href="${it.href}">${it.label}</a>`).join("\n")}
      </div>`;
}

function faqJson(htmlLang, faqs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: htmlLang,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "") },
    })),
  });
}

function crumbsJson(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: `${BASE}${it.path === "/" ? "/" : it.path}`,
        })),
      },
      {
        "@type": "TaxiService",
        "@id": `${BASE}/#taxiservice`,
        name: "Spires Taxis",
        url: BASE,
        telephone: "+447776897772",
      },
    ],
  });
}

function pageHtml(lang, p) {
  const dir = lang.dir === "rtl" ? ` lang="${lang.htmlLang}" dir="rtl"` : ` lang="${lang.htmlLang}"`;
  return `<!DOCTYPE html>
<html${dir}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-RSE4NNBP64"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-RSE4NNBP64', { content_group: '${lang.htmlLang}' });
  </script>
  <link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/spireslogo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0c2340">
  <meta property="og:site_name" content="Spires Taxis">
  <meta property="og:locale" content="${lang.locale}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${p.ogTitle}">
  <title>${p.title}</title>
  <meta name="description" content="${p.description}">
  <link rel="canonical" href="${BASE}${p.canonical}">
${hreflangBlock(p.enPath)}
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${p.ogTitle}">
  <meta property="og:description" content="${p.ogDescription}">
  <meta property="og:url" content="${BASE}${p.canonical}">
  <meta property="og:image" content="${BASE}/android-chrome-512x512.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta name="twitter:image" content="${BASE}/android-chrome-512x512.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONT[lang.font]}" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  ${p.faqs ? `<script type="application/ld+json">\n  ${faqJson(lang.htmlLang, p.faqs)}\n  </script>` : ""}
  <script type="application/ld+json">
  ${crumbsJson(p.crumbs)}
  </script>
</head>
<body data-page="${p.dataPage}">
<!-- SITE-HEADER -->
<!-- /SITE-HEADER -->
<main id="main-content">
${p.body}
</main>
<!-- SITE-FOOTER -->
<!-- /SITE-FOOTER -->
</body>
</html>
`;
}

const COPY = {
  es: {
    note: "Nuestros conductores hablan principalmente inglés. Pueden escribirnos por WhatsApp en español y usaremos traducción. La reserva en customer.spires-taxis.com está en inglés.",
    form: { name: "Nombre completo *", email: "Correo electrónico *", phone: "Teléfono *", pickup: "Recogida *", drop: "Destino *", date: "Fecha *", message: "Notas", submit: "Enviar solicitud" },
    home: "Inicio",
    airport: "Traslados al aeropuerto",
    contact: "Contacto",
    ctas: { wa: "WhatsApp para un precio", call: "Llamar ahora", book: "Reservar en la web" },
    prices: ["Heathrow £92 ida o £180 ida y vuelta", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
    pages: {
      home: {
        title: "Taxi en Oxford | Precio cerrado antes de viajar | Spires Taxis",
        ogTitle: "Taxi en Oxford | Precio cerrado",
        description: "Empresa de taxi privado con licencia en Oxford. Precios fijos para aeropuertos y trayectos locales. Reserven con antelación. WhatsApp o 07776 897772.",
        ogDescription: "Taxi con licencia en Oxford. Precio fijo para aeropuerto y trayectos locales.",
        h1: "Taxi en Oxford, precio cerrado antes de salir",
        lead: "Somos una empresa de taxi privado con licencia en Oxford. Confirmamos la tarifa antes del viaje, sin taxímetro en el tráfico. Heathrow a Oxford en coche estándar <strong>£92 ida</strong> o <strong>£180 ida y vuelta</strong> hasta 4 pasajeros.",
        wa: "Hola, necesito un taxi en Oxford. Detalles:",
        more: "Páginas en español",
        moreLead: "Solo tarifas publicadas de Oxford. Otras localidades se cotizan aparte.",
        cover: "Qué cubrimos",
        coverP: "Trayectos en Oxford, recogidas en aeropuerto y destinos en colleges, hospitales y hoteles. La tarifa que confirmamos al reservar es la que pagan.",
        wait: "Tras el aterrizaje tienen 50 minutos para avisarnos de que están listos. Después, la espera es £10 por cada 30 minutos extra o fracción. El cargo estándar de recogida en aeropuerto está incluido.",
        listed: "Tarifas publicadas de Oxford",
        formH: "Pedir reserva",
      },
    },
  },
};

function linksFor(lang, t) {
  const p = lang.prefix;
  return [
    { href: `${p}/heathrow-to-oxford-taxi`, label: t.lHeathrowIn },
    { href: `${p}/international-student-arrivals`, label: t.lStudent },
    { href: `${p}/airport-transfers`, label: t.lAirport },
    { href: `${p}/oxford-to-heathrow-taxi`, label: t.lHeathrowOut },
    { href: `${p}/oxford-to-gatwick-taxi`, label: t.lGatwick },
    { href: `${p}/how-airport-pickup-works`, label: t.lPickup },
    { href: `${p}/contact`, label: t.lContact },
  ];
}

function buildLang(lang, t) {
  const pfx = lang.prefix;
  const home = t.home;
  const pages = [];

  pages.push({
    dataPage: "home",
    enPath: "/",
    canonical: pfx,
    title: home.title,
    ogTitle: home.ogTitle,
    description: home.description,
    ogDescription: home.ogDescription,
    crumbs: [{ name: t.navHome, path: pfx }],
    faqs: t.faqs.home,
    body: `  <section class="hero hero--compact">
    <div class="container hero__inner fade-in">
      <h1>${home.h1}</h1>
      <p class="hero__lead">${home.lead}</p>
      <div class="btn-group">
        <a href="${wa(home.wa)}" class="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">${t.ctaWa}</a>
        <a href="tel:+447776897772" class="btn btn--outline">${t.ctaCall}</a>
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">${t.ctaBook}</a>
      </div>
      <p class="lang-note">${t.note}</p>
    </div>
  </section>
  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in">
        <h2>${home.more}</h2>
        <p>${home.moreLead}</p>
      </div>
      ${cards(linksFor(lang, t))}
    </div>
  </section>
  <section class="section">
    <div class="container split">
      <div class="prose fade-in">
        <h2>${home.cover}</h2>
        <p>${home.coverP}</p>
        <p>${home.wait}</p>
      </div>
      <div class="fade-in">
        <h2>${home.listed}</h2>
        <ul class="included-list">
          ${t.prices.map((x) => `<li>${x}</li>`).join("\n          ")}
        </ul>
      </div>
    </div>
  </section>
  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in"><h2>${home.formH}</h2></div>
${formHtml(lang, t.form, pfx, "general")}
    </div>
  </section>`,
  });

  const ap = t.airport;
  pages.push({
    dataPage: "airport",
    enPath: "/airport-transfers",
    canonical: `${pfx}/airport-transfers`,
    title: ap.title,
    ogTitle: ap.ogTitle,
    description: ap.description,
    ogDescription: ap.ogDescription,
    crumbs: [
      { name: t.navHome, path: pfx },
      { name: t.navAirport, path: `${pfx}/airport-transfers` },
    ],
    faqs: t.faqs.airport,
    body: `  <section class="hero hero--compact">
    <div class="container hero__inner fade-in">
      <h1>${ap.h1}</h1>
      <p class="hero__lead">${ap.lead}</p>
      <div class="btn-group">
        <a href="${wa(ap.wa)}" class="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">${t.ctaWa}</a>
        <a href="tel:+447776897772" class="btn btn--outline">${t.ctaCall}</a>
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">${t.ctaBook}</a>
      </div>
      <p class="lang-note">${t.note}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section__header fade-in">
        <h2>${ap.tableH}</h2>
        <p>${ap.tableLead}</p>
      </div>
      <div class="price-block fade-in">
        <table class="price-table">
          <thead><tr><th>${ap.thAirport}</th><th>${ap.thOne}</th><th>${ap.thRet}</th></tr></thead>
          <tbody>
            <tr><td><a href="${pfx}/oxford-to-heathrow-taxi">Heathrow</a></td><td>£92</td><td>£180</td></tr>
            <tr><td><a href="${pfx}/oxford-to-gatwick-taxi">Gatwick</a></td><td>£140</td><td>£270</td></tr>
            <tr><td>Luton</td><td>£105</td><td>£205</td></tr>
            <tr><td>Stansted</td><td>£150</td><td>£290</td></tr>
            <tr><td>Birmingham</td><td>£110</td><td>£215</td></tr>
            <tr><td>London City</td><td>£150</td><td>£290</td></tr>
            <tr><td>Bristol</td><td>£165</td><td>£320</td></tr>
          </tbody>
        </table>
      </div>
      <p class="fade-in" style="margin-top:1rem;">${ap.eight}</p>
    </div>
  </section>
  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in"><h2>${ap.formH}</h2></div>
${formHtml(lang, t.form, `${pfx}/airport-transfers`, "airport-transfer")}
    </div>
  </section>`,
  });

  function routePage(spec, enPath, slug, dataPage, crumbName) {
    return {
      dataPage,
      enPath,
      canonical: `${pfx}${slug}`,
      title: spec.title,
      ogTitle: spec.ogTitle,
      description: spec.description,
      ogDescription: spec.ogDescription,
      crumbs: [
        { name: t.navHome, path: pfx },
        { name: t.navAirport, path: `${pfx}/airport-transfers` },
        { name: crumbName, path: `${pfx}${slug}` },
      ],
      faqs: spec.faqs,
      body: `  <section class="hero hero--compact">
    <div class="container hero__inner fade-in">
      <h1>${spec.h1}</h1>
      <p class="hero__lead">${spec.lead}</p>
      <div class="btn-group">
        <a href="${wa(spec.wa)}" class="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">${t.ctaWa}</a>
        <a href="tel:+447776897772" class="btn btn--outline">${t.ctaCall}</a>
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">${t.ctaBook}</a>
      </div>
      <p class="lang-note">${t.note}</p>
    </div>
  </section>
  <section class="section">
    <div class="container split">
      <div class="prose fade-in">
        <h2>${spec.h2}</h2>
        <p>${spec.p}</p>
        <div class="callout"><p>${spec.callout}</p></div>
      </div>
      <div class="fade-in">
        ${cards(spec.links)}
      </div>
    </div>
  </section>
  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in"><h2>${spec.formH}</h2></div>
${formHtml(lang, t.form, `${pfx}${slug}`, spec.service || "airport-transfer")}
    </div>
  </section>`,
    };
  }

  pages.push(
    routePage(t.heathrowOut, "/oxford-to-heathrow-taxi", "/oxford-to-heathrow-taxi", "heathrow", t.crumbHeathrowOut)
  );
  pages.push(routePage(t.gatwick, "/oxford-to-gatwick-taxi", "/oxford-to-gatwick-taxi", "airport", t.crumbGatwick));
  pages.push(
    routePage(t.heathrowIn, "/heathrow-to-oxford-taxi", "/heathrow-to-oxford-taxi", "airport", t.crumbHeathrowIn)
  );
  pages.push(routePage(t.pickup, "/how-airport-pickup-works", "/how-airport-pickup-works", "pickup", t.crumbPickup));
  pages.push(
    routePage(t.student, "/student-taxis", "/international-student-arrivals", "student", t.crumbStudent)
  );
  pages.push(
    routePage(t.contact, "/contact", "/contact", "contact", t.navContact)
  );

  return pages;
}

function pack(shared) {
  return shared;
}

const LANG_COPY = {
  es: pack({
    note: "Nuestros conductores hablan principalmente inglés. Pueden escribirnos por WhatsApp en español y usaremos traducción. La reserva en customer.spires-taxis.com está en inglés.",
    form: { name: "Nombre completo *", email: "Correo electrónico *", phone: "Teléfono *", pickup: "Recogida *", drop: "Destino *", date: "Fecha *", message: "Notas", submit: "Enviar solicitud" },
    navHome: "Inicio",
    navAirport: "Traslados al aeropuerto",
    navContact: "Contacto",
    ctaWa: "WhatsApp para un precio",
    ctaCall: "Llamar ahora",
    ctaBook: "Reservar en la web",
    prices: ["Heathrow £92 ida o £180 ida y vuelta", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
    lHeathrowIn: "Heathrow a Oxford · £92 / £180",
    lStudent: "Llegada de estudiantes",
    lAirport: "Traslados y precios",
    lHeathrowOut: "Oxford a Heathrow",
    lGatwick: "Oxford a Gatwick",
    lPickup: "Cómo funciona la recogida",
    lContact: "WhatsApp, teléfono y reserva",
    crumbHeathrowOut: "Oxford a Heathrow",
    crumbGatwick: "Oxford a Gatwick",
    crumbHeathrowIn: "Heathrow a Oxford",
    crumbPickup: "Recogida en aeropuerto",
    crumbStudent: "Estudiantes",
    faqs: {
      home: [
        { q: "¿Cuánto cuesta Heathrow a Oxford?", a: "Coche estándar £92 ida o £180 ida y vuelta hasta 4 pasajeros. El precio confirmado al reservar es el que pagan." },
        { q: "¿Los conductores hablan español?", a: "Hablan principalmente inglés. Pueden escribirnos en español por WhatsApp y usaremos traducción." },
      ],
      airport: [
        { q: "¿Cuáles son las tarifas publicadas desde Oxford?", a: "Coche estándar hasta 4 pasajeros: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 ida e ida y vuelta al reservar ambos trayectos juntos." },
        { q: "¿La espera tras el aterrizaje está incluida?", a: "Sí. Tienen 50 minutos desde el aterrizaje real para avisarnos. Después, £10 por cada 30 minutos extra o fracción." },
      ],
    },
    home: {
      title: "Taxi en Oxford | Precio cerrado antes de viajar | Spires Taxis",
      ogTitle: "Taxi en Oxford | Precio cerrado",
      description: "Empresa de taxi privado con licencia en Oxford. Precios fijos para aeropuertos y trayectos locales. Reserven con antelación. WhatsApp o 07776 897772.",
      ogDescription: "Taxi con licencia en Oxford. Precio fijo para aeropuerto y trayectos locales.",
      h1: "Taxi en Oxford, precio cerrado antes de salir",
      lead: "Somos una empresa de taxi privado con licencia en Oxford. Confirmamos la tarifa antes del viaje, sin taxímetro en el tráfico. Heathrow a Oxford en coche estándar <strong>£92 ida</strong> o <strong>£180 ida y vuelta</strong> hasta 4 pasajeros.",
      wa: "Hola, necesito un taxi en Oxford. Detalles:",
      more: "Páginas en español",
      moreLead: "Solo tarifas publicadas de Oxford. Otras localidades se cotizan aparte.",
      cover: "Qué cubrimos",
      coverP: "Trayectos en Oxford, recogidas en aeropuerto y destinos en colleges, hospitales y hoteles. La tarifa que confirmamos al reservar es la que pagan.",
      wait: "Tras el aterrizaje tienen 50 minutos para avisarnos de que están listos. Después, la espera es £10 por cada 30 minutos extra o fracción. El cargo estándar de recogida en aeropuerto está incluido.",
      listed: "Tarifas publicadas de Oxford",
      formH: "Pedir reserva",
    },
    airport: {
      title: "Traslados al aeropuerto desde Oxford | Precios publicados | Spires Taxis",
      ogTitle: "Traslados al aeropuerto desde Oxford",
      description: "Tarifas de Oxford en coche estándar: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 minutos tras el aterrizaje.",
      ogDescription: "Precios publicados de Oxford a Heathrow, Gatwick, Luton y Stansted.",
      h1: "Traslados al aeropuerto desde Oxford y hacia Oxford",
      lead: "Precios fijos desde direcciones de Oxford a los aeropuertos principales, y recogida a la llegada. Coche estándar hasta 4 pasajeros. Otras localidades se cotizan aparte.",
      wa: "Hola, necesito un traslado al aeropuerto desde Oxford. Aeropuerto: []. Fecha: []",
      tableH: "Coche estándar desde Oxford",
      tableLead: "Hasta 4 pasajeros. Ida y vuelta al reservar ambos trayectos de Oxford juntos.",
      thAirport: "Aeropuerto",
      thOne: "Ida",
      thRet: "Ida y vuelta",
      eight: 'Precios del vehículo de 8 plazas en la <a href="/rates">página de tarifas en inglés</a>.',
      formH: "Pedir traslado",
    },
  }),
};

function finishPack(t, pfx) {
  t.heathrowOut = {
    title: t._hoTitle,
    ogTitle: t._hoOg,
    description: t._hoDesc,
    ogDescription: t._hoOgDesc,
    h1: t._hoH1,
    lead: t._hoLead,
    wa: t._hoWa,
    h2: t._hoH2,
    p: t._hoP,
    callout: t._hoCallout,
    formH: t._hoForm,
    faqs: t._hoFaqs,
    links: [
      { href: `${pfx}/heathrow-to-oxford-taxi`, label: t.lHeathrowIn },
      { href: `${pfx}/airport-transfers`, label: t.lAirport },
      { href: `${pfx}/how-airport-pickup-works`, label: t.lPickup },
    ],
  };
  t.gatwick = {
    title: t._gwTitle,
    ogTitle: t._gwOg,
    description: t._gwDesc,
    ogDescription: t._gwOgDesc,
    h1: t._gwH1,
    lead: t._gwLead,
    wa: t._gwWa,
    h2: t._gwH2,
    p: t._gwP,
    callout: t._gwCallout,
    formH: t._gwForm,
    faqs: t._gwFaqs,
    links: [
      { href: `${pfx}/airport-transfers`, label: t.lAirport },
      { href: `${pfx}/oxford-to-heathrow-taxi`, label: t.lHeathrowOut },
      { href: `${pfx}/international-student-arrivals`, label: t.lStudent },
    ],
  };
  t.heathrowIn = {
    title: t._hiTitle,
    ogTitle: t._hiOg,
    description: t._hiDesc,
    ogDescription: t._hiOgDesc,
    h1: t._hiH1,
    lead: t._hiLead,
    wa: t._hiWa,
    h2: t._hiH2,
    p: t._hiP,
    callout: t._hiCallout,
    formH: t._hiForm,
    faqs: t._hiFaqs,
    links: [
      { href: `${pfx}/oxford-to-heathrow-taxi`, label: t.lHeathrowOut },
      { href: `${pfx}/how-airport-pickup-works`, label: t.lPickup },
      { href: `${pfx}/contact`, label: t.lContact },
    ],
  };
  t.pickup = {
    title: t._pkTitle,
    ogTitle: t._pkOg,
    description: t._pkDesc,
    ogDescription: t._pkOgDesc,
    h1: t._pkH1,
    lead: t._pkLead,
    wa: t._pkWa,
    h2: t._pkH2,
    p: t._pkP,
    callout: t._pkCallout,
    formH: t._pkForm,
    faqs: t._pkFaqs,
    links: [
      { href: `${pfx}/heathrow-to-oxford-taxi`, label: t.lHeathrowIn },
      { href: `${pfx}/airport-transfers`, label: t.lAirport },
      { href: `${pfx}/contact`, label: t.lContact },
    ],
  };
  t.student = {
    title: t._stTitle,
    ogTitle: t._stOg,
    description: t._stDesc,
    ogDescription: t._stOgDesc,
    h1: t._stH1,
    lead: t._stLead,
    wa: t._stWa,
    h2: t._stH2,
    p: t._stP,
    callout: t._stCallout,
    formH: t._stForm,
    service: "student-service",
    faqs: t._stFaqs,
    links: [
      { href: `${pfx}/heathrow-to-oxford-taxi`, label: t.lHeathrowIn },
      { href: `${pfx}/airport-transfers`, label: t.lAirport },
      { href: `${pfx}/contact`, label: t.lContact },
    ],
  };
  t.contact = {
    title: t._ctTitle,
    ogTitle: t._ctOg,
    description: t._ctDesc,
    ogDescription: t._ctOgDesc,
    h1: t._ctH1,
    lead: t._ctLead,
    wa: t._ctWa,
    h2: t._ctH2,
    p: t._ctP,
    callout: t._ctCallout,
    formH: t._ctForm,
    service: "contact",
    faqs: t._ctFaqs,
    links: [
      { href: `${pfx}/airport-transfers`, label: t.lAirport },
      { href: `${pfx}/heathrow-to-oxford-taxi`, label: t.lHeathrowIn },
      { href: `${pfx}/international-student-arrivals`, label: t.lStudent },
    ],
  };
  return t;
}

function addRoutes(t, r) {
  Object.assign(t, r);
  return t;
}

addRoutes(LANG_COPY.es, {
  _hoTitle: "Taxi de Oxford a Heathrow | Precio fijo | Spires Taxis",
  _hoOg: "Taxi de Oxford a Heathrow",
  _hoDesc: "De Oxford a las terminales 2, 3, 4 y 5 de Heathrow. Coche estándar £92 ida o £180 ida y vuelta. El cargo estándar de llegada al aeropuerto está incluido.",
  _hoOgDesc: "Oxford a Heathrow £92 ida o £180 ida y vuelta en coche estándar.",
  _hoH1: "Taxi de Oxford a Heathrow",
  _hoLead: "Traslado reservado de antemano a las terminales 2, 3, 4 y 5. Coche estándar <strong>£92 ida</strong> o <strong>£180 ida y vuelta</strong> hasta 4 pasajeros. El cargo estándar de llegada al aeropuerto está incluido.",
  _hoWa: "Hola, necesito un coche de Oxford a Heathrow. Dirección: []. Vuelo: []",
  _hoH2: "Cuándo salir de Oxford",
  _hoP: "Indiquen terminal, hora de salida, pasajeros y maletas. El trayecto suele ser de 60 a 90 minutos en tráfico normal.",
  _hoCallout: "<strong>Coche estándar £92 o £180 ida y vuelta</strong> para Oxford hasta 4 pasajeros.",
  _hoForm: "Pedir traslado a Heathrow",
  _hoFaqs: [
    { q: "¿Cuánto cuesta Oxford a Heathrow?", a: "Coche estándar £92 ida o £180 ida y vuelta hasta 4 pasajeros al reservar ambos trayectos juntos." },
    { q: "¿Incluye el cargo de llegada al aeropuerto?", a: "Sí. El cargo estándar de llegada está incluido en el precio publicado." },
  ],
  _gwTitle: "Taxi de Oxford a Gatwick | Precio fijo | Spires Taxis",
  _gwOg: "Taxi de Oxford a Gatwick",
  _gwDesc: "De Oxford a Gatwick en coche estándar £140 ida o £270 ida y vuelta hasta 4 pasajeros. El precio confirmado al reservar es el que pagan.",
  _gwOgDesc: "Oxford a Gatwick £140 ida o £270 ida y vuelta.",
  _gwH1: "Taxi de Oxford a Gatwick",
  _gwLead: "Traslado reservado de antemano a Gatwick. Coche estándar <strong>£140 ida</strong> o <strong>£270 ida y vuelta</strong> hasta 4 pasajeros. Indiquen la terminal al reservar.",
  _gwWa: "Hola, necesito un coche de Oxford a Gatwick. Dirección: []. Vuelo: []",
  _gwH2: "Ruta habitual al final de curso",
  _gwP: "Muchas reservas de estudiantes van a Gatwick con maletas. Si van cuatro o necesitan un vehículo de 8 plazas, díganos cuántas maletas llevan.",
  _gwCallout: "Otras tarifas de Oxford en <a href=\"/es/airport-transfers\">traslados al aeropuerto</a>.",
  _gwForm: "Pedir traslado a Gatwick",
  _gwFaqs: [
    { q: "¿Cuánto cuesta Oxford a Gatwick?", a: "Coche estándar £140 ida o £270 ida y vuelta hasta 4 pasajeros al reservar ambos trayectos juntos." },
    { q: "¿Llegan a North y South Terminal?", a: "Sí. Indiquen la terminal al reservar." },
  ],
  _hiTitle: "Taxi de Heathrow a Oxford | Precio fijo | Spires Taxis",
  _hiOg: "Taxi de Heathrow a Oxford",
  _hiDesc: "Recogida en cualquier terminal de Heathrow hacia Oxford. Coche estándar £92 ida o £180 ida y vuelta. 50 minutos tras el aterrizaje.",
  _hiOgDesc: "Heathrow a Oxford £92 ida o £180 ida y vuelta.",
  _hiH1: "Taxi de Heathrow a Oxford",
  _hiLead: "Recogida reservada de antemano desde cualquier terminal de Heathrow hacia Oxford, incluida Headington. Coche estándar <strong>£92 ida</strong> o <strong>£180 ida y vuelta</strong> hasta 4 pasajeros.",
  _hiWa: "Hola, necesito un coche de Heathrow a Oxford. Terminal: []. Vuelo: []. Destino: []",
  _hiH2: "Recogida a la llegada",
  _hiP: "Envíen número de vuelo y terminal. Seguimos la hora real de aterrizaje. Tienen 50 minutos para avisarnos de que están listos.",
  _hiCallout: "<strong>Coche estándar £92 o £180 ida y vuelta</strong> para Oxford hasta 4 pasajeros.",
  _hiForm: "Pedir recogida",
  _hiFaqs: [
    { q: "¿Cuánto cuesta Heathrow a Oxford?", a: "Coche estándar £92 ida o £180 ida y vuelta hasta 4 pasajeros." },
    { q: "¿El conductor espera en llegadas?", a: "Sí. Indiquen terminal y número de vuelo. Puede esperar en llegadas con un cartel con el nombre." },
  ],
  _pkTitle: "Cómo funciona la recogida en el aeropuerto | Spires Taxis",
  _pkOg: "Cómo funciona la recogida en el aeropuerto",
  _pkDesc: "Seguimos el vuelo según la hora real de aterrizaje. 50 minutos para avisarnos, después £10 por cada 30 minutos. El cargo estándar de recogida está incluido.",
  _pkOgDesc: "50 minutos tras el aterrizaje, luego £10 por cada 30 minutos.",
  _pkH1: "Cómo funciona la recogida en el aeropuerto",
  _pkLead: "Calculamos el horario con la hora real de aterrizaje. Tienen <strong>50 minutos</strong> para avisarnos. Después, la espera es <strong>£10 por cada 30 minutos</strong> extra o fracción.",
  _pkWa: "Hola, necesito recogida en el aeropuerto. Vuelo: []. Terminal: []. Destino: []",
  _pkH2: "El día del viaje",
  _pkP: "Antes de despegar confirmamos terminal y móvil. Al aterrizar seguimos el vuelo. Tras el equipaje, avisen dentro de 50 minutos. El conductor se pone en contacto.",
  _pkCallout: "El cargo estándar de recogida en aeropuerto está incluido.",
  _pkForm: "Pedir recogida",
  _pkFaqs: [
    { q: "¿Cuántos minutos de espera hay?", a: "50 minutos desde el aterrizaje real. Después £10 por cada 30 minutos extra o fracción." },
    { q: "¿Qué enviamos al reservar?", a: "Número de vuelo, terminal si la conocen, pasajeros, maletas, un móvil que funcione en el Reino Unido y la dirección completa." },
  ],
  _stTitle: "Llegada de estudiantes a Oxford | Taxi al aeropuerto | Spires Taxis",
  _stOg: "Llegada de estudiantes a Oxford",
  _stDesc: "Del aeropuerto al college o residencia, con maletas. Descuento de estudiante con carné válido. Los conductores hablan principalmente inglés.",
  _stOgDesc: "Recogida al college o residencia. Descuento de estudiante con carné válido.",
  _stH1: "Llegada de estudiantes a Oxford",
  _stLead: "Del aeropuerto al college o a la residencia, con maletas. Hay <strong>descuento de estudiante</strong>. Menciónenlo al reservar y traigan un carné válido.",
  _stWa: "Hola, necesito un taxi de estudiante en Oxford. Fecha: []. Recogida: []. Destino: []. Descuento de estudiante",
  _stH2: "Cuándo reservan los estudiantes",
  _stP: "Las semanas de inicio de curso son las más ocupadas. Recogemos en colleges de la Universidad de Oxford, Oxford Brookes en Headington y casas compartidas. Hay descuento de estudiante en nuestros servicios con carné válido el día del viaje.",
  _stCallout: "Oxford a Heathrow en coche estándar £92 ida o £180 ida y vuelta hasta 4 pasajeros.",
  _stForm: "Pedir taxi de estudiante",
  _stFaqs: [
    { q: "¿Hay descuento de estudiante?", a: "Sí. Menciónenlo al reservar y traigan un carné de estudiante válido el día del viaje." },
    { q: "¿Pueden ir cuatro estudiantes a Heathrow?", a: "Sí. Coche estándar de Oxford a Heathrow £92 ida o £180 ida y vuelta hasta 4 pasajeros." },
  ],
  _ctTitle: "Contacto en Oxford | WhatsApp y teléfono | Spires Taxis ES",
  _ctOg: "Contacto en Oxford",
  _ctDesc: "Reserven por WhatsApp, teléfono 07776 897772 o correo bookings@spires-taxis.com. Trayectos reservados de antemano en Oxford y Oxfordshire.",
  _ctOgDesc: "WhatsApp, 07776 897772 o bookings@spires-taxis.com para reservar un taxi en Oxford.",
  _ctH1: "Contacto",
  _ctLead: "WhatsApp, llamada o el formulario. Teléfono <strong>07776 897772</strong>. Correo <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
  _ctWa: "Hola, necesito reservar un taxi en Oxford.",
  _ctH2: "Qué necesitamos para confirmar el precio",
  _ctP: "Fecha y hora, dirección completa, destino, pasajeros y maletas, y el número de vuelo si es recogida en aeropuerto.",
  _ctCallout: "La reserva en la web está en inglés. WhatsApp puede ser en español con traducción.",
  _ctForm: "Enviar solicitud",
  _ctFaqs: [
    { q: "¿Cuál es la forma más rápida de reservar?", a: "WhatsApp al 07776 897772 suele ser lo más rápido si envían dirección, fecha y número de vuelo." },
    { q: "¿Se puede reservar en español?", a: "Sí, por WhatsApp en español con traducción. Los conductores hablan principalmente inglés." },
  ],
});

function localePack(id, strings) {
  LANG_COPY[id] = addRoutes(pack(strings.base), strings.routes);
}

localePack("fr", {
  base: {
    note: "Nos chauffeurs parlent surtout anglais. Vous pouvez nous écrire en français sur WhatsApp ; nous utiliserons la traduction. La réservation sur customer.spires-taxis.com est en anglais.",
    form: { name: "Nom complet *", email: "E-mail *", phone: "Téléphone *", pickup: "Prise en charge *", drop: "Destination *", date: "Date *", message: "Notes", submit: "Envoyer la demande" },
    navHome: "Accueil",
    navAirport: "Transferts aéroport",
    navContact: "Contact",
    ctaWa: "WhatsApp pour un prix",
    ctaCall: "Appeler",
    ctaBook: "Réserver en ligne",
    prices: ["Heathrow £92 aller ou £180 aller-retour", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
    lHeathrowIn: "Heathrow vers Oxford · £92 / £180",
    lStudent: "Arrivée des étudiants",
    lAirport: "Transferts et tarifs",
    lHeathrowOut: "Oxford vers Heathrow",
    lGatwick: "Oxford vers Gatwick",
    lPickup: "Comment se passe l accueil",
    lContact: "WhatsApp, téléphone et réservation",
    crumbHeathrowOut: "Oxford vers Heathrow",
    crumbGatwick: "Oxford vers Gatwick",
    crumbHeathrowIn: "Heathrow vers Oxford",
    crumbPickup: "Accueil à l aéroport",
    crumbStudent: "Étudiants",
    faqs: {
      home: [
        { q: "Combien coûte Heathrow vers Oxford ?", a: "Voiture standard £92 aller ou £180 aller-retour jusqu à 4 passagers. Le prix confirmé à la réservation est celui que vous payez." },
        { q: "Les chauffeurs parlent-ils français ?", a: "Ils parlent surtout anglais. Vous pouvez écrire en français sur WhatsApp ; nous utiliserons la traduction." },
      ],
      airport: [
        { q: "Quels sont les tarifs publiés au départ d Oxford ?", a: "Voiture standard jusqu à 4 passagers : Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 aller et aller-retour si les deux trajets sont réservés ensemble." },
        { q: "L attente après l atterrissage est-elle incluse ?", a: "Oui. Vous avez 50 minutes après l atterrissage réel pour nous dire que vous êtes prêts. Ensuite £10 par 30 minutes supplémentaires ou fraction." },
      ],
    },
    home: {
      title: "Taxi Oxford | Prix fixé avant le départ | Spires Taxis",
      ogTitle: "Taxi Oxford | Prix fixé",
      description: "Société de taxi privé licenciée à Oxford. Tarifs fixes pour aéroports et trajets locaux. Réservez à l avance. WhatsApp ou 07776 897772.",
      ogDescription: "Taxi licencié à Oxford. Tarif fixe aéroport et trajets locaux.",
      h1: "Taxi à Oxford, prix fixé avant de partir",
      lead: "Nous sommes une société de taxi privé licenciée à Oxford. Nous confirmons le tarif avant le trajet, sans compteur dans les bouchons. Heathrow vers Oxford en voiture standard <strong>£92 aller</strong> ou <strong>£180 aller-retour</strong> jusqu à 4 passagers.",
      wa: "Bonjour, j ai besoin d un taxi à Oxford. Détails :",
      more: "Pages en français",
      moreLead: "Uniquement les tarifs publiés d Oxford. Les villes voisines sont cotées à part.",
      cover: "Ce que nous couvrons",
      coverP: "Trajets dans Oxford, accueil à l aéroport, colleges, hôpitaux et hôtels. Le tarif confirmé à la réservation est celui que vous payez.",
      wait: "Après l atterrissage, vous avez 50 minutes pour nous dire que vous êtes prêts. Ensuite l attente est de £10 par 30 minutes supplémentaires ou fraction. Les frais d accueil standard à l aéroport sont inclus.",
      listed: "Tarifs publiés d Oxford",
      formH: "Demander une réservation",
    },
    airport: {
      title: "Transferts aéroport depuis Oxford | Tarifs publiés | Spires Taxis",
      ogTitle: "Transferts aéroport depuis Oxford",
      description: "Tarifs Oxford en voiture standard : Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 minutes après l atterrissage.",
      ogDescription: "Tarifs publiés Oxford vers Heathrow, Gatwick, Luton et Stansted.",
      h1: "Transferts aéroport depuis Oxford et vers Oxford",
      lead: "Tarifs fixes depuis une adresse à Oxford vers les grands aéroports, et accueil à l arrivée. Voiture standard jusqu à 4 passagers. Les villes voisines sont cotées à part.",
      wa: "Bonjour, j ai besoin d un transfert aéroport depuis Oxford. Aéroport : []. Date : []",
      tableH: "Voiture standard depuis Oxford",
      tableLead: "Jusqu à 4 passagers. Aller-retour si les deux trajets Oxford sont réservés ensemble.",
      thAirport: "Aéroport",
      thOne: "Aller",
      thRet: "Aller-retour",
      eight: 'Tarifs du véhicule 8 places sur la <a href="/rates">page des tarifs en anglais</a>.',
      formH: "Demander un transfert",
    },
  },
  routes: {
    _hoTitle: "Taxi Oxford vers Heathrow | Prix fixe | Spires Taxis",
    _hoOg: "Taxi Oxford vers Heathrow",
    _hoDesc: "D Oxford vers les terminaux 2, 3, 4 et 5 de Heathrow. Voiture standard £92 aller ou £180 aller-retour. Les frais de dépose standard sont inclus.",
    _hoOgDesc: "Oxford vers Heathrow £92 aller ou £180 aller-retour.",
    _hoH1: "Taxi d Oxford vers Heathrow",
    _hoLead: "Trajet réservé à l avance vers les terminaux 2, 3, 4 et 5. Voiture standard <strong>£92 aller</strong> ou <strong>£180 aller-retour</strong> jusqu à 4 passagers.",
    _hoWa: "Bonjour, j ai besoin d une voiture d Oxford vers Heathrow. Adresse : []. Vol : []",
    _hoH2: "Quand partir d Oxford",
    _hoP: "Indiquez le terminal, l heure de départ, le nombre de passagers et les bagages. Comptez 60 à 90 minutes en trafic normal.",
    _hoCallout: "<strong>Voiture standard £92 ou £180 aller-retour</strong> pour Oxford jusqu à 4 passagers.",
    _hoForm: "Demander un trajet vers Heathrow",
    _hoFaqs: [
      { q: "Combien coûte Oxford vers Heathrow ?", a: "Voiture standard £92 aller ou £180 aller-retour jusqu à 4 passagers si les deux trajets sont réservés ensemble." },
      { q: "Les frais de dépose sont-ils inclus ?", a: "Oui. Les frais de dépose standard à l aéroport sont inclus." },
    ],
    _gwTitle: "Taxi Oxford vers Gatwick | Prix fixe | Spires Taxis",
    _gwOg: "Taxi Oxford vers Gatwick",
    _gwDesc: "D Oxford vers Gatwick en voiture standard £140 aller ou £270 aller-retour jusqu à 4 passagers.",
    _gwOgDesc: "Oxford vers Gatwick £140 aller ou £270 aller-retour.",
    _gwH1: "Taxi d Oxford vers Gatwick",
    _gwLead: "Trajet réservé à l avance vers Gatwick. Voiture standard <strong>£140 aller</strong> ou <strong>£270 aller-retour</strong> jusqu à 4 passagers.",
    _gwWa: "Bonjour, j ai besoin d une voiture d Oxford vers Gatwick. Adresse : []. Vol : []",
    _gwH2: "Souvent en fin de trimestre",
    _gwP: "Beaucoup d étudiants partent vers Gatwick avec des valises. Si vous êtes quatre ou si vous avez besoin d un véhicule 8 places, dites-nous le nombre de bagages.",
    _gwCallout: 'Autres tarifs Oxford sur <a href="/fr/airport-transfers">transferts aéroport</a>.',
    _gwForm: "Demander un trajet vers Gatwick",
    _gwFaqs: [
      { q: "Combien coûte Oxford vers Gatwick ?", a: "Voiture standard £140 aller ou £270 aller-retour jusqu à 4 passagers." },
      { q: "North et South Terminal ?", a: "Oui. Indiquez le terminal à la réservation." },
    ],
    _hiTitle: "Taxi Heathrow vers Oxford | Prix fixe | Spires Taxis",
    _hiOg: "Taxi Heathrow vers Oxford",
    _hiDesc: "Accueil à n importe quel terminal de Heathrow vers Oxford. Voiture standard £92 aller ou £180 aller-retour. 50 minutes après l atterrissage.",
    _hiOgDesc: "Heathrow vers Oxford £92 aller ou £180 aller-retour.",
    _hiH1: "Taxi de Heathrow vers Oxford",
    _hiLead: "Accueil réservé à l avance depuis n importe quel terminal de Heathrow vers Oxford, y compris Headington. Voiture standard <strong>£92 aller</strong> ou <strong>£180 aller-retour</strong>.",
    _hiWa: "Bonjour, j ai besoin d une voiture de Heathrow vers Oxford. Terminal : []. Vol : []. Destination : []",
    _hiH2: "Accueil à l arrivée",
    _hiP: "Envoyez le numéro de vol et le terminal. Nous suivons l heure réelle d atterrissage. Vous avez 50 minutes pour nous dire que vous êtes prêts.",
    _hiCallout: "<strong>Voiture standard £92 ou £180 aller-retour</strong> pour Oxford jusqu à 4 passagers.",
    _hiForm: "Demander un accueil",
    _hiFaqs: [
      { q: "Combien coûte Heathrow vers Oxford ?", a: "Voiture standard £92 aller ou £180 aller-retour jusqu à 4 passagers." },
      { q: "Le chauffeur attend-il en arrivées ?", a: "Oui. Indiquez le terminal et le numéro de vol. Il peut attendre en arrivées avec un panneau au nom." },
    ],
    _pkTitle: "Comment se passe l accueil à l aéroport | Spires Taxis",
    _pkOg: "Comment se passe l accueil à l aéroport",
    _pkDesc: "Nous suivons le vol selon l heure réelle d atterrissage. 50 minutes pour nous prévenir, puis £10 par 30 minutes. Les frais d accueil standard sont inclus.",
    _pkOgDesc: "50 minutes après l atterrissage, puis £10 par 30 minutes.",
    _pkH1: "Comment se passe l accueil à l aéroport",
    _pkLead: "Nous nous calons sur l heure réelle d atterrissage. Vous avez <strong>50 minutes</strong> pour nous prévenir. Ensuite l attente est de <strong>£10 par 30 minutes</strong> supplémentaires ou fraction.",
    _pkWa: "Bonjour, j ai besoin d un accueil à l aéroport. Vol : []. Terminal : []. Destination : []",
    _pkH2: "Le jour du voyage",
    _pkP: "Avant le départ nous confirmons terminal et mobile. À l atterrissage nous suivons le vol. Après les bagages, prévenez-nous dans les 50 minutes.",
    _pkCallout: "Les frais d accueil standard à l aéroport sont inclus.",
    _pkForm: "Demander un accueil",
    _pkFaqs: [
      { q: "Combien de minutes d attente ?", a: "50 minutes après l atterrissage réel. Ensuite £10 par 30 minutes supplémentaires ou fraction." },
      { q: "Que faut-il envoyer ?", a: "Numéro de vol, terminal si vous le connaissez, passagers, bagages, un mobile utilisable au Royaume-Uni et l adresse complète." },
    ],
    _stTitle: "Arrivée des étudiants à Oxford | Taxi aéroport | Spires Taxis",
    _stOg: "Arrivée des étudiants à Oxford",
    _stDesc: "De l aéroport au college ou à la résidence, avec valises. Réduction étudiante sur présentation d une carte valide. Les chauffeurs parlent surtout anglais.",
    _stOgDesc: "Accueil vers le college ou la résidence. Réduction étudiante avec carte valide.",
    _stH1: "Arrivée des étudiants à Oxford",
    _stLead: "De l aéroport au college ou à la résidence, avec les valises. Une <strong>réduction étudiante</strong> est disponible. Mentionnez-la à la réservation et apportez une carte valide.",
    _stWa: "Bonjour, j ai besoin d un taxi étudiant à Oxford. Date : []. Prise en charge : []. Destination : []. Réduction étudiante",
    _stH2: "Quand les étudiants réservent",
    _stP: "Les semaines de rentrée sont les plus chargées. Nous prenons en charge aux colleges de l Université d Oxford, à Oxford Brookes à Headington et dans les colocs. Réduction étudiante sur nos services avec carte valide le jour du trajet.",
    _stCallout: "Oxford vers Heathrow en voiture standard £92 aller ou £180 aller-retour jusqu à 4 passagers.",
    _stForm: "Demander un taxi étudiant",
    _stFaqs: [
      { q: "Y a-t-il une réduction étudiante ?", a: "Oui. Mentionnez-la à la réservation et apportez une carte étudiante valide le jour du trajet." },
      { q: "Quatre étudiants peuvent-ils aller à Heathrow ?", a: "Oui. Voiture standard d Oxford vers Heathrow £92 aller ou £180 aller-retour jusqu à 4 passagers." },
    ],
    _ctTitle: "Contact à Oxford | WhatsApp et téléphone | Spires Taxis FR",
    _ctOg: "Contact à Oxford",
    _ctDesc: "Réservez par WhatsApp, au 07776 897772 ou par e-mail bookings@spires-taxis.com. Trajets réservés à l avance à Oxford et dans l Oxfordshire.",
    _ctOgDesc: "WhatsApp, 07776 897772 ou bookings@spires-taxis.com pour un taxi à Oxford.",
    _ctH1: "Contact",
    _ctLead: "WhatsApp, appel ou formulaire. Téléphone <strong>07776 897772</strong>. E-mail <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
    _ctWa: "Bonjour, j ai besoin de réserver un taxi à Oxford.",
    _ctH2: "Ce qu il nous faut pour confirmer le tarif",
    _ctP: "Date et heure, adresse complète, destination, passagers et bagages, et le numéro de vol pour un accueil à l aéroport.",
    _ctCallout: "La réservation en ligne est en anglais. WhatsApp peut être en français avec traduction.",
    _ctForm: "Envoyer la demande",
    _ctFaqs: [
      { q: "Quel est le moyen le plus rapide ?", a: "WhatsApp au 07776 897772 est souvent le plus rapide si vous envoyez adresse, date et numéro de vol." },
      { q: "Peut-on réserver en français ?", a: "Oui, via WhatsApp en français avec traduction. Les chauffeurs parlent surtout anglais." },
    ],
  },
});

function latinRest(id, n) {
  localePack(id, {
    base: {
      note: n.note,
      form: n.form,
      navHome: n.navHome,
      navAirport: n.navAirport,
      navContact: n.navContact,
      ctaWa: n.ctaWa,
      ctaCall: n.ctaCall,
      ctaBook: n.ctaBook,
      prices: n.prices,
      lHeathrowIn: n.lHeathrowIn,
      lStudent: n.lStudent,
      lAirport: n.lAirport,
      lHeathrowOut: n.lHeathrowOut,
      lGatwick: n.lGatwick,
      lPickup: n.lPickup,
      lContact: n.lContact,
      crumbHeathrowOut: n.lHeathrowOut,
      crumbGatwick: n.lGatwick,
      crumbHeathrowIn: n.lHeathrowIn.split(" ·")[0],
      crumbPickup: n.lPickup,
      crumbStudent: n.lStudent,
      faqs: n.faqs,
      home: n.home,
      airport: n.airport,
    },
    routes: n.routes,
  });
}

latinRest("de", {
  note: "Unsere Fahrer sprechen hauptsächlich Englisch. Sie können uns auf Deutsch per WhatsApp schreiben, wir nutzen Übersetzung. Die Onlinebuchung auf customer.spires-taxis.com ist auf Englisch.",
  form: { name: "Vollständiger Name *", email: "E-Mail *", phone: "Telefon *", pickup: "Abholung *", drop: "Ziel *", date: "Datum *", message: "Hinweise", submit: "Anfrage senden" },
  navHome: "Start",
  navAirport: "Flughafentransfer",
  navContact: "Kontakt",
  ctaWa: "WhatsApp für einen Preis",
  ctaCall: "Jetzt anrufen",
  ctaBook: "Online buchen",
  prices: ["Heathrow £92 einfach oder £180 hin und zurück", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
  lHeathrowIn: "Heathrow nach Oxford · £92 / £180",
  lStudent: "Ankunft von Studierenden",
  lAirport: "Transfer und Preise",
  lHeathrowOut: "Oxford nach Heathrow",
  lGatwick: "Oxford nach Gatwick",
  lPickup: "So funktioniert die Abholung",
  lContact: "WhatsApp, Telefon und Buchung",
  faqs: {
    home: [
      { q: "Was kostet Heathrow nach Oxford?", a: "Standardwagen £92 einfach oder £180 hin und zurück bis 4 Personen. Der bei der Buchung bestätigte Preis ist der Preis, den Sie zahlen." },
      { q: "Sprechen die Fahrer Deutsch?", a: "Sie sprechen hauptsächlich Englisch. Sie können auf Deutsch per WhatsApp schreiben, wir nutzen Übersetzung." },
    ],
    airport: [
      { q: "Welche Preise gelten ab Oxford?", a: "Standardwagen bis 4 Personen: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 einfach und hin und zurück, wenn beide Fahrten zusammen gebucht werden." },
      { q: "Ist Warten nach der Landung enthalten?", a: "Ja. Sie haben 50 Minuten ab tatsächlicher Landung, uns zu sagen, dass Sie bereit sind. Danach £10 je weitere 30 Minuten oder Teil davon." },
    ],
  },
  home: {
    title: "Taxi Oxford | Festpreis vor der Fahrt | Spires Taxis",
    ogTitle: "Taxi Oxford | Festpreis",
    description: "Lizenzierter Mietwagen in Oxford. Feste Preise für Flughafen und lokale Fahrten. Bitte im Voraus buchen. WhatsApp oder 07776 897772.",
    ogDescription: "Lizenziertes Taxi in Oxford. Festpreis für Flughafen und lokale Fahrten.",
    h1: "Taxi in Oxford, Preis vor der Abfahrt bestätigt",
    lead: "Wir sind ein lizenzierter Mietwagenbetrieb in Oxford. Wir bestätigen den Preis vor der Fahrt, ohne Taxameter im Stau. Heathrow nach Oxford im Standardwagen <strong>£92 einfach</strong> oder <strong>£180 hin und zurück</strong> bis 4 Personen.",
    wa: "Hallo, ich brauche ein Taxi in Oxford. Details:",
    more: "Seiten auf Deutsch",
    moreLead: "Nur veröffentlichte Oxford Preise. Andere Orte werden gesondert angeboten.",
    cover: "Was wir fahren",
    coverP: "Fahrten in Oxford, Abholung am Flughafen, Colleges, Kliniken und Hotels. Der bestätigte Preis bei der Buchung ist der Preis, den Sie zahlen.",
    wait: "Nach der Landung haben Sie 50 Minuten, uns zu sagen, dass Sie bereit sind. Danach kostet das Warten £10 je weitere 30 Minuten oder Teil davon. Die übliche Flughafenabholgebühr ist enthalten.",
    listed: "Veröffentlichte Oxford Preise",
    formH: "Buchung anfragen",
  },
  airport: {
    title: "Flughafentransfer ab Oxford | Veröffentlichte Preise | Spires Taxis",
    ogTitle: "Flughafentransfer ab Oxford",
    description: "Oxford Standardwagen: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 Minuten nach der Landung.",
    ogDescription: "Veröffentlichte Preise Oxford nach Heathrow, Gatwick, Luton und Stansted.",
    h1: "Flughafentransfer von Oxford und nach Oxford",
    lead: "Feste Preise von Oxford Adressen zu den großen Flughäfen und Abholung bei Ankunft. Standardwagen bis 4 Personen. Andere Orte werden gesondert angeboten.",
    wa: "Hallo, ich brauche einen Flughafentransfer ab Oxford. Flughafen: []. Datum: []",
    tableH: "Standardwagen ab Oxford",
    tableLead: "Bis 4 Personen. Hin und zurück, wenn beide Oxford Fahrten zusammen gebucht werden.",
    thAirport: "Flughafen",
    thOne: "Einfach",
    thRet: "Hin und zurück",
    eight: 'Preise für 8 Sitze auf der <a href="/rates">englischen Preisseite</a>.',
    formH: "Transfer anfragen",
  },
  routes: {
    _hoTitle: "Taxi Oxford nach Heathrow | Festpreis | Spires Taxis",
    _hoOg: "Taxi Oxford nach Heathrow",
    _hoDesc: "Von Oxford zu Heathrow Terminal 2, 3, 4 und 5. Standardwagen £92 einfach oder £180 hin und zurück. Übliche Absetzgebühr am Flughafen enthalten.",
    _hoOgDesc: "Oxford nach Heathrow £92 einfach oder £180 hin und zurück.",
    _hoH1: "Taxi von Oxford nach Heathrow",
    _hoLead: "Im Voraus gebuchte Fahrt zu Terminal 2, 3, 4 und 5. Standardwagen <strong>£92 einfach</strong> oder <strong>£180 hin und zurück</strong> bis 4 Personen.",
    _hoWa: "Hallo, ich brauche ein Auto von Oxford nach Heathrow. Adresse: []. Flug: []",
    _hoH2: "Wann Sie in Oxford abfahren",
    _hoP: "Nennen Sie Terminal, Abflugzeit, Personen und Gepäck. Die Fahrt dauert meist 60 bis 90 Minuten bei normalem Verkehr.",
    _hoCallout: "<strong>Standardwagen £92 oder £180 hin und zurück</strong> für Oxford bis 4 Personen.",
    _hoForm: "Fahrt nach Heathrow anfragen",
    _hoFaqs: [
      { q: "Was kostet Oxford nach Heathrow?", a: "Standardwagen £92 einfach oder £180 hin und zurück bis 4 Personen, wenn beide Fahrten zusammen gebucht werden." },
      { q: "Ist die Absetzgebühr enthalten?", a: "Ja. Die übliche Absetzgebühr am Flughafen ist im veröffentlichten Preis enthalten." },
    ],
    _gwTitle: "Taxi Oxford nach Gatwick | Festpreis | Spires Taxis",
    _gwOg: "Taxi Oxford nach Gatwick",
    _gwDesc: "Von Oxford nach Gatwick im Standardwagen £140 einfach oder £270 hin und zurück bis 4 Personen.",
    _gwOgDesc: "Oxford nach Gatwick £140 einfach oder £270 hin und zurück.",
    _gwH1: "Taxi von Oxford nach Gatwick",
    _gwLead: "Im Voraus gebuchte Fahrt nach Gatwick. Standardwagen <strong>£140 einfach</strong> oder <strong>£270 hin und zurück</strong> bis 4 Personen.",
    _gwWa: "Hallo, ich brauche ein Auto von Oxford nach Gatwick. Adresse: []. Flug: []",
    _gwH2: "Häufig am Semesterende",
    _gwP: "Viele Studierende fahren mit Koffern nach Gatwick. Wenn Sie zu viert sind oder 8 Sitze brauchen, nennen Sie die Anzahl der Koffer.",
    _gwCallout: 'Weitere Oxford Preise unter <a href="/de/airport-transfers">Flughafentransfer</a>.',
    _gwForm: "Fahrt nach Gatwick anfragen",
    _gwFaqs: [
      { q: "Was kostet Oxford nach Gatwick?", a: "Standardwagen £140 einfach oder £270 hin und zurück bis 4 Personen." },
      { q: "North und South Terminal?", a: "Ja. Nennen Sie das Terminal bei der Buchung." },
    ],
    _hiTitle: "Taxi Heathrow nach Oxford | Festpreis | Spires Taxis",
    _hiOg: "Taxi Heathrow nach Oxford",
    _hiDesc: "Abholung an jedem Heathrow Terminal nach Oxford. Standardwagen £92 einfach oder £180 hin und zurück. 50 Minuten nach der Landung.",
    _hiOgDesc: "Heathrow nach Oxford £92 einfach oder £180 hin und zurück.",
    _hiH1: "Taxi von Heathrow nach Oxford",
    _hiLead: "Im Voraus gebuchte Abholung von jedem Heathrow Terminal nach Oxford, inklusive Headington. Standardwagen <strong>£92 einfach</strong> oder <strong>£180 hin und zurück</strong>.",
    _hiWa: "Hallo, ich brauche ein Auto von Heathrow nach Oxford. Terminal: []. Flug: []. Ziel: []",
    _hiH2: "Abholung bei Ankunft",
    _hiP: "Senden Sie Flugnummer und Terminal. Wir folgen der tatsächlichen Landezeit. Sie haben 50 Minuten, uns zu sagen, dass Sie bereit sind.",
    _hiCallout: "<strong>Standardwagen £92 oder £180 hin und zurück</strong> für Oxford bis 4 Personen.",
    _hiForm: "Abholung anfragen",
    _hiFaqs: [
      { q: "Was kostet Heathrow nach Oxford?", a: "Standardwagen £92 einfach oder £180 hin und zurück bis 4 Personen." },
      { q: "Wartet der Fahrer in Arrivals?", a: "Ja. Nennen Sie Terminal und Flugnummer. Er kann in Arrivals mit Namensschild warten." },
    ],
    _pkTitle: "So funktioniert die Flughafenabholung | Spires Taxis",
    _pkOg: "So funktioniert die Flughafenabholung",
    _pkDesc: "Wir folgen dem Flug nach tatsächlicher Landezeit. 50 Minuten zum Bescheid, danach £10 je 30 Minuten. Übliche Abholgebühr enthalten.",
    _pkOgDesc: "50 Minuten nach der Landung, dann £10 je 30 Minuten.",
    _pkH1: "So funktioniert die Abholung am Flughafen",
    _pkLead: "Wir richten uns nach der tatsächlichen Landezeit. Sie haben <strong>50 Minuten</strong>, uns zu sagen, dass Sie bereit sind. Danach kostet Warten <strong>£10 je 30 Minuten</strong> oder Teil davon.",
    _pkWa: "Hallo, ich brauche eine Abholung am Flughafen. Flug: []. Terminal: []. Ziel: []",
    _pkH2: "Am Reisetag",
    _pkP: "Vor dem Abflug bestätigen wir Terminal und Handy. Nach der Landung folgen wir dem Flug. Nach dem Gepäck sagen Sie uns innerhalb von 50 Minuten Bescheid.",
    _pkCallout: "Die übliche Flughafenabholgebühr ist enthalten.",
    _pkForm: "Abholung anfragen",
    _pkFaqs: [
      { q: "Wie viele Minuten Wartezeit?", a: "50 Minuten ab tatsächlicher Landung. Danach £10 je weitere 30 Minuten oder Teil davon." },
      { q: "Was sollen wir schicken?", a: "Flugnummer, Terminal falls bekannt, Personen, Gepäck, ein Handy das im Vereinigten Königreich funktioniert, und die vollständige Adresse." },
    ],
    _stTitle: "Ankunft von Studierenden in Oxford | Flughafentaxi | Spires Taxis",
    _stOg: "Ankunft von Studierenden in Oxford",
    _stDesc: "Vom Flughafen zum College oder Wohnheim, mit Koffern. Studierendennachlass mit gültigem Ausweis. Fahrer sprechen hauptsächlich Englisch.",
    _stOgDesc: "Abholung zum College oder Wohnheim. Studierendennachlass mit gültigem Ausweis.",
    _stH1: "Ankunft von Studierenden in Oxford",
    _stLead: "Vom Flughafen zum College oder Wohnheim, mit Koffern. Es gibt einen <strong>Studierendennachlass</strong>. Bitte bei der Buchung nennen und einen gültigen Ausweis mitbringen.",
    _stWa: "Hallo, ich brauche ein Studententaxi in Oxford. Datum: []. Abholung: []. Ziel: []. Studierendennachlass",
    _stH2: "Wann Studierende buchen",
    _stP: "Die Wochen zum Semesterbeginn sind am vollsten. Wir holen an Colleges der University of Oxford, Oxford Brookes in Headington und in WGs ab. Studierendennachlass auf unsere Fahrten mit gültigem Ausweis am Reisetag.",
    _stCallout: "Oxford nach Heathrow im Standardwagen £92 einfach oder £180 hin und zurück bis 4 Personen.",
    _stForm: "Studententaxi anfragen",
    _stFaqs: [
      { q: "Gibt es einen Studierendennachlass?", a: "Ja. Bitte bei der Buchung nennen und am Reisetag einen gültigen Studierendenausweis mitbringen." },
      { q: "Können vier Studierende nach Heathrow?", a: "Ja. Standardwagen von Oxford nach Heathrow £92 einfach oder £180 hin und zurück bis 4 Personen." },
    ],
    _ctTitle: "Kontakt in Oxford | WhatsApp und Telefon | Spires Taxis DE",
    _ctOg: "Kontakt in Oxford",
    _ctDesc: "Buchen Sie per WhatsApp, unter 07776 897772 oder per E-Mail bookings@spires-taxis.com. Vorausbuchung in Oxford und Oxfordshire.",
    _ctOgDesc: "WhatsApp, 07776 897772 oder bookings@spires-taxis.com für ein Taxi in Oxford.",
    _ctH1: "Kontakt",
    _ctLead: "WhatsApp, Anruf oder Formular. Telefon <strong>07776 897772</strong>. E-Mail <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
    _ctWa: "Hallo, ich möchte ein Taxi in Oxford buchen.",
    _ctH2: "Was wir für den Preis brauchen",
    _ctP: "Datum und Uhrzeit, vollständige Adresse, Ziel, Personen und Gepäck, und die Flugnummer bei Abholung am Flughafen.",
    _ctCallout: "Die Onlinebuchung ist auf Englisch. WhatsApp kann auf Deutsch mit Übersetzung sein.",
    _ctForm: "Anfrage senden",
    _ctFaqs: [
      { q: "Was ist am schnellsten?", a: "WhatsApp 07776 897772 ist oft am schnellsten, wenn Sie Adresse, Datum und Flugnummer senden." },
      { q: "Kann man auf Deutsch buchen?", a: "Ja, per WhatsApp auf Deutsch mit Übersetzung. Die Fahrer sprechen hauptsächlich Englisch." },
    ],
  },
});

function fillRoutes(pfx, s) {
  return {
    _hoTitle: s.hoT, _hoOg: s.hoOg, _hoDesc: s.hoD, _hoOgDesc: s.hoOD, _hoH1: s.hoH1, _hoLead: s.hoL, _hoWa: s.hoWa, _hoH2: s.hoH2, _hoP: s.hoP, _hoCallout: s.hoC, _hoForm: s.hoF,
    _hoFaqs: s.hoFaqs,
    _gwTitle: s.gwT, _gwOg: s.gwOg, _gwDesc: s.gwD, _gwOgDesc: s.gwOD, _gwH1: s.gwH1, _gwLead: s.gwL, _gwWa: s.gwWa, _gwH2: s.gwH2, _gwP: s.gwP, _gwCallout: s.gwC, _gwForm: s.gwF,
    _gwFaqs: s.gwFaqs,
    _hiTitle: s.hiT, _hiOg: s.hiOg, _hiDesc: s.hiD, _hiOgDesc: s.hiOD, _hiH1: s.hiH1, _hiLead: s.hiL, _hiWa: s.hiWa, _hiH2: s.hiH2, _hiP: s.hiP, _hiCallout: s.hiC, _hiForm: s.hiF,
    _hiFaqs: s.hiFaqs,
    _pkTitle: s.pkT, _pkOg: s.pkOg, _pkDesc: s.pkD, _pkOgDesc: s.pkOD, _pkH1: s.pkH1, _pkLead: s.pkL, _pkWa: s.pkWa, _pkH2: s.pkH2, _pkP: s.pkP, _pkCallout: s.pkC, _pkForm: s.pkF,
    _pkFaqs: s.pkFaqs,
    _stTitle: s.stT, _stOg: s.stOg, _stDesc: s.stD, _stOgDesc: s.stOD, _stH1: s.stH1, _stLead: s.stL, _stWa: s.stWa, _stH2: s.stH2, _stP: s.stP, _stCallout: s.stC, _stForm: s.stF,
    _stFaqs: s.stFaqs,
    _ctTitle: s.ctT, _ctOg: s.ctOg, _ctDesc: s.ctD, _ctOgDesc: s.ctOD, _ctH1: s.ctH1, _ctLead: s.ctL, _ctWa: s.ctWa, _ctH2: s.ctH2, _ctP: s.ctP, _ctCallout: s.ctC, _ctForm: s.ctF,
    _ctFaqs: s.ctFaqs,
  };
}

latinRest("it", {
  note: "I nostri autisti parlano soprattutto inglese. Potete scriverci in italiano su WhatsApp e useremo la traduzione. La prenotazione su customer.spires-taxis.com è in inglese.",
  form: { name: "Nome e cognome *", email: "E-mail *", phone: "Telefono *", pickup: "Ritiro *", drop: "Destinazione *", date: "Data *", message: "Note", submit: "Invia richiesta" },
  navHome: "Home", navAirport: "Transfer aeroportuali", navContact: "Contatti",
  ctaWa: "WhatsApp per un prezzo", ctaCall: "Chiama ora", ctaBook: "Prenota sul sito",
  prices: ["Heathrow £92 andata o £180 andata e ritorno", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
  lHeathrowIn: "Heathrow a Oxford · £92 / £180", lStudent: "Arrivo studenti", lAirport: "Transfer e prezzi", lHeathrowOut: "Oxford a Heathrow", lGatwick: "Oxford a Gatwick", lPickup: "Come funziona il ritiro", lContact: "WhatsApp, telefono e prenotazione",
  faqs: {
    home: [
      { q: "Quanto costa Heathrow a Oxford?", a: "Auto standard £92 andata o £180 andata e ritorno fino a 4 passeggeri. Il prezzo confermato in prenotazione è quello che pagate." },
      { q: "Gli autisti parlano italiano?", a: "Parlano soprattutto inglese. Potete scrivere in italiano su WhatsApp e useremo la traduzione." },
    ],
    airport: [
      { q: "Quali sono i prezzi da Oxford?", a: "Auto standard fino a 4 passeggeri: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 andata e andata e ritorno se prenotate entrambi i viaggi insieme." },
      { q: "L attesa dopo l atterraggio è inclusa?", a: "Sì. Avete 50 minuti dall atterraggio reale per dirci che siete pronti. Poi £10 ogni 30 minuti extra o frazione." },
    ],
  },
  home: {
    title: "Taxi a Oxford | Prezzo fisso prima del viaggio | Spires Taxis",
    ogTitle: "Taxi a Oxford | Prezzo fisso",
    description: "Noleggio con conducente con licenza a Oxford. Prezzi fissi per aeroporti e tratte locali. Prenotate in anticipo. WhatsApp o 07776 897772.",
    ogDescription: "Taxi con licenza a Oxford. Prezzo fisso per aeroporto e tratte locali.",
    h1: "Taxi a Oxford, prezzo confermato prima di partire",
    lead: "Siamo un noleggio con conducente con licenza a Oxford. Confermiamo la tariffa prima del viaggio, senza tassametro nel traffico. Heathrow a Oxford in auto standard <strong>£92 andata</strong> o <strong>£180 andata e ritorno</strong> fino a 4 passeggeri.",
    wa: "Ciao, mi serve un taxi a Oxford. Dettagli:",
    more: "Pagine in italiano", moreLead: "Solo tariffe pubblicate di Oxford. Altre località si quotano a parte.",
    cover: "Cosa copriamo", coverP: "Tratte a Oxford, ritiro in aeroporto, college, ospedali e hotel. La tariffa confermata in prenotazione è quella che pagate.",
    wait: "Dopo l atterraggio avete 50 minuti per dirci che siete pronti. Poi l attesa è £10 ogni 30 minuti extra o frazione. Il costo standard di ritiro in aeroporto è incluso.",
    listed: "Tariffe pubblicate di Oxford", formH: "Chiedere una prenotazione",
  },
  airport: {
    title: "Transfer aeroportuali da Oxford | Prezzi pubblicati | Spires Taxis",
    ogTitle: "Transfer aeroportuali da Oxford",
    description: "Tariffe Oxford in auto standard: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 minuti dopo l atterraggio.",
    ogDescription: "Prezzi pubblicati Oxford per Heathrow, Gatwick, Luton e Stansted.",
    h1: "Transfer aeroportuali da Oxford e verso Oxford",
    lead: "Prezzi fissi da indirizzi di Oxford verso i principali aeroporti e ritiro all arrivo. Auto standard fino a 4 passeggeri. Altre località si quotano a parte.",
    wa: "Ciao, mi serve un transfer aeroportuale da Oxford. Aeroporto: []. Data: []",
    tableH: "Auto standard da Oxford", tableLead: "Fino a 4 passeggeri. Andata e ritorno se prenotate entrambi i viaggi di Oxford insieme.",
    thAirport: "Aeroporto", thOne: "Andata", thRet: "Andata e ritorno",
    eight: 'Prezzi del veicolo a 8 posti sulla <a href="/rates">pagina tariffe in inglese</a>.',
    formH: "Chiedere un transfer",
  },
  routes: fillRoutes("/it", {
    hoT: "Taxi da Oxford a Heathrow | Prezzo fisso | Spires Taxis", hoOg: "Taxi da Oxford a Heathrow",
    hoD: "Da Oxford ai terminal 2, 3, 4 e 5 di Heathrow. Auto standard £92 andata o £180 andata e ritorno. Il costo standard di arrivo in aeroporto è incluso.",
    hoOD: "Oxford a Heathrow £92 andata o £180 andata e ritorno.", hoH1: "Taxi da Oxford a Heathrow",
    hoL: "Viaggio prenotato in anticipo verso i terminal 2, 3, 4 e 5. Auto standard <strong>£92 andata</strong> o <strong>£180 andata e ritorno</strong> fino a 4 passeggeri.",
    hoWa: "Ciao, mi serve un auto da Oxford a Heathrow. Indirizzo: []. Volo: []",
    hoH2: "Quando partire da Oxford", hoP: "Indicate terminal, orario di partenza, passeggeri e bagagli. Il viaggio è di solito 60-90 minuti con traffico normale.",
    hoC: "<strong>Auto standard £92 o £180 andata e ritorno</strong> per Oxford fino a 4 passeggeri.", hoF: "Chiedere un transfer per Heathrow",
    hoFaqs: [{ q: "Quanto costa Oxford a Heathrow?", a: "Auto standard £92 andata o £180 andata e ritorno fino a 4 passeggeri se prenotate entrambi i viaggi insieme." }, { q: "Il costo di arrivo è incluso?", a: "Sì. Il costo standard di arrivo in aeroporto è incluso nel prezzo pubblicato." }],
    gwT: "Taxi da Oxford a Gatwick | Prezzo fisso | Spires Taxis", gwOg: "Taxi da Oxford a Gatwick",
    gwD: "Da Oxford a Gatwick in auto standard £140 andata o £270 andata e ritorno fino a 4 passeggeri.",
    gwOD: "Oxford a Gatwick £140 andata o £270 andata e ritorno.", gwH1: "Taxi da Oxford a Gatwick",
    gwL: "Viaggio prenotato in anticipo per Gatwick. Auto standard <strong>£140 andata</strong> o <strong>£270 andata e ritorno</strong> fino a 4 passeggeri.",
    gwWa: "Ciao, mi serve un auto da Oxford a Gatwick. Indirizzo: []. Volo: []",
    gwH2: "Spesso a fine trimestre", gwP: "Molti studenti vanno a Gatwick con le valigie. Se siete in quattro o serve un veicolo a 8 posti, diteci quante valigie avete.",
    gwC: 'Altri prezzi Oxford su <a href="/it/airport-transfers">transfer aeroportuali</a>.', gwF: "Chiedere un transfer per Gatwick",
    gwFaqs: [{ q: "Quanto costa Oxford a Gatwick?", a: "Auto standard £140 andata o £270 andata e ritorno fino a 4 passeggeri." }, { q: "North e South Terminal?", a: "Sì. Indicate il terminal in prenotazione." }],
    hiT: "Taxi da Heathrow a Oxford | Prezzo fisso | Spires Taxis", hiOg: "Taxi da Heathrow a Oxford",
    hiD: "Ritiro in qualsiasi terminal di Heathrow verso Oxford. Auto standard £92 andata o £180 andata e ritorno. 50 minuti dopo l atterraggio.",
    hiOD: "Heathrow a Oxford £92 andata o £180 andata e ritorno.", hiH1: "Taxi da Heathrow a Oxford",
    hiL: "Ritiro prenotato in anticipo da qualsiasi terminal di Heathrow verso Oxford, Headington inclusa. Auto standard <strong>£92 andata</strong> o <strong>£180 andata e ritorno</strong>.",
    hiWa: "Ciao, mi serve un auto da Heathrow a Oxford. Terminal: []. Volo: []. Destinazione: []",
    hiH2: "Ritiro all arrivo", hiP: "Inviate numero di volo e terminal. Seguiamo l orario reale di atterraggio. Avete 50 minuti per dirci che siete pronti.",
    hiC: "<strong>Auto standard £92 o £180 andata e ritorno</strong> per Oxford fino a 4 passeggeri.", hiF: "Chiedere un ritiro",
    hiFaqs: [{ q: "Quanto costa Heathrow a Oxford?", a: "Auto standard £92 andata o £180 andata e ritorno fino a 4 passeggeri." }, { q: "L autista aspetta in arrivi?", a: "Sì. Indicate terminal e numero di volo. Può aspettare in arrivi con un cartello con il nome." }],
    pkT: "Come funziona il ritiro in aeroporto | Spires Taxis", pkOg: "Come funziona il ritiro in aeroporto",
    pkD: "Seguiamo il volo sull orario reale di atterraggio. 50 minuti per avvisarci, poi £10 ogni 30 minuti. Il costo standard di ritiro è incluso.",
    pkOD: "50 minuti dopo l atterraggio, poi £10 ogni 30 minuti.", pkH1: "Come funziona il ritiro in aeroporto",
    pkL: "Usiamo l orario reale di atterraggio. Avete <strong>50 minuti</strong> per avvisarci. Poi l attesa è <strong>£10 ogni 30 minuti</strong> extra o frazione.",
    pkWa: "Ciao, mi serve un ritiro in aeroporto. Volo: []. Terminal: []. Destinazione: []",
    pkH2: "Il giorno del viaggio", pkP: "Prima della partenza confermiamo terminal e cellulare. All atterraggio seguiamo il volo. Dopo i bagagli avvisateci entro 50 minuti.",
    pkC: "Il costo standard di ritiro in aeroporto è incluso.", pkF: "Chiedere un ritiro",
    pkFaqs: [{ q: "Quanti minuti di attesa?", a: "50 minuti dall atterraggio reale. Poi £10 ogni 30 minuti extra o frazione." }, { q: "Cosa dobbiamo inviare?", a: "Numero di volo, terminal se lo conoscete, passeggeri, bagagli, un cellulare che funzioni nel Regno Unito e l indirizzo completo." }],
    stT: "Arrivo studenti a Oxford | Taxi aeroporto | Spires Taxis", stOg: "Arrivo studenti a Oxford",
    stD: "Dall aeroporto al college o alla residenza, con valigie. Sconto studente con tesserino valido. Gli autisti parlano soprattutto inglese.",
    stOD: "Ritiro al college o alla residenza. Sconto studente con tesserino valido.", stH1: "Arrivo studenti a Oxford",
    stL: "Dall aeroporto al college o alla residenza, con le valigie. C è uno <strong>sconto studente</strong>. Segnalatelo in prenotazione e portate un tesserino valido.",
    stWa: "Ciao, mi serve un taxi studente a Oxford. Data: []. Ritiro: []. Destinazione: []. Sconto studente",
    stH2: "Quando prenotano gli studenti", stP: "Le settimane di inizio trimestre sono le più piene. Ritiriamo ai college dell Università di Oxford, a Oxford Brookes a Headington e nelle case condivise. Sconto studente sui nostri servizi con tesserino valido il giorno del viaggio.",
    stC: "Oxford a Heathrow in auto standard £92 andata o £180 andata e ritorno fino a 4 passeggeri.", stF: "Chiedere un taxi studente",
    stFaqs: [{ q: "C è lo sconto studente?", a: "Sì. Segnalatelo in prenotazione e portate un tesserino studente valido il giorno del viaggio." }, { q: "Quattro studenti possono andare a Heathrow?", a: "Sì. Auto standard da Oxford a Heathrow £92 andata o £180 andata e ritorno fino a 4 passeggeri." }],
    ctT: "Contatti a Oxford | WhatsApp e telefono | Spires Taxis IT", ctOg: "Contatti a Oxford",
    ctD: "Prenotate su WhatsApp, al 07776 897772 o via e-mail bookings@spires-taxis.com. Viaggi prenotati in anticipo a Oxford e nell Oxfordshire.",
    ctOD: "WhatsApp, 07776 897772 o bookings@spires-taxis.com per un taxi a Oxford.", ctH1: "Contatti",
    ctL: "WhatsApp, chiamata o modulo. Telefono <strong>07776 897772</strong>. E-mail <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
    ctWa: "Ciao, voglio prenotare un taxi a Oxford.",
    ctH2: "Cosa ci serve per confermare il prezzo", ctP: "Data e ora, indirizzo completo, destinazione, passeggeri e bagagli, e il numero di volo per un ritiro in aeroporto.",
    ctC: "La prenotazione sul sito è in inglese. WhatsApp può essere in italiano con traduzione.", ctF: "Invia richiesta",
    ctFaqs: [{ q: "Qual è il modo più veloce?", a: "WhatsApp 07776 897772 è spesso il più veloce se inviate indirizzo, data e numero di volo." }, { q: "Si può prenotare in italiano?", a: "Sì, su WhatsApp in italiano con traduzione. Gli autisti parlano soprattutto inglese." }],
  }),
});

function shortLang(id, b, r) {
  latinRest(id, { ...b, routes: fillRoutes(b._pfx, r) });
}

shortLang("pl", {
  _pfx: "/pl",
  note: "Nasi kierowcy mówią głównie po angielsku. Możecie napisać po polsku na WhatsApp, skorzystamy z tłumaczenia. Rezerwacja na customer.spires-taxis.com jest po angielsku.",
  form: { name: "Imię i nazwisko *", email: "E-mail *", phone: "Telefon *", pickup: "Odbiór *", drop: "Cel *", date: "Data *", message: "Uwagi", submit: "Wyślij zgłoszenie" },
  navHome: "Start", navAirport: "Transfery na lotnisko", navContact: "Kontakt",
  ctaWa: "WhatsApp o cenę", ctaCall: "Zadzwoń", ctaBook: "Rezerwacja online",
  prices: ["Heathrow £92 w jedną stronę lub £180 w obie strony", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
  lHeathrowIn: "Heathrow do Oksfordu · £92 / £180", lStudent: "Przyjazd studentów", lAirport: "Transfery i cennik", lHeathrowOut: "Oksford do Heathrow", lGatwick: "Oksford do Gatwick", lPickup: "Jak działa odbiór", lContact: "WhatsApp, telefon i rezerwacja",
  faqs: {
    home: [
      { q: "Ile kosztuje Heathrow do Oksfordu?", a: "Samochód standardowy £92 w jedną stronę lub £180 w obie strony do 4 osób. Cena potwierdzona przy rezerwacji to cena, którą płacicie." },
      { q: "Czy kierowcy mówią po polsku?", a: "Mówią głównie po angielsku. Możecie pisać po polsku na WhatsApp, skorzystamy z tłumaczenia." },
    ],
    airport: [
      { q: "Jakie są ceny z Oksfordu?", a: "Samochód standardowy do 4 osób: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 w jedną stronę i w obie strony przy rezerwacji obu przejazdów razem." },
      { q: "Czy oczekiwanie po lądowaniu jest w cenie?", a: "Tak. Macie 50 minut od rzeczywistego lądowania, żeby dać znać, że jesteście gotowi. Potem £10 za każde 30 minut lub część." },
    ],
  },
  home: {
    title: "Taksówka Oxford | Stała cena przed wyjazdem | Spires Taxis",
    ogTitle: "Taksówka Oxford | Stała cena",
    description: "Licencjonowany private hire w Oksfordzie. Stałe ceny na lotniska i przejazdy lokalne. Rezerwujcie wcześniej. WhatsApp lub 07776 897772.",
    ogDescription: "Licencjonowana taksówka w Oksfordzie. Stała cena na lotnisko i przejazdy lokalne.",
    h1: "Taksówka w Oksfordzie, cena ustalona przed wyjazdem",
    lead: "Jesteśmy licencjonowaną firmą private hire w Oksfordzie. Potwierdzamy cenę przed kursem, bez taksometru w korku. Heathrow do Oksfordu samochodem standardowym <strong>£92 w jedną stronę</strong> lub <strong>£180 w obie strony</strong> do 4 osób.",
    wa: "Dzień dobry, potrzebuję taksówki w Oksfordzie. Szczegóły:",
    more: "Strony po polsku", moreLead: "Tylko opublikowane ceny z Oksfordu. Inne miejscowości wyceniamy osobno.",
    cover: "Co obejmujemy", coverP: "Kursy w Oksfordzie, odbiór z lotniska, college, szpitale i hotele. Cena potwierdzona przy rezerwacji to cena, którą płacicie.",
    wait: "Po lądowaniu macie 50 minut, żeby dać znać, że jesteście gotowi. Potem oczekiwanie to £10 za każde 30 minut lub część. Standardowa opłata za odbiór na lotnisku jest wliczona.",
    listed: "Opublikowane ceny z Oksfordu", formH: "Zgłoś rezerwację",
  },
  airport: {
    title: "Transfery lotniskowe z Oksfordu | Cennik | Spires Taxis",
    ogTitle: "Transfery lotniskowe z Oksfordu",
    description: "Ceny Oksford samochód standardowy: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 minut po lądowaniu.",
    ogDescription: "Opublikowane ceny Oksford do Heathrow, Gatwick, Luton i Stansted.",
    h1: "Transfery lotniskowe z Oksfordu i do Oksfordu",
    lead: "Stałe ceny z adresów w Oksfordzie na główne lotniska oraz odbiór po przylocie. Samochód standardowy do 4 osób. Inne miejscowości wyceniamy osobno.",
    wa: "Dzień dobry, potrzebuję transferu na lotnisko z Oksfordu. Lotnisko: []. Data: []",
    tableH: "Samochód standardowy z Oksfordu", tableLead: "Do 4 osób. W obie strony przy rezerwacji obu kursów z Oksfordu razem.",
    thAirport: "Lotnisko", thOne: "Jedna strona", thRet: "Obie strony",
    eight: 'Ceny 8 miejsc na <a href="/rates">angielskiej stronie cennika</a>.',
    formH: "Zgłoś transfer",
  },
}, {
  hoT: "Taksówka Oksford do Heathrow | Stała cena | Spires Taxis", hoOg: "Taksówka Oksford do Heathrow",
  hoD: "Z Oksfordu na terminale 2, 3, 4 i 5 Heathrow. Samochód standardowy £92 w jedną stronę lub £180 w obie strony. Standardowa opłata za podjazd na lotnisku wliczona.",
  hoOD: "Oksford do Heathrow £92 w jedną stronę lub £180 w obie strony.", hoH1: "Taksówka z Oksfordu do Heathrow",
  hoL: "Kurs zarezerwowany wcześniej na terminale 2, 3, 4 i 5. Samochód standardowy <strong>£92 w jedną stronę</strong> lub <strong>£180 w obie strony</strong> do 4 osób.",
  hoWa: "Dzień dobry, potrzebuję auta z Oksfordu do Heathrow. Adres: []. Lot: []",
  hoH2: "Kiedy wyjechać z Oksfordu", hoP: "Podajcie terminal, godzinę wylotu, liczbę osób i bagaż. Kurs zwykle trwa 60 do 90 minut przy normalnym ruchu.",
  hoC: "<strong>Samochód standardowy £92 lub £180 w obie strony</strong> dla Oksfordu do 4 osób.", hoF: "Zgłoś kurs do Heathrow",
  hoFaqs: [{ q: "Ile kosztuje Oksford do Heathrow?", a: "Samochód standardowy £92 w jedną stronę lub £180 w obie strony do 4 osób przy rezerwacji obu kursów razem." }, { q: "Czy opłata za podjazd jest w cenie?", a: "Tak. Standardowa opłata za podjazd na lotnisku jest w opublikowanej cenie." }],
  gwT: "Taksówka Oksford do Gatwick | Stała cena | Spires Taxis", gwOg: "Taksówka Oksford do Gatwick",
  gwD: "Z Oksfordu do Gatwick samochodem standardowym £140 w jedną stronę lub £270 w obie strony do 4 osób.",
  gwOD: "Oksford do Gatwick £140 w jedną stronę lub £270 w obie strony.", gwH1: "Taksówka z Oksfordu do Gatwick",
  gwL: "Kurs zarezerwowany wcześniej do Gatwick. Samochód standardowy <strong>£140 w jedną stronę</strong> lub <strong>£270 w obie strony</strong> do 4 osób.",
  gwWa: "Dzień dobry, potrzebuję auta z Oksfordu do Gatwick. Adres: []. Lot: []",
  gwH2: "Często na koniec semestru", gwP: "Wielu studentów jedzie do Gatwick z walizkami. Jeśli jedziecie we czworo albo potrzebujecie 8 miejsc, podajcie liczbę walizek.",
  gwC: 'Pozostałe ceny Oksfordu na <a href="/pl/airport-transfers">transferach lotniskowych</a>.', gwF: "Zgłoś kurs do Gatwick",
  gwFaqs: [{ q: "Ile kosztuje Oksford do Gatwick?", a: "Samochód standardowy £140 w jedną stronę lub £270 w obie strony do 4 osób." }, { q: "North i South Terminal?", a: "Tak. Podajcie terminal przy rezerwacji." }],
  hiT: "Taksówka Heathrow do Oksfordu | Stała cena | Spires Taxis", hiOg: "Taksówka Heathrow do Oksfordu",
  hiD: "Odbiór na dowolnym terminalu Heathrow do Oksfordu. Samochód standardowy £92 w jedną stronę lub £180 w obie strony. 50 minut po lądowaniu.",
  hiOD: "Heathrow do Oksfordu £92 w jedną stronę lub £180 w obie strony.", hiH1: "Taksówka z Heathrow do Oksfordu",
  hiL: "Odbiór zarezerwowany wcześniej z dowolnego terminalu Heathrow do Oksfordu, w tym Headington. Samochód standardowy <strong>£92 w jedną stronę</strong> lub <strong>£180 w obie strony</strong>.",
  hiWa: "Dzień dobry, potrzebuję auta z Heathrow do Oksfordu. Terminal: []. Lot: []. Cel: []",
  hiH2: "Odbiór po przylocie", hiP: "Wyślijcie numer lotu i terminal. Śledzimy rzeczywisty czas lądowania. Macie 50 minut, żeby dać znać, że jesteście gotowi.",
  hiC: "<strong>Samochód standardowy £92 lub £180 w obie strony</strong> dla Oksfordu do 4 osób.", hiF: "Zgłoś odbiór",
  hiFaqs: [{ q: "Ile kosztuje Heathrow do Oksfordu?", a: "Samochód standardowy £92 w jedną stronę lub £180 w obie strony do 4 osób." }, { q: "Czy kierowca czeka na przylotach?", a: "Tak. Podajcie terminal i numer lotu. Może czekać na przylotach z tabliczką z nazwiskiem." }],
  pkT: "Jak działa odbiór na lotnisku | Spires Taxis", pkOg: "Jak działa odbiór na lotnisku",
  pkD: "Śledzimy lot według rzeczywistego lądowania. 50 minut na zgłoszenie, potem £10 za 30 minut. Standardowa opłata za odbiór wliczona.",
  pkOD: "50 minut po lądowaniu, potem £10 za 30 minut.", pkH1: "Jak działa odbiór na lotnisku",
  pkL: "Opieramy się na rzeczywistym czasie lądowania. Macie <strong>50 minut</strong>, żeby dać znać. Potem oczekiwanie to <strong>£10 za każde 30 minut</strong> lub część.",
  pkWa: "Dzień dobry, potrzebuję odbioru na lotnisku. Lot: []. Terminal: []. Cel: []",
  pkH2: "W dniu podróży", pkP: "Przed wylotem potwierdzamy terminal i telefon. Po lądowaniu śledzimy lot. Po bagażu dajcie znać w ciągu 50 minut.",
  pkC: "Standardowa opłata za odbiór na lotnisku jest wliczona.", pkF: "Zgłoś odbiór",
  pkFaqs: [{ q: "Ile minut oczekiwania?", a: "50 minut od rzeczywistego lądowania. Potem £10 za każde 30 minut lub część." }, { q: "Co wysłać?", a: "Numer lotu, terminal jeśli znacie, osoby, bagaż, telefon działający w Wielkiej Brytanii i pełny adres." }],
  stT: "Przyjazd studentów do Oksfordu | Taksówka lotniskowa | Spires Taxis", stOg: "Przyjazd studentów do Oksfordu",
  stD: "Z lotniska do college lub akademika, z walizkami. Zniżka studencka przy ważnej legitymacji. Kierowcy mówią głównie po angielsku.",
  stOD: "Odbiór do college lub akademika. Zniżka studencka przy ważnej legitymacji.", stH1: "Przyjazd studentów do Oksfordu",
  stL: "Z lotniska do college lub akademika, z walizkami. Jest <strong>zniżka studencka</strong>. Podajcie ją przy rezerwacji i zabierzcie ważną legitymację.",
  stWa: "Dzień dobry, potrzebuję taksówki studenckiej w Oksfordzie. Data: []. Odbiór: []. Cel: []. Zniżka studencka",
  stH2: "Kiedy studenci rezerwują", stP: "Tygodnie początku semestru są najpełniejsze. Odbieramy z college University of Oxford, Oxford Brookes w Headington i z mieszkań. Zniżka studencka na nasze kursy przy ważnej legitymacji w dniu przejazdu.",
  stC: "Oksford do Heathrow samochodem standardowym £92 w jedną stronę lub £180 w obie strony do 4 osób.", stF: "Zgłoś taksówkę studencką",
  stFaqs: [{ q: "Czy jest zniżka studencka?", a: "Tak. Podajcie ją przy rezerwacji i zabierzcie ważną legitymację studencką w dniu przejazdu." }, { q: "Czy czworo studentów może jechać do Heathrow?", a: "Tak. Samochód standardowy z Oksfordu do Heathrow £92 w jedną stronę lub £180 w obie strony do 4 osób." }],
  ctT: "Kontakt w Oksfordzie | WhatsApp i telefon | Spires Taxis PL", ctOg: "Kontakt w Oksfordzie",
  ctD: "Rezerwujcie przez WhatsApp, pod 07776 897772 lub e-mailem bookings@spires-taxis.com. Kursy z wcześniejszą rezerwacją w Oksfordzie i Oxfordshire.",
  ctOD: "WhatsApp, 07776 897772 lub bookings@spires-taxis.com po taksówkę w Oksfordzie.", ctH1: "Kontakt",
  ctL: "WhatsApp, telefon lub formularz. Telefon <strong>07776 897772</strong>. E-mail <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
  ctWa: "Dzień dobry, chcę zarezerwować taksówkę w Oksfordzie.",
  ctH2: "Czego potrzebujemy do potwierdzenia ceny", ctP: "Data i godzina, pełny adres, cel, osoby i bagaż oraz numer lotu przy odbiorze z lotniska.",
  ctC: "Rezerwacja na stronie jest po angielsku. WhatsApp może być po polsku z tłumaczeniem.", ctF: "Wyślij zgłoszenie",
  ctFaqs: [{ q: "Co jest najszybsze?", a: "WhatsApp 07776 897772 zwykle jest najszybszy, jeśli wyślecie adres, datę i numer lotu." }, { q: "Czy można rezerwować po polsku?", a: "Tak, na WhatsApp po polsku z tłumaczeniem. Kierowcy mówią głównie po angielsku." }],
});

function fareFaqs(oneQ, oneA, twoQ, twoA) {
  return [{ q: oneQ, a: oneA }, { q: twoQ, a: twoA }];
}

shortLang("pt", {
  _pfx: "/pt",
  note: "Os motoristas falam sobretudo inglês. Podem escrever em português no WhatsApp e usaremos tradução. A reserva em customer.spires-taxis.com é em inglês.",
  form: { name: "Nome completo *", email: "E-mail *", phone: "Telefone *", pickup: "Recolha *", drop: "Destino *", date: "Data *", message: "Notas", submit: "Enviar pedido" },
  navHome: "Início", navAirport: "Transfers de aeroporto", navContact: "Contacto",
  ctaWa: "WhatsApp para um preço", ctaCall: "Ligar agora", ctaBook: "Reservar no site",
  prices: ["Heathrow £92 só ida ou £180 ida e volta", "Gatwick £140 / £270", "Luton £105 / £205", "Stansted £150 / £290"],
  lHeathrowIn: "Heathrow para Oxford · £92 / £180", lStudent: "Chegada de estudantes", lAirport: "Transfers e preços", lHeathrowOut: "Oxford para Heathrow", lGatwick: "Oxford para Gatwick", lPickup: "Como funciona a recolha", lContact: "WhatsApp, telefone e reserva",
  faqs: {
    home: fareFaqs("Quanto custa Heathrow para Oxford?", "Carro standard £92 só ida ou £180 ida e volta até 4 passageiros. O preço confirmado na reserva é o que pagam.", "Os motoristas falam português?", "Falam sobretudo inglês. Podem escrever em português no WhatsApp e usaremos tradução."),
    airport: fareFaqs("Quais são os preços a partir de Oxford?", "Carro standard até 4 passageiros: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290 só ida e ida e volta ao reservar as duas viagens juntas.", "A espera após o aterrar está incluída?", "Sim. Têm 50 minutos a partir do aterrar real para avisar que estão prontos. Depois £10 por cada 30 minutos extra ou fração."),
  },
  home: {
    title: "Táxi em Oxford | Preço combinado antes da viagem | Spires Taxis",
    ogTitle: "Táxi em Oxford | Preço combinado",
    description: "Private hire com licença em Oxford. Preços fixos para aeroportos e viagens locais. Reservem com antecedência. WhatsApp ou 07776 897772.",
    ogDescription: "Táxi com licença em Oxford. Preço fixo para aeroporto e viagens locais.",
    h1: "Táxi em Oxford, preço combinado antes de sair",
    lead: "Somos uma empresa de private hire com licença em Oxford. Confirmamos a tarifa antes da viagem, sem taxímetro no trânsito. Heathrow para Oxford em carro standard <strong>£92 só ida</strong> ou <strong>£180 ida e volta</strong> até 4 passageiros.",
    wa: "Olá, preciso de um táxi em Oxford. Detalhes:",
    more: "Páginas em português", moreLead: "Apenas preços publicados de Oxford. Outras localidades são cotadas à parte.",
    cover: "O que cobrimos", coverP: "Viagens em Oxford, recolha no aeroporto, colleges, hospitais e hotéis. A tarifa confirmada na reserva é a que pagam.",
    wait: "Após o aterrar têm 50 minutos para avisar que estão prontos. Depois a espera é £10 por cada 30 minutos extra ou fração. A taxa standard de recolha no aeroporto está incluída.",
    listed: "Preços publicados de Oxford", formH: "Pedir reserva",
  },
  airport: {
    title: "Transfers de aeroporto a partir de Oxford | Preços publicados | Spires Taxis",
    ogTitle: "Transfers de aeroporto a partir de Oxford",
    description: "Preços Oxford em carro standard: Heathrow £92 / £180, Gatwick £140 / £270, Luton £105 / £205, Stansted £150 / £290. 50 minutos após o aterrar.",
    ogDescription: "Preços publicados Oxford para Heathrow, Gatwick, Luton e Stansted.",
    h1: "Transfers de aeroporto a partir de Oxford e para Oxford",
    lead: "Preços fixos desde moradas em Oxford para os principais aeroportos e recolha à chegada. Carro standard até 4 passageiros. Outras localidades são cotadas à parte.",
    wa: "Olá, preciso de um transfer de aeroporto a partir de Oxford. Aeroporto: []. Data: []",
    tableH: "Carro standard a partir de Oxford", tableLead: "Até 4 passageiros. Ida e volta ao reservar as duas viagens de Oxford juntas.",
    thAirport: "Aeroporto", thOne: "Só ida", thRet: "Ida e volta",
    eight: 'Preços do veículo de 8 lugares na <a href="/rates">página de preços em inglês</a>.',
    formH: "Pedir transfer",
  },
}, {
  hoT: "Táxi de Oxford para Heathrow | Preço fixo | Spires Taxis", hoOg: "Táxi de Oxford para Heathrow",
  hoD: "De Oxford para os terminais 2, 3, 4 e 5 de Heathrow. Carro standard £92 só ida ou £180 ida e volta. A taxa standard de chegada no aeroporto está incluída.",
  hoOD: "Oxford para Heathrow £92 só ida ou £180 ida e volta.", hoH1: "Táxi de Oxford para Heathrow",
  hoL: "Viagem reservada com antecedência para os terminais 2, 3, 4 e 5. Carro standard <strong>£92 só ida</strong> ou <strong>£180 ida e volta</strong> até 4 passageiros.",
  hoWa: "Olá, preciso de um carro de Oxford para Heathrow. Morada: []. Voo: []",
  hoH2: "Quando sair de Oxford", hoP: "Indiquem terminal, hora de partida, passageiros e malas. A viagem costuma ser 60 a 90 minutos com trânsito normal.",
  hoC: "<strong>Carro standard £92 ou £180 ida e volta</strong> para Oxford até 4 passageiros.", hoF: "Pedir viagem para Heathrow",
  hoFaqs: fareFaqs("Quanto custa Oxford para Heathrow?", "Carro standard £92 só ida ou £180 ida e volta até 4 passageiros ao reservar as duas viagens juntas.", "A taxa de chegada está incluída?", "Sim. A taxa standard de chegada no aeroporto está no preço publicado."),
  gwT: "Táxi de Oxford para Gatwick | Preço fixo | Spires Taxis", gwOg: "Táxi de Oxford para Gatwick",
  gwD: "De Oxford para Gatwick em carro standard £140 só ida ou £270 ida e volta até 4 passageiros.",
  gwOD: "Oxford para Gatwick £140 só ida ou £270 ida e volta.", gwH1: "Táxi de Oxford para Gatwick",
  gwL: "Viagem reservada com antecedência para Gatwick. Carro standard <strong>£140 só ida</strong> ou <strong>£270 ida e volta</strong> até 4 passageiros.",
  gwWa: "Olá, preciso de um carro de Oxford para Gatwick. Morada: []. Voo: []",
  gwH2: "Muito usado no fim do termo", gwP: "Muitos estudantes vão para Gatwick com malas. Se forem quatro ou precisarem de um veículo de 8 lugares, digam quantas malas levam.",
  gwC: 'Outros preços de Oxford em <a href="/pt/airport-transfers">transfers de aeroporto</a>.', gwF: "Pedir viagem para Gatwick",
  gwFaqs: fareFaqs("Quanto custa Oxford para Gatwick?", "Carro standard £140 só ida ou £270 ida e volta até 4 passageiros.", "North e South Terminal?", "Sim. Indiquem o terminal na reserva."),
  hiT: "Táxi de Heathrow para Oxford | Preço fixo | Spires Taxis", hiOg: "Táxi de Heathrow para Oxford",
  hiD: "Recolha em qualquer terminal de Heathrow para Oxford. Carro standard £92 só ida ou £180 ida e volta. 50 minutos após o aterrar.",
  hiOD: "Heathrow para Oxford £92 só ida ou £180 ida e volta.", hiH1: "Táxi de Heathrow para Oxford",
  hiL: "Recolha reservada com antecedência de qualquer terminal de Heathrow para Oxford, incluindo Headington. Carro standard <strong>£92 só ida</strong> ou <strong>£180 ida e volta</strong>.",
  hiWa: "Olá, preciso de um carro de Heathrow para Oxford. Terminal: []. Voo: []. Destino: []",
  hiH2: "Recolha à chegada", hiP: "Enviem o número do voo e o terminal. Seguimos a hora real de aterragem. Têm 50 minutos para avisar que estão prontos.",
  hiC: "<strong>Carro standard £92 ou £180 ida e volta</strong> para Oxford até 4 passageiros.", hiF: "Pedir recolha",
  hiFaqs: fareFaqs("Quanto custa Heathrow para Oxford?", "Carro standard £92 só ida ou £180 ida e volta até 4 passageiros.", "O motorista espera nas chegadas?", "Sim. Indiquem terminal e número do voo. Pode esperar nas chegadas com um cartaz com o nome."),
  pkT: "Como funciona a recolha no aeroporto | Spires Taxis", pkOg: "Como funciona a recolha no aeroporto",
  pkD: "Seguimos o voo pela hora real de aterragem. 50 minutos para avisar, depois £10 por 30 minutos. A taxa standard de recolha está incluída.",
  pkOD: "50 minutos após o aterrar, depois £10 por 30 minutos.", pkH1: "Como funciona a recolha no aeroporto",
  pkL: "Usamos a hora real de aterragem. Têm <strong>50 minutos</strong> para avisar. Depois a espera é <strong>£10 por cada 30 minutos</strong> extra ou fração.",
  pkWa: "Olá, preciso de recolha no aeroporto. Voo: []. Terminal: []. Destino: []",
  pkH2: "No dia da viagem", pkP: "Antes da partida confirmamos terminal e telemóvel. Ao aterrar seguimos o voo. Depois das malas avisem dentro de 50 minutos.",
  pkC: "A taxa standard de recolha no aeroporto está incluída.", pkF: "Pedir recolha",
  pkFaqs: fareFaqs("Quantos minutos de espera?", "50 minutos a partir do aterrar real. Depois £10 por cada 30 minutos extra ou fração.", "O que enviar?", "Número do voo, terminal se souberem, passageiros, malas, um telemóvel que funcione no Reino Unido e a morada completa."),
  stT: "Chegada de estudantes a Oxford | Táxi de aeroporto | Spires Taxis", stOg: "Chegada de estudantes a Oxford",
  stD: "Do aeroporto para o college ou residência, com malas. Desconto de estudante com cartão válido. Os motoristas falam sobretudo inglês.",
  stOD: "Recolha para o college ou residência. Desconto de estudante com cartão válido.", stH1: "Chegada de estudantes a Oxford",
  stL: "Do aeroporto para o college ou residência, com malas. Há <strong>desconto de estudante</strong>. Digam na reserva e tragam um cartão válido.",
  stWa: "Olá, preciso de um táxi de estudante em Oxford. Data: []. Recolha: []. Destino: []. Desconto de estudante",
  stH2: "Quando os estudantes reservam", stP: "As semanas de início de termo são as mais ocupadas. Recolhemos nos colleges da University of Oxford, Oxford Brookes em Headington e casas partilhadas. Desconto de estudante nos nossos serviços com cartão válido no dia da viagem.",
  stC: "Oxford para Heathrow em carro standard £92 só ida ou £180 ida e volta até 4 passageiros.", stF: "Pedir táxi de estudante",
  stFaqs: fareFaqs("Há desconto de estudante?", "Sim. Digam na reserva e tragam um cartão de estudante válido no dia da viagem.", "Quatro estudantes podem ir para Heathrow?", "Sim. Carro standard de Oxford para Heathrow £92 só ida ou £180 ida e volta até 4 passageiros."),
  ctT: "Contacto em Oxford | WhatsApp e telefone | Spires Taxis PT", ctOg: "Contacto em Oxford",
  ctD: "Reservem por WhatsApp, no 07776 897772 ou por e-mail bookings@spires-taxis.com. Viagens reservadas com antecedência em Oxford e Oxfordshire.",
  ctOD: "WhatsApp, 07776 897772 ou bookings@spires-taxis.com para um táxi em Oxford.", ctH1: "Contacto",
  ctL: "WhatsApp, chamada ou formulário. Telefone <strong>07776 897772</strong>. E-mail <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>.",
  ctWa: "Olá, quero reservar um táxi em Oxford.",
  ctH2: "O que precisamos para confirmar o preço", ctP: "Data e hora, morada completa, destino, passageiros e malas, e o número do voo se for recolha no aeroporto.",
  ctC: "A reserva no site está em inglês. O WhatsApp pode ser em português com tradução.", ctF: "Enviar pedido",
  ctFaqs: fareFaqs("Qual é a forma mais rápida?", "WhatsApp 07776 897772 costuma ser o mais rápido se enviarem morada, data e número do voo.", "Dá para reservar em português?", "Sim, no WhatsApp em português com tradução. Os motoristas falam sobretudo inglês."),
});

shortLang("hi", {
  _pfx: "/hi",
  note: "हमारे ड्राइवर मुख्य रूप से अंग्रेज़ी बोलते हैं। आप हिंदी में WhatsApp कर सकते हैं, हम अनुवाद की मदद लेंगे। customer.spires-taxis.com पर बुकिंग अंग्रेज़ी में है।",
  form: { name: "पूरा नाम *", email: "ईमेल *", phone: "फ़ोन *", pickup: "पिकअप *", drop: "गंतव्य *", date: "तारीख *", message: "नोट", submit: "अनुरोध भेजें" },
  navHome: "होम", navAirport: "एयरपोर्ट ट्रांसफर", navContact: "संपर्क",
  ctaWa: "कीमत के लिए WhatsApp", ctaCall: "अभी कॉल करें", ctaBook: "वेबसाइट पर बुक करें",
  prices: ["हीथ्रो £92 एक तरफ़ या £180 आना जाना", "गैटविक £140 / £270", "लूटन £105 / £205", "स्टैनस्टेड £150 / £290"],
  lHeathrowIn: "हीथ्रो से ऑक्सफर्ड · £92 / £180", lStudent: "छात्र आगमन", lAirport: "ट्रांसफर और कीमतें", lHeathrowOut: "ऑक्सफर्ड से हीथ्रो", lGatwick: "ऑक्सफर्ड से गैटविक", lPickup: "पिकअप कैसे होता है", lContact: "WhatsApp, फ़ोन और बुकिंग",
  faqs: {
    home: fareFaqs("हीथ्रो से ऑक्सफर्ड कितने का है?", "स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना, अधिकतम 4 यात्री। बुकिंग पर पुष्टि कीमत वही है जो आप चुकाते हैं।", "क्या ड्राइवर हिंदी बोलते हैं?", "वे मुख्य रूप से अंग्रेज़ी बोलते हैं। आप हिंदी में WhatsApp कर सकते हैं, हम अनुवाद की मदद लेंगे।"),
    airport: fareFaqs("ऑक्सफर्ड से प्रकाशित कीमतें क्या हैं?", "स्टैंडर्ड कार अधिकतम 4 यात्री: हीथ्रो £92 / £180, गैटविक £140 / £270, लूटन £105 / £205, स्टैनस्टेड £150 / £290 एक तरफ़ और आना जाना जब दोनों यात्राएँ साथ बुक हों।", "लैंडिंग के बाद इंतज़ार शामिल है?", "हाँ। वास्तविक लैंडिंग से 50 मिनट में हमें बताएँ कि आप तैयार हैं। उसके बाद हर 30 मिनट या उसके भाग पर £10।"),
  },
  home: {
    title: "ऑक्सफर्ड टैक्सी | यात्रा से पहले तय किराया | Spires Taxis",
    ogTitle: "ऑक्सफर्ड टैक्सी | तय किराया",
    description: "ऑक्सफर्ड में लाइसेंस प्राप्त प्राइवेट हायर। एयरपोर्ट और स्थानीय यात्राओं के लिए तय कीमत। पहले से बुक करें। WhatsApp या 07776 897772।",
    ogDescription: "ऑक्सफर्ड में लाइसेंस प्राप्त टैक्सी। एयरपोर्ट और स्थानीय तय कीमत।",
    h1: "ऑक्सफर्ड टैक्सी, निकलने से पहले तय कीमत",
    lead: "हम ऑक्सफर्ड की लाइसेंस प्राप्त प्राइवेट हायर कंपनी हैं। यात्रा से पहले किराया पक्का करते हैं, ट्रैफ़िक में मीटर नहीं। हीथ्रो से ऑक्सफर्ड स्टैंडर्ड कार <strong>£92 एक तरफ़</strong> या <strong>£180 आना जाना</strong>, अधिकतम 4 यात्री।",
    wa: "नमस्ते, ऑक्सफर्ड में टैक्सी चाहिए। विवरण:",
    more: "हिंदी पेज", moreLead: "केवल ऑक्सफर्ड की प्रकाशित कीमतें। आसपास के शहर अलग से बताए जाते हैं।",
    cover: "हम क्या कवर करते हैं", coverP: "ऑक्सफर्ड के अंदर यात्रा, एयरपोर्ट पिकअप, कॉलेज, अस्पताल और होटल। बुकिंग पर पुष्टि किराया वही है जो आप चुकाते हैं।",
    wait: "लैंडिंग के बाद आपके पास 50 मिनट हैं हमें बताने के लिए कि आप तैयार हैं। उसके बाद इंतज़ार हर 30 मिनट या उसके भाग पर £10। एयरपोर्ट की सामान्य पिकअप फीस शामिल है।",
    listed: "ऑक्सफर्ड की प्रकाशित कीमतें", formH: "बुकिंग का अनुरोध",
  },
  airport: {
    title: "ऑक्सफर्ड से एयरपोर्ट ट्रांसफर | प्रकाशित कीमतें | Spires Taxis",
    ogTitle: "ऑक्सफर्ड से एयरपोर्ट ट्रांसफर",
    description: "ऑक्सफर्ड स्टैंडर्ड कार: हीथ्रो £92 / £180, गैटविक £140 / £270, लूटन £105 / £205, स्टैनस्टेड £150 / £290। लैंडिंग के बाद 50 मिनट।",
    ogDescription: "ऑक्सफर्ड से हीथ्रो, गैटविक, लूटन, स्टैनस्टेड की प्रकाशित कीमतें।",
    h1: "ऑक्सफर्ड से और ऑक्सफर्ड तक एयरपोर्ट ट्रांसफर",
    lead: "ऑक्सफर्ड पते से मुख्य एयरपोर्ट तक तय कीमत, और आगमन पर पिकअप। स्टैंडर्ड कार अधिकतम 4 यात्री। आसपास के शहर अलग से।",
    wa: "नमस्ते, ऑक्सफर्ड से एयरपोर्ट ट्रांसफर चाहिए। एयरपोर्ट: []. तारीख: []",
    tableH: "ऑक्सफर्ड से स्टैंडर्ड कार", tableLead: "अधिकतम 4 यात्री। आना जाना जब ऑक्सफर्ड की दोनों यात्राएँ साथ बुक हों।",
    thAirport: "एयरपोर्ट", thOne: "एक तरफ़", thRet: "आना जाना",
    eight: '8 सीट की कीमतें <a href="/rates">अंग्रेज़ी रेट पेज</a> पर।',
    formH: "ट्रांसफर का अनुरोध",
  },
}, {
  hoT: "ऑक्सफर्ड से हीथ्रो टैक्सी | तय कीमत | Spires Taxis", hoOg: "ऑक्सफर्ड से हीथ्रो टैक्सी",
  hoD: "ऑक्सफर्ड से हीथ्रो टर्मिनल 2, 3, 4 और 5। स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना। एयरपोर्ट की सामान्य ड्रॉप फीस शामिल।",
  hoOD: "ऑक्सफर्ड से हीथ्रो £92 एक तरफ़ या £180 आना जाना।", hoH1: "ऑक्सफर्ड से हीथ्रो टैक्सी",
  hoL: "टर्मिनल 2, 3, 4 और 5 के लिए पहले से बुक यात्रा। स्टैंडर्ड कार <strong>£92 एक तरफ़</strong> या <strong>£180 आना जाना</strong>, अधिकतम 4 यात्री।",
  hoWa: "नमस्ते, ऑक्सफर्ड से हीथ्रो कार चाहिए। पता: []. फ़्लाइट: []",
  hoH2: "ऑक्सफर्ड से कब निकलें", hoP: "टर्मिनल, उड़ान समय, यात्री और सामान बताएँ। सामान्य ट्रैफ़िक में 60 से 90 मिनट लगते हैं।",
  hoC: "<strong>स्टैंडर्ड कार £92 या £180 आना जाना</strong> ऑक्सफर्ड तक 4 यात्री।", hoF: "हीथ्रो यात्रा का अनुरोध",
  hoFaqs: fareFaqs("ऑक्सफर्ड से हीथ्रो कितने का?", "स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना, अधिकतम 4 यात्री, जब दोनों यात्राएँ साथ बुक हों।", "ड्रॉप फीस शामिल है?", "हाँ। एयरपोर्ट की सामान्य ड्रॉप फीस प्रकाशित कीमत में है।"),
  gwT: "ऑक्सफर्ड से गैटविक टैक्सी | तय कीमत | Spires Taxis", gwOg: "ऑक्सफर्ड से गैटविक टैक्सी",
  gwD: "ऑक्सफर्ड से गैटविक स्टैंडर्ड कार £140 एक तरफ़ या £270 आना जाना, अधिकतम 4 यात्री।",
  gwOD: "ऑक्सफर्ड से गैटविक £140 एक तरफ़ या £270 आना जाना।", gwH1: "ऑक्सफर्ड से गैटविक टैक्सी",
  gwL: "गैटविक के लिए पहले से बुक यात्रा। स्टैंडर्ड कार <strong>£140 एक तरफ़</strong> या <strong>£270 आना जाना</strong>, अधिकतम 4 यात्री।",
  gwWa: "नमस्ते, ऑक्सफर्ड से गैटविक कार चाहिए। पता: []. फ़्लाइट: []",
  gwH2: "सेमेस्टर के अंत में आम", gwP: "कई छात्र सामान के साथ गैटविक जाते हैं। अगर चार लोग हैं या 8 सीट चाहिए, तो बैग की संख्या बताएँ।",
  gwC: 'बाकी ऑक्सफर्ड कीमतें <a href="/hi/airport-transfers">एयरपोर्ट ट्रांसफर</a> पर।', gwF: "गैटविक यात्रा का अनुरोध",
  gwFaqs: fareFaqs("ऑक्सफर्ड से गैटविक कितने का?", "स्टैंडर्ड कार £140 एक तरफ़ या £270 आना जाना, अधिकतम 4 यात्री।", "North और South Terminal?", "हाँ। बुकिंग पर टर्मिनल बताएँ।"),
  hiT: "हीथ्रो से ऑक्सफर्ड टैक्सी | तय कीमत | Spires Taxis", hiOg: "हीथ्रो से ऑक्सफर्ड टैक्सी",
  hiD: "हीथ्रो के किसी भी टर्मिनल से ऑक्सफर्ड पिकअप। स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना। लैंडिंग के बाद 50 मिनट।",
  hiOD: "हीथ्रो से ऑक्सफर्ड £92 एक तरफ़ या £180 आना जाना।", hiH1: "हीथ्रो से ऑक्सफर्ड टैक्सी",
  hiL: "हीथ्रो के किसी भी टर्मिनल से ऑक्सफर्ड, Headington सहित, पहले से बुक पिकअप। स्टैंडर्ड कार <strong>£92 एक तरफ़</strong> या <strong>£180 आना जाना</strong>।",
  hiWa: "नमस्ते, हीथ्रो से ऑक्सफर्ड कार चाहिए। टर्मिनल: []. फ़्लाइट: []. गंतव्य: []",
  hiH2: "आगमन पर पिकअप", hiP: "फ़्लाइट नंबर और टर्मिनल भेजें। हम वास्तविक लैंडिंग समय देखते हैं। तैयार होने पर 50 मिनट में बताएँ।",
  hiC: "<strong>स्टैंडर्ड कार £92 या £180 आना जाना</strong> ऑक्सफर्ड तक 4 यात्री।", hiF: "पिकअप का अनुरोध",
  hiFaqs: fareFaqs("हीथ्रो से ऑक्सफर्ड कितने का?", "स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना, अधिकतम 4 यात्री।", "ड्राइवर अराइवल में इंतज़ार करता है?", "हाँ। टर्मिनल और फ़्लाइट नंबर बताएँ। नाम की पट्टिका के साथ अराइवल में मिल सकते हैं।"),
  pkT: "एयरपोर्ट पिकअप कैसे होता है | Spires Taxis", pkOg: "एयरपोर्ट पिकअप कैसे होता है",
  pkD: "वास्तविक लैंडिंग समय के अनुसार फ़्लाइट देखते हैं। बताने के लिए 50 मिनट, फिर हर 30 मिनट £10। सामान्य पिकअप फीस शामिल।",
  pkOD: "लैंडिंग के बाद 50 मिनट, फिर हर 30 मिनट £10।", pkH1: "एयरपोर्ट पिकअप कैसे होता है",
  pkL: "हम वास्तविक लैंडिंग समय से चलते हैं। आपके पास बताने के लिए <strong>50 मिनट</strong> हैं। उसके बाद इंतज़ार <strong>हर 30 मिनट £10</strong> या उसके भाग पर।",
  pkWa: "नमस्ते, एयरपोर्ट पिकअप चाहिए। फ़्लाइट: []. टर्मिनल: []. गंतव्य: []",
  pkH2: "यात्रा के दिन", pkP: "उड़ान से पहले टर्मिनल और मोबाइल पक्का करते हैं। लैंडिंग पर फ़्लाइट देखते हैं। सामान के बाद 50 मिनट में बताएँ।",
  pkC: "एयरपोर्ट की सामान्य पिकअप फीस शामिल है।", pkF: "पिकअप का अनुरोध",
  pkFaqs: fareFaqs("कितने मिनट इंतज़ार?", "वास्तविक लैंडिंग से 50 मिनट। उसके बाद हर 30 मिनट या उसके भाग पर £10।", "क्या भेजें?", "फ़्लाइट नंबर, टर्मिनल अगर पता हो, यात्री, सामान, ब्रिटेन में चलने वाला मोबाइल और पूरा पता।"),
  stT: "ऑक्सफर्ड में छात्र आगमन | एयरपोर्ट टैक्सी | Spires Taxis", stOg: "ऑक्सफर्ड में छात्र आगमन",
  stD: "एयरपोर्ट से कॉलेज या हॉस्टल, सामान के साथ। वैध छात्र कार्ड पर छूट। ड्राइवर मुख्य रूप से अंग्रेज़ी बोलते हैं।",
  stOD: "कॉलेज या हॉस्टल पिकअप। वैध कार्ड पर छात्र छूट।", stH1: "ऑक्सफर्ड में छात्र आगमन",
  stL: "एयरपोर्ट से कॉलेज या हॉस्टल, सामान के साथ। <strong>छात्र छूट</strong> उपलब्ध है। बुकिंग पर बताएँ और वैध कार्ड साथ लाएँ।",
  stWa: "नमस्ते, ऑक्सफर्ड में छात्र टैक्सी चाहिए। तारीख: []. पिकअप: []. गंतव्य: []. छात्र छूट",
  stH2: "छात्र कब बुक करते हैं", stP: "टर्म शुरू होने वाले हफ़्ते सबसे व्यस्त होते हैं। University of Oxford के कॉलेज, Headington में Oxford Brookes और शेयर हाउस से पिकअप। यात्रा के दिन वैध कार्ड पर हमारी सेवाओं में छात्र छूट।",
  stC: "ऑक्सफर्ड से हीथ्रो स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना, अधिकतम 4 यात्री।", stF: "छात्र टैक्सी का अनुरोध",
  stFaqs: fareFaqs("छात्र छूट है?", "हाँ। बुकिंग पर बताएँ और यात्रा के दिन वैध छात्र कार्ड लाएँ।", "चार छात्र हीथ्रो जा सकते हैं?", "हाँ। ऑक्सफर्ड से हीथ्रो स्टैंडर्ड कार £92 एक तरफ़ या £180 आना जाना, अधिकतम 4 यात्री।"),
  ctT: "ऑक्सफर्ड संपर्क | WhatsApp और फ़ोन | Spires Taxis HI", ctOg: "ऑक्सफर्ड संपर्क",
  ctD: "WhatsApp, 07776 897772 या bookings@spires-taxis.com पर बुक करें। ऑक्सफर्ड और ऑक्सफर्डशायर में पहले से बुकिंग।",
  ctOD: "WhatsApp, 07776 897772 या bookings@spires-taxis.com पर ऑक्सफर्ड टैक्सी।", ctH1: "संपर्क",
  ctL: "WhatsApp, कॉल या फ़ॉर्म। फ़ोन <strong>07776 897772</strong>। ईमेल <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>।",
  ctWa: "नमस्ते, ऑक्सफर्ड में टैक्सी बुक करनी है।",
  ctH2: "कीमत पक्की करने के लिए क्या चाहिए", ctP: "तारीख और समय, पूरा पता, गंतव्य, यात्री और सामान, और एयरपोर्ट पिकअप हो तो फ़्लाइट नंबर।",
  ctC: "वेबसाइट बुकिंग अंग्रेज़ी में है। WhatsApp हिंदी में अनुवाद के साथ हो सकता है।", ctF: "अनुरोध भेजें",
  ctFaqs: fareFaqs("सबसे तेज़ तरीका कौन सा है?", "WhatsApp 07776 897772 अक्सर सबसे तेज़ है अगर पता, तारीख और फ़्लाइट नंबर भेजें।", "हिंदी में बुक कर सकते हैं?", "हाँ, WhatsApp पर हिंदी में अनुवाद के साथ। ड्राइवर मुख्य रूप से अंग्रेज़ी बोलते हैं।"),
});

shortLang("ur", {
  _pfx: "/ur",
  note: "ہمارے ڈرائیور زیادہ تر انگریزی بولتے ہیں۔ آپ اردو میں WhatsApp کر سکتے ہیں، ہم ترجمہ استعمال کریں گے۔ customer.spires-taxis.com پر بکنگ انگریزی میں ہے۔",
  form: { name: "پورا نام *", email: "ای میل *", phone: "فون *", pickup: "پک اپ *", drop: "منزل *", date: "تاریخ *", message: "نوٹ", submit: "درخواست بھیجیں" },
  navHome: "ہوم", navAirport: "ایئرپورٹ ٹرانسفر", navContact: "رابطہ",
  ctaWa: "قیمت کے لیے WhatsApp", ctaCall: "ابھی کال کریں", ctaBook: "ویب سائٹ پر بک کریں",
  prices: ["ہیترو £92 ایک طرف یا £180 آنا جانا", "گیٹ وک £140 / £270", "لوٹن £105 / £205", "سٹینسٹڈ £150 / £290"],
  lHeathrowIn: "ہیترو سے آکسفورڈ · £92 / £180", lStudent: "طلبہ کی آمد", lAirport: "ٹرانسفر اور قیمتیں", lHeathrowOut: "آکسفورڈ سے ہیترو", lGatwick: "آکسفورڈ سے گیٹ وک", lPickup: "پک اپ کیسے ہوتا ہے", lContact: "WhatsApp، فون اور بکنگ",
  faqs: {
    home: fareFaqs("ہیترو سے آکسفورڈ کتنے کا ہے؟", "سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا، زیادہ سے زیادہ 4 مسافر۔ بکنگ پر تصدیق شدہ قیمت وہی ہے جو آپ ادا کرتے ہیں۔", "کیا ڈرائیور اردو بولتے ہیں؟", "وہ زیادہ تر انگریزی بولتے ہیں۔ آپ اردو میں WhatsApp کر سکتے ہیں، ہم ترجمہ استعمال کریں گے۔"),
    airport: fareFaqs("آکسفورڈ سے شائع شدہ قیمتیں کیا ہیں؟", "سٹینڈرڈ کار زیادہ سے زیادہ 4 مسافر: ہیترو £92 / £180، گیٹ وک £140 / £270، لوٹن £105 / £205، سٹینسٹڈ £150 / £290 ایک طرف اور آنا جانا جب دونوں سفر ساتھ بک ہوں۔", "لینڈنگ کے بعد انتظار شامل ہے؟", "ہاں। اصل لینڈنگ سے 50 منٹ میں ہمیں بتائیں کہ آپ تیار ہیں۔ اس کے بعد ہر 30 منٹ یا اس کے حصے پر £10۔"),
  },
  home: {
    title: "آکسفورڈ ٹیکسی | سفر سے پہلے طے شدہ کرایہ | Spires Taxis",
    ogTitle: "آکسفورڈ ٹیکسی | طے شدہ کرایہ",
    description: "آکسفورڈ میں لائسنس یافتہ پرائیویٹ ہائر۔ ایئرپورٹ اور مقامی سفر کے لیے طے شدہ قیمت۔ پہلے سے بک کریں۔ WhatsApp یا 07776 897772۔",
    ogDescription: "آکسفورڈ میں لائسنس یافتہ ٹیکسی۔ ایئرپورٹ اور مقامی طے شدہ قیمت۔",
    h1: "آکسفورڈ ٹیکسی، نکلنے سے پہلے طے شدہ قیمت",
    lead: "ہم آکسفورڈ کی لائسنس یافتہ پرائیویٹ ہائر کمپنی ہیں۔ سفر سے پہلے کرایہ پکا کرتے ہیں، ٹریفک میں میٹر نہیں۔ ہیترو سے آکسفورڈ سٹینڈرڈ کار <strong>£92 ایک طرف</strong> یا <strong>£180 آنا جانا</strong>، زیادہ سے زیادہ 4 مسافر۔",
    wa: "السلام علیکم، آکسفورڈ میں ٹیکسی چاہیے۔ تفصیل:",
    more: "اردو صفحات", moreLead: "صرف آکسفورڈ کی شائع شدہ قیمتیں۔ قریبی قصبے الگ سے بتائے جاتے ہیں۔",
    cover: "ہم کیا کور کرتے ہیں", coverP: "آکسفورڈ کے اندر سفر، ایئرپورٹ پک اپ، کالج، ہسپتال اور ہوٹل۔ بکنگ پر تصدیق شدہ کرایہ وہی ہے جو آپ ادا کرتے ہیں۔",
    wait: "لینڈنگ کے بعد آپ کے پاس 50 منٹ ہیں ہمیں بتانے کے لیے کہ آپ تیار ہیں۔ اس کے بعد انتظار ہر 30 منٹ یا اس کے حصے پر £10۔ ایئرپورٹ کی عام پک اپ فیس شامل ہے۔",
    listed: "آکسفورڈ کی شائع شدہ قیمتیں", formH: "بکنگ کی درخواست",
  },
  airport: {
    title: "آکسفورڈ سے ایئرپورٹ ٹرانسفر | شائع شدہ قیمتیں | Spires Taxis",
    ogTitle: "آکسفورڈ سے ایئرپورٹ ٹرانسفر",
    description: "آکسفورڈ سٹینڈرڈ کار: ہیترو £92 / £180، گیٹ وک £140 / £270، لوٹن £105 / £205، سٹینسٹڈ £150 / £290۔ لینڈنگ کے بعد 50 منٹ۔",
    ogDescription: "آکسفورڈ سے ہیترو، گیٹ وک، لوٹن، سٹینسٹڈ کی شائع شدہ قیمتیں۔",
    h1: "آکسفورڈ سے اور آکسفورڈ تک ایئرپورٹ ٹرانسفر",
    lead: "آکسفورڈ پتوں سے بڑے ایئرپورٹ تک طے شدہ قیمت، اور آمد پر پک اپ۔ سٹینڈرڈ کار زیادہ سے زیادہ 4 مسافر۔ قریبی قصبے الگ سے۔",
    wa: "السلام علیکم، آکسفورڈ سے ایئرپورٹ ٹرانسفر چاہیے۔ ایئرپورٹ: []. تاریخ: []",
    tableH: "آکسفورڈ سے سٹینڈرڈ کار", tableLead: "زیادہ سے زیادہ 4 مسافر۔ آنا جانا جب آکسفورڈ کے دونوں سفر ساتھ بک ہوں۔",
    thAirport: "ایئرپورٹ", thOne: "ایک طرف", thRet: "آنا جانا",
    eight: '8 سیٹ کی قیمتیں <a href="/rates">انگریزی ریٹ صفحے</a> پر۔',
    formH: "ٹرانسفر کی درخواست",
  },
}, {
  hoT: "آکسفورڈ سے ہیترو ٹیکسی | طے شدہ قیمت | Spires Taxis", hoOg: "آکسفورڈ سے ہیترو ٹیکسی",
  hoD: "آکسفورڈ سے ہیترو ٹرمینل 2، 3، 4 اور 5۔ سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا۔ ایئرپورٹ کی عام ڈراپ فیس شامل۔",
  hoOD: "آکسفورڈ سے ہیترو £92 ایک طرف یا £180 آنا جانا۔", hoH1: "آکسفورڈ سے ہیترو ٹیکسی",
  hoL: "ٹرمینل 2، 3، 4 اور 5 کے لیے پہلے سے بک سفر۔ سٹینڈرڈ کار <strong>£92 ایک طرف</strong> یا <strong>£180 آنا جانا</strong>، زیادہ سے زیادہ 4 مسافر۔",
  hoWa: "السلام علیکم، آکسفورڈ سے ہیترو کار چاہیے۔ پتہ: []. پرواز: []",
  hoH2: "آکسفورڈ سے کب نکلیں", hoP: "ٹرمینل، روانگی وقت، مسافر اور سامان بتائیں۔ عام ٹریفک میں 60 سے 90 منٹ لگتے ہیں۔",
  hoC: "<strong>سٹینڈرڈ کار £92 یا £180 آنا جانا</strong> آکسفورڈ تک 4 مسافر۔", hoF: "ہیترو سفر کی درخواست",
  hoFaqs: fareFaqs("آکسفورڈ سے ہیترو کتنے کا؟", "سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا، زیادہ سے زیادہ 4 مسافر، جب دونوں سفر ساتھ بک ہوں۔", "ڈراپ فیس شامل ہے؟", "ہاں۔ ایئرپورٹ کی عام ڈراپ فیس شائع شدہ قیمت میں ہے۔"),
  gwT: "آکسفورڈ سے گیٹ وک ٹیکسی | طے شدہ قیمت | Spires Taxis", gwOg: "آکسفورڈ سے گیٹ وک ٹیکسی",
  gwD: "آکسفورڈ سے گیٹ وک سٹینڈرڈ کار £140 ایک طرف یا £270 آنا جانا، زیادہ سے زیادہ 4 مسافر۔",
  gwOD: "آکسفورڈ سے گیٹ وک £140 ایک طرف یا £270 آنا جانا۔", gwH1: "آکسفورڈ سے گیٹ وک ٹیکسی",
  gwL: "گیٹ وک کے لیے پہلے سے بک سفر۔ سٹینڈرڈ کار <strong>£140 ایک طرف</strong> یا <strong>£270 آنا جانا</strong>، زیادہ سے زیادہ 4 مسافر۔",
  gwWa: "السلام علیکم، آکسفورڈ سے گیٹ وک کار چاہیے۔ پتہ: []. پرواز: []",
  gwH2: "سیمسٹر کے آخر میں عام", gwP: "بہت سے طلبہ سامان کے ساتھ گیٹ وک جاتے ہیں۔ اگر چار لوگ ہیں یا 8 سیٹ چاہیے تو بیگ کی تعداد بتائیں۔",
  gwC: 'باقی آکسفورڈ قیمتیں <a href="/ur/airport-transfers">ایئرپورٹ ٹرانسفر</a> پر۔', gwF: "گیٹ وک سفر کی درخواست",
  gwFaqs: fareFaqs("آکسفورڈ سے گیٹ وک کتنے کا؟", "سٹینڈرڈ کار £140 ایک طرف یا £270 آنا جانا، زیادہ سے زیادہ 4 مسافر۔", "North اور South Terminal؟", "ہاں۔ بکنگ پر ٹرمینل بتائیں۔"),
  hiT: "ہیترو سے آکسفورڈ ٹیکسی | طے شدہ قیمت | Spires Taxis", hiOg: "ہیترو سے آکسفورڈ ٹیکسی",
  hiD: "ہیترو کے کسی بھی ٹرمینل سے آکسفورڈ پک اپ۔ سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا۔ لینڈنگ کے بعد 50 منٹ۔",
  hiOD: "ہیترو سے آکسفورڈ £92 ایک طرف یا £180 آنا جانا۔", hiH1: "ہیترو سے آکسفورڈ ٹیکسی",
  hiL: "ہیترو کے کسی بھی ٹرمینل سے آکسفورڈ، Headington سمیت، پہلے سے بک پک اپ۔ سٹینڈرڈ کار <strong>£92 ایک طرف</strong> یا <strong>£180 آنا جانا</strong>۔",
  hiWa: "السلام علیکم، ہیترو سے آکسفورڈ کار چاہیے۔ ٹرمینل: []. پرواز: []. منزل: []",
  hiH2: "آمد پر پک اپ", hiP: "پرواز نمبر اور ٹرمینل بھیجیں۔ ہم اصل لینڈنگ وقت دیکھتے ہیں۔ تیار ہونے پر 50 منٹ میں بتائیں۔",
  hiC: "<strong>سٹینڈرڈ کار £92 یا £180 آنا جانا</strong> آکسفورڈ تک 4 مسافر۔", hiF: "پک اپ کی درخواست",
  hiFaqs: fareFaqs("ہیترو سے آکسفورڈ کتنے کا؟", "سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا، زیادہ سے زیادہ 4 مسافر۔", "ڈرائیور ارائیول میں انتظار کرتا ہے؟", "ہاں۔ ٹرمینل اور پرواز نمبر بتائیں۔ نام کی تختی کے ساتھ ارائیول میں مل سکتے ہیں۔"),
  pkT: "ایئرپورٹ پک اپ کیسے ہوتا ہے | Spires Taxis", pkOg: "ایئرپورٹ پک اپ کیسے ہوتا ہے",
  pkD: "اصل لینڈنگ وقت کے مطابق پرواز دیکھتے ہیں۔ بتانے کے لیے 50 منٹ، پھر ہر 30 منٹ £10۔ عام پک اپ فیس شامل۔",
  pkOD: "لینڈنگ کے بعد 50 منٹ، پھر ہر 30 منٹ £10۔", pkH1: "ایئرپورٹ پک اپ کیسے ہوتا ہے",
  pkL: "ہم اصل لینڈنگ وقت سے چلتے ہیں۔ بتانے کے لیے <strong>50 منٹ</strong> ہیں۔ اس کے بعد انتظار <strong>ہر 30 منٹ £10</strong> یا اس کے حصے پر۔",
  pkWa: "السلام علیکم، ایئرپورٹ پک اپ چاہیے۔ پرواز: []. ٹرمینل: []. منزل: []",
  pkH2: "سفر کے دن", pkP: "روانگی سے پہلے ٹرمینل اور موبائل پکا کرتے ہیں۔ لینڈنگ پر پرواز دیکھتے ہیں۔ سامان کے بعد 50 منٹ میں بتائیں۔",
  pkC: "ایئرپورٹ کی عام پک اپ فیس شامل ہے۔", pkF: "پک اپ کی درخواست",
  pkFaqs: fareFaqs("کتنے منٹ انتظار؟", "اصل لینڈنگ سے 50 منٹ۔ اس کے بعد ہر 30 منٹ یا اس کے حصے پر £10۔", "کیا بھیجیں؟", "پرواز نمبر، ٹرمینل اگر معلوم ہو، مسافر، سامان، برطانیہ میں چلنے والا موبائل اور پورا پتہ۔"),
  stT: "آکسفورڈ میں طلبہ کی آمد | ایئرپورٹ ٹیکسی | Spires Taxis", stOg: "آکسفورڈ میں طلبہ کی آمد",
  stD: "ایئرپورٹ سے کالج یا ہاسٹل، سامان کے ساتھ۔ درست طالب علم کارڈ پر رعایت۔ ڈرائیور زیادہ تر انگریزی بولتے ہیں۔",
  stOD: "کالج یا ہاسٹل پک اپ۔ درست کارڈ پر طلبہ رعایت۔", stH1: "آکسفورڈ میں طلبہ کی آمد",
  stL: "ایئرپورٹ سے کالج یا ہاسٹل، سامان کے ساتھ۔ <strong>طلبہ رعایت</strong> دستیاب ہے۔ بکنگ پر بتائیں اور درست کارڈ ساتھ لائیں۔",
  stWa: "السلام علیکم، آکسفورڈ میں طالب علم ٹیکسی چاہیے۔ تاریخ: []. پک اپ: []. منزل: []. طلبہ رعایت",
  stH2: "طلبہ کب بک کرتے ہیں", stP: "ٹرم شروع ہونے والے ہفتے سب سے مصروف ہوتے ہیں۔ University of Oxford کے کالج، Headington میں Oxford Brookes اور شیئر ہاؤس سے پک اپ۔ سفر کے دن درست کارڈ پر ہماری خدمات میں طلبہ رعایت۔",
  stC: "آکسفورڈ سے ہیترو سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا، زیادہ سے زیادہ 4 مسافر۔", stF: "طالب علم ٹیکسی کی درخواست",
  stFaqs: fareFaqs("طلبہ رعایت ہے؟", "ہاں۔ بکنگ پر بتائیں اور سفر کے دن درست طالب علم کارڈ لائیں۔", "چار طلبہ ہیترو جا سکتے ہیں؟", "ہاں۔ آکسفورڈ سے ہیترو سٹینڈرڈ کار £92 ایک طرف یا £180 آنا جانا، زیادہ سے زیادہ 4 مسافر۔"),
  ctT: "آکسفورڈ رابطہ | WhatsApp اور فون | Spires Taxis UR", ctOg: "آکسفورڈ رابطہ",
  ctD: "WhatsApp، 07776 897772 یا bookings@spires-taxis.com پر بک کریں۔ آکسفورڈ اور آکسفورڈشائر میں پہلے سے بکنگ۔",
  ctOD: "WhatsApp، 07776 897772 یا bookings@spires-taxis.com پر آکسفورڈ ٹیکسی۔", ctH1: "رابطہ",
  ctL: "WhatsApp، کال یا فارم۔ فون <strong>07776 897772</strong>۔ ای میل <a href=\"mailto:bookings@spires-taxis.com\">bookings@spires-taxis.com</a>۔",
  ctWa: "السلام علیکم، آکسفورڈ میں ٹیکسی بک کرنی ہے۔",
  ctH2: "قیمت پکی کرنے کے لیے کیا چاہیے", ctP: "تاریخ اور وقت، پورا پتہ، منزل، مسافر اور سامان، اور ایئرپورٹ پک اپ ہو تو پرواز نمبر۔",
  ctC: "ویب سائٹ بکنگ انگریزی میں ہے۔ WhatsApp اردو میں ترجمہ کے ساتھ ہو سکتا ہے۔", ctF: "درخواست بھیجیں",
  ctFaqs: fareFaqs("سب سے تیز طریقہ کون سا ہے؟", "WhatsApp 07776 897772 اکثر سب سے تیز ہے اگر پتہ، تاریخ اور پرواز نمبر بھیجیں۔", "اردو میں بک کر سکتے ہیں؟", "ہاں، WhatsApp پر اردو میں ترجمہ کے ساتھ۔ ڈرائیور زیادہ تر انگریزی بولتے ہیں۔"),
});

function writePages() {
  for (const lang of LANGS) {
    if (SKIP_WRITE.has(lang.id)) continue;
    if (!LANG_COPY[lang.id]) throw new Error(`Missing copy for ${lang.id}`);
    const t = finishPack(LANG_COPY[lang.id], lang.prefix);
    for (const page of buildLang(lang, t)) {
      const rel = fileFromPath(page.canonical);
      const fp = path.join(root, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, pageHtml(lang, page));
      console.log("Wrote", rel);
    }
  }
}

function patchHreflang() {
  const re = /(?:[ \t]*<link rel="alternate" hreflang="[^"]+" href="[^"]+">\r?\n)+/;
  for (const cluster of LANG_CLUSTERS) {
    const enPath = cluster["en-GB"];
    const block = hreflangBlock(enPath) + "\n";
    for (const p of Object.values(cluster)) {
      const fp = path.join(root, fileFromPath(p));
      if (!fs.existsSync(fp)) continue;
      let html = fs.readFileSync(fp, "utf8");
      if (re.test(html)) {
        html = html.replace(re, block);
      } else {
        const canon = html.match(/<link rel="canonical" href="[^"]+">/);
        if (!canon) throw new Error(`Could not patch hreflang in ${fileFromPath(p)}`);
        html = html.replace(canon[0], `${canon[0]}\n${block.trimEnd()}`);
      }
      fs.writeFileSync(fp, html);
    }
  }
  console.log("Patched hreflang");
}

function stripOldSwitcher() {
  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "scripts", "includes", "api"].includes(name.name)) continue;
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith(".html")) {
        let html = fs.readFileSync(full, "utf8");
        const stripped = html
          .replace(/\r?\n<nav class="lang-switcher"[\s\S]*?<\/nav>\r?\n/g, "\n")
          .replace(/\r?\n<script src="\/js\/lang-switcher\.js" defer><\/script>\r?\n/g, "\n");
        if (stripped !== html) {
          fs.writeFileSync(full, stripped);
          console.log("Removed old switcher", path.relative(root, full));
        }
      }
    }
  }
  walk(root);
}

const mode = process.argv[2] || "all";
if (mode === "all" || mode === "write") writePages();
if (mode === "all" || mode === "patch") patchHreflang();
if (mode === "all" || mode === "strip") stripOldSwitcher();
console.log("Done.");




