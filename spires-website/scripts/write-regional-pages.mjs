#!/usr/bin/env node
/**
 * Write Oxfordshire town pages and the regional rates table.
 * Does not touch airport price files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { APPROVED_RANGES, REGIONAL_PAGES, rangeText } from "./lib/regional-locations.mjs";
import { SEO_BY_FILE } from "./lib/seo-copy.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.spires-taxis.com";
const PHONE_DISPLAY = "07776 897772";
const PHONE_TEL = "tel:+447776897772";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waHref(place) {
  const text = place
    ? `Hello Spires Taxis, I'd like your best quote for a Standard Car journey between Oxford and ${place}. My pickup location is __, destination is __, date is __ and pickup time is __. `
    : "Hello Spires Taxis, I'd like your best quote for a Standard Car journey. My pickup location is __, destination is __, date is __ and pickup time is __. ";
  return `https://wa.me/447776897772?text=${encodeURIComponent(text)}`;
}

function waButton(place) {
  return `<a href="${esc(waHref(place))}" class="btn btn--whatsapp" target="_blank" rel="noopener noreferrer"><span class="wa-label wa-label--full">WhatsApp for Our Best Price</span><span class="wa-label wa-label--short">Get a WhatsApp Quote</span></a>`;
}

function priceCard(name) {
  const price = rangeText(name);
  return `<article class="regional-fare">
          <h3 class="regional-fare__route">Oxford to ${esc(name)} Taxi</h3>
          <p class="regional-fare__label">Standard Car. Indicative one way fare</p>
          <p class="regional-fare__price">${esc(price)}</p>
          <p class="regional-fare__note">Prices shown are indicative for typical pre booked Standard Car journeys between Oxford and ${esc(name)}. Your actual fare depends on your exact pickup and drop off locations, date, time and availability. We will confirm your fixed price before you book.</p>
          <p class="regional-fare__vito">8 Seater — Contact us for a quote</p>
          <p class="regional-fare__best">For our best price, contact us directly on WhatsApp.</p>
          <p class="regional-fare__note">Looking for the best fare for your journey? Send us your pickup location, destination, date and time on WhatsApp, and we'll provide our most competitive quote.</p>
          <div class="btn-group">
            ${waButton(name)}
            <a href="${PHONE_TEL}" class="btn btn--outline">Call ${PHONE_DISPLAY}</a>
          </div>
        </article>`;
}

function faqItems(page) {
  const price = rangeText(page.name);
  return [
    {
      q: `How much is a taxi from ${page.name} to Oxford?`,
      a: `For a typical pre booked Standard Car journey between Oxford and ${page.name}, the indicative one way range is ${price}. That is not a guaranteed fare or a price cap. The confirmed price can be above or below the range, and a journey in the opposite direction is quoted on its own if the operating cost differs.`,
    },
    {
      q: `Can I book an airport transfer from ${page.name}?`,
      a: `Yes. We can quote a pre booked airport transfer from ${page.name} to Heathrow, Gatwick, Luton, Birmingham, Stansted and other airports. There is no published airport fare for this town. Oxford airport prices do not apply. Ask us for a quote from your pickup address.`,
    },
    {
      q: "Do you offer an 8 Seater?",
      a: "Yes. A Mercedes Vito is available for suitable group bookings, subject to availability. Regional 8 Seater journeys are quoted individually. The Standard Car range on this page does not apply to the 8 Seater.",
    },
    {
      q: "Can I get a fixed quote before booking?",
      a: "Yes. We agree the fare before you travel. Send the pickup, destination, date and time and we will confirm the price before you book.",
    },
    {
      q: "Can I pay by card?",
      a: "Yes. Cash and card are both accepted. If you have not decided yet, say so when you enquire and we will confirm the payment method with the fare.",
    },
    {
      q: "How far in advance should I book?",
      a: "Earlier is better for early morning pickups, airport journeys and busy dates. A booking is only confirmed once we have agreed the fare and accepted the job. We do not keep cars stationed in every town.",
    },
  ];
}

function jsonLd(page) {
  const faqs = faqItems(page);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
          { "@type": "ListItem", position: 2, name: "Rates", item: `${BASE}/rates` },
          {
            "@type": "ListItem",
            position: 3,
            name: page.name,
            item: `${BASE}/${page.slug}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "Service",
        name: `${page.name} taxi and airport transfers`,
        serviceType: "Pre booked private hire",
        provider: { "@id": `${BASE}/#taxiservice` },
        areaServed: { "@type": "Place", name: page.name },
        description: `Pre booked private hire serving ${page.name} from our Oxford base. Indicative Standard Car ranges are a guide only and the fare is confirmed before booking.`,
      },
      {
        "@type": "TaxiService",
        "@id": `${BASE}/#taxiservice`,
        name: "Spires Taxis",
        url: BASE,
        telephone: "+447776897772",
        areaServed: "Oxfordshire",
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function renderPage(page) {
  const faqs = faqItems(page);
  const seo = SEO_BY_FILE[`${page.slug}.html`];
  if (!seo) throw new Error(`Missing SEO copy for ${page.slug}`);
  const title = esc(seo.title);
  const description = seo.description;
  const canonical = `${BASE}/${page.slug}`;
  const nearbyHtml = page.nearby.length
    ? `<h3>Nearby places</h3>
        <ul class="region-nearby">
          ${page.nearby
            .map(
              (place) => `<li><strong>${esc(place.name)}</strong>. Standard Car indicative one way fare ${esc(rangeText(place.name))}. ${esc(place.note)} <a href="${esc(waHref(place.name))}" target="_blank" rel="noopener noreferrer">WhatsApp for our best price</a>.</li>`
            )
            .join("\n          ")}
        </ul>`
    : "";
  const airportLink = page.airportHref
    ? `<p>Airport transfers from ${esc(page.name)} already have their own page: <a href="${esc(page.airportHref)}">${esc(page.name)} airport transfers</a>. That page does not publish a town to airport fare. Ask for a quote.</p>`
    : `<p>There is no separate published airport price list for ${esc(page.name)}. Use the quote options below, or see <a href="/airport-transfers">airport transfers from Oxford</a> for how Oxford fares work. Those Oxford fares do not apply here.</p>`;
  const header = fs.readFileSync(path.join(root, "includes", "header.html"), "utf8");
  let footer = fs.readFileSync(path.join(root, "includes", "footer.html"), "utf8");
  footer = footer.replace(
    "https://wa.me/447776897772?text=Hi%20Spires%20Taxis%2C%20I%27d%20like%20a%20quote%20please",
    waHref(page.name)
  );

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RSE4NNBP64"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-RSE4NNBP64');
</script>
<link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/spireslogo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0c2340">
  <meta property="og:site_name" content="Spires Taxis">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <title>${title}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${BASE}/android-chrome-512x512.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta name="twitter:image" content="${BASE}/android-chrome-512x512.png">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <script type="application/ld+json">
  ${jsonLd(page)}
  </script>
</head>
<body data-page="local">

<!-- SITE-HEADER -->
${header}
<!-- /SITE-HEADER -->

<main id="main-content">
  <section class="hero hero--compact">
    <div class="container hero__inner fade-in">
      <p class="region-crumbs"><a href="/">Home</a> / <a href="/rates#regional-fares">Oxfordshire rates</a> / ${esc(page.name)}</p>
      <h1>${esc(page.name)} Taxi &amp; Airport Transfers</h1>
      <p class="hero__lead">Spires Taxis is an Oxford private hire operator. We provide pre booked journeys serving ${esc(page.name)}. The fare is agreed before you travel. We do not keep a taxi rank or a permanently stationed driver in ${esc(page.name)}.</p>
      <div class="btn-group">
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">Book online</a>
        ${waButton(page.name)}
        <a href="${PHONE_TEL}" class="btn btn--outline">Call now</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container split">
      <div class="prose fade-in">
        <h2>Taxi transfers between ${esc(page.name)} and Oxford</h2>
        ${page.journey.map((p) => `<p>${esc(p)}</p>`).join("\n        ")}
        <p>${esc(page.minutes)}</p>
        ${nearbyHtml}
      </div>
      <div class="fade-in">
        <h2>Indicative Standard Car prices</h2>
        ${priceCard(page.name)}
      </div>
    </div>
  </section>

  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in">
        <h2>8 Seater transfers</h2>
        <p>For groups, a Mercedes Vito can carry up to eight passengers, subject to availability and luggage. Regional 8 Seater prices are not taken from the Standard Car range.</p>
      </div>
      <p class="fade-in"><strong>8 Seater — Contact us for a quote.</strong> Tell us how many passengers and how much luggage you have.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section__header fade-in">
        <h2>Airport transfers from ${esc(page.name)}</h2>
        <p>We can collect in ${esc(page.name)} for Heathrow, Gatwick, Luton, Birmingham and Stansted, and for other airports when the journey suits. These are quoted from your pickup address. We do not publish a ${esc(page.name)} airport fare on this page.</p>
      </div>
      <div class="prose fade-in">
        ${airportLink}
        <p>See <a href="/airport-transfers">airport transfers</a>, <a href="/oxford-to-heathrow-taxi">Oxford to Heathrow</a>, <a href="/oxford-to-gatwick-taxi">Oxford to Gatwick</a>, <a href="/oxford-to-luton-taxi">Oxford to Luton</a>, <a href="/oxford-to-stansted-taxi">Oxford to Stansted</a> and <a href="/oxford-to-birmingham-airport-taxi">Oxford to Birmingham Airport</a>. Published prices on those pages are for Oxford, not for ${esc(page.name)}.</p>
      </div>
    </div>
  </section>

  <section class="section section--soft">
    <div class="container">
      <div class="section__header fade-in">
        <h2>Why choose Spires Taxis</h2>
      </div>
      <ul class="included-list fade-in">
        <li>Pre booked private hire, arranged before the day of travel</li>
        <li>Fixed fare agreed before you book</li>
        <li>Standard Car and 8 Seater options</li>
        <li>Airport and longer journeys quoted from your address</li>
        <li>Direct contact with the operator by phone or WhatsApp</li>
        <li>Cash and card payment options</li>
        <li>Online booking as well as a WhatsApp quote</li>
      </ul>
      <p class="fade-in" style="margin-top:1rem;">Nearby: ${page.links
        .map((link) => `<a href="${esc(link[0])}">${esc(link[1])}</a>`)
        .join(" · ")}. Full ranges are on <a href="/rates#regional-fares">Oxfordshire rates</a>.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section__header fade-in">
        <h2>Questions about ${esc(page.name)}</h2>
      </div>
      <div class="faq fade-in">
        ${faqs
          .map(
            (item) => `<details>
          <summary>${esc(item.q)}</summary>
          <p>${esc(item.a)}</p>
        </details>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="section section--blue">
    <div class="container" style="text-align:center;max-width:36rem;margin-inline:auto;">
      <h2 class="fade-in">Book or request a quote</h2>
      <p class="fade-in">Book online, call ${PHONE_DISPLAY}, or WhatsApp the journey details for our most competitive quote.</p>
      <div class="btn-group fade-in" style="justify-content:center;">
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">Book online</a>
        ${waButton(page.name)}
        <a href="${PHONE_TEL}" class="btn btn--outline" style="border-color:rgba(255,255,255,.4);color:#fff;">Call ${PHONE_DISPLAY}</a>
      </div>
    </div>
  </section>
</main>

<!-- SITE-FOOTER -->
${footer}
<!-- /SITE-FOOTER -->

</body>
</html>
`;
}

function regionalTable() {
  const rows = APPROVED_RANGES.map(([name, low, high, href]) => {
    const label = href ? `<a href="${href}">${esc(name)}</a>` : esc(name);
    return `            <tr><td>${label}</td><td>£${low}–£${high}</td><td>Contact us for a quote</td></tr>`;
  }).join("\n");
  return `        <h2>Local Oxford journeys</h2>
        <p>Short journeys inside Oxford are not priced from the regional ranges below. This £8 guide is unchanged.</p>
        <div class="table-scroll">
        <table class="price-table">
          <thead>
            <tr>
              <th>Journey</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Within Oxford</td><td>£8</td></tr>
          </tbody>
        </table>
        </div>
        <h2 id="regional-fares">Oxfordshire indicative Standard Car fares</h2>
        <p>These ranges are for typical pre booked Standard Car journeys between Oxford city centre and the town or village centre. They are not guaranteed fares, minimum prices or a cap. The final fare may be above or below the range. A journey in the opposite direction is quoted separately when the cost is different. Prices inside a town are not all the same.</p>
        <p class="regional-fare__best">For our best price, contact us directly on WhatsApp.</p>
        <p>Looking for the best fare for your journey? Send us your pickup location, destination, date and time on WhatsApp, and we'll provide our most competitive quote.</p>
        <div class="btn-group" style="margin:1rem 0 1.25rem;">
          ${waButton("")}
          <a href="${PHONE_TEL}" class="btn btn--outline">Call ${PHONE_DISPLAY}</a>
          <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">Book online</a>
        </div>
        <div class="table-scroll">
        <table class="price-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Standard Car indicative one way</th>
              <th>8 Seater</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
        </div>
        <p class="price-block__note" style="margin-top:1rem;">Local journeys inside Oxford are not part of this table. The local guide on this page remains £8 and is listed for review. It has not been increased. Hourly hire, day hire and airport fares are priced separately.</p>`;
}

function patchRates() {
  const file = path.join(root, "rates.html");
  let html = fs.readFileSync(file, "utf8");
  const block = `<!-- regional-fare-block -->\n${regionalTable()}\n        <!-- /regional-fare-block -->`;
  if (html.includes("<!-- regional-fare-block -->")) {
    html = html.replace(/<!-- regional-fare-block -->[\s\S]*?<!-- \/regional-fare-block -->/, block);
  } else {
    const start = html.indexOf("<h2>Local and regional fares</h2>");
    const end = html.indexOf('<div class="table-scroll">', start);
    const tableEnd = html.indexOf("</table>", end);
    const closeDiv = html.indexOf("</div>", tableEnd);
    if (start < 0 || end < 0 || closeDiv < 0) {
      throw new Error("Could not find the regional fares block in rates.html");
    }
    html = `${html.slice(0, start)}${block}${html.slice(closeDiv + "</div>".length)}`;
  }
  const airportAt = html.indexOf("Airport prices from Oxford");
  const regionalAt = html.indexOf('id="regional-fares"');
  if (airportAt < 0 || regionalAt < 0 || regionalAt < airportAt) {
    throw new Error("Regional block must stay after the airport price table");
  }
  if (!html.includes("£92 one way") || !html.includes("£120 one way")) {
    throw new Error("Airport fares on the rates page changed");
  }
  fs.writeFileSync(file, html);
}

function assertPages() {
  const problems = [];
  for (const page of REGIONAL_PAGES) {
    const html = fs.readFileSync(path.join(root, `${page.slug}.html`), "utf8");
    const price = rangeText(page.name);
    if (!html.includes(price)) problems.push(`${page.slug} missing ${price}`);
    if (!html.includes("Standard Car")) problems.push(`${page.slug} missing Standard Car`);
    if (!html.includes("8 Seater — Contact us for a quote")) problems.push(`${page.slug} missing 8 Seater wording`);
    if (!html.includes("For our best price, contact us directly on WhatsApp.")) problems.push(`${page.slug} missing WhatsApp line`);
    if (!html.includes("tel:+447776897772")) problems.push(`${page.slug} missing phone`);
    if (!html.includes(`https://www.spires-taxis.com/${page.slug}`)) problems.push(`${page.slug} canonical`);
    if ((html.match(/<h1/g) || []).length !== 1) problems.push(`${page.slug} h1 count`);
    if (page.name === "Banbury" && html.includes("£35")) problems.push("Banbury still mentions £35");
    if (/from £\d/.test(html)) problems.push(`${page.slug} still says from £`);
    if (/8 Seater[^<]{0,40}£\d/.test(html)) problems.push(`${page.slug} has an 8 Seater price`);
    for (const place of page.nearby) {
      if (!html.includes(rangeText(place.name))) problems.push(`${page.slug} missing nearby ${place.name}`);
    }
  }
  const rates = fs.readFileSync(path.join(root, "rates.html"), "utf8");
  for (const [name, low, high] of APPROVED_RANGES) {
    const needle = `${name}</a></td><td>£${low}–£${high}`;
    const plain = `${name}</td><td>£${low}–£${high}`;
    if (!rates.includes(needle) && !rates.includes(plain)) {
      problems.push(`rates missing ${name} £${low}–£${high}`);
    }
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`Wrote ${REGIONAL_PAGES.length} regional pages and updated rates.`);
}

for (const page of REGIONAL_PAGES) {
  fs.writeFileSync(path.join(root, `${page.slug}.html`), renderPage(page));
}
patchRates();
assertPages();
