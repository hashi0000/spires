#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.spires-taxis.com';

const related = `
  <section class="section">
    <div class="container">
      <div class="section__header fade-in">
        <h2>Other airport transfers from Oxford</h2>
        <p>These fares are for Oxford pickups and drop offs. Nearby towns are quoted separately.</p>
      </div>
      <p class="fade-in"><a href="/airport-transfers">Airport transfers hub</a> · <a href="/oxford-to-heathrow-taxi">Oxford to Heathrow</a> · <a href="/heathrow-to-oxford-taxi">Heathrow to Oxford</a> · <a href="/oxford-to-gatwick-taxi">Oxford to Gatwick</a> · <a href="/oxford-to-luton-taxi">Oxford to Luton</a> · <a href="/oxford-to-stansted-taxi">Oxford to Stansted</a> · <a href="/oxford-to-birmingham-airport-taxi">Oxford to Birmingham Airport</a> · <a href="/oxford-to-bristol-airport-taxi">Oxford to Bristol Airport</a> · <a href="/oxford-to-london-city-airport-taxi">Oxford to London City</a> · <a href="/rates">Full rate card</a></p>
    </div>
  </section>`;

function page(p) {
  const faqJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.schema || f.a.replace(/<[^>]+>/g, '') },
    })),
  });
  const faqHtml = p.faqs
    .map(
      (f) => `        <details>
          <summary>${f.q}</summary>
          <p>${f.a}</p>
        </details>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/spireslogo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0c2340">
  <meta property="og:site_name" content="Spires Taxis">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${p.title}">
  <title>${p.title}</title>
  <meta name="description" content="${p.description}">
  <link rel="canonical" href="${BASE}${p.path}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${p.ogTitle || p.title}">
  <meta property="og:description" content="${p.ogDescription}">
  <meta property="og:url" content="${BASE}${p.path}">
  <meta property="og:image" content="${BASE}/android-chrome-512x512.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta name="twitter:image" content="${BASE}/android-chrome-512x512.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <script type="application/ld+json">
  ${faqJson}
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "${BASE}/" },
          { "@type": "ListItem", "position": 2, "name": "Airport transfers", "item": "${BASE}/airport-transfers" },
          { "@type": "ListItem", "position": 3, "name": "${p.crumb}", "item": "${BASE}${p.path}" }
        ]
      },
      {
        "@type": "Service",
        "name": "${p.serviceName}",
        "provider": { "@id": "${BASE}/#taxiservice" },
        "areaServed": { "@type": "City", "name": "Oxford" },
        "offers": {
          "@type": "Offer",
          "price": "${p.oneWay}",
          "priceCurrency": "GBP",
          "description": "Published Oxford Standard Car one way fare. Nearby towns are quoted separately."
        }
      },
      {
        "@type": "TaxiService",
        "@id": "${BASE}/#taxiservice",
        "name": "Spires Taxis",
        "url": "${BASE}",
        "telephone": "+447776897772",
        "parentOrganization": { "@id": "${BASE}/#organization" }
      }
    ]
  }
  </script>
</head>
<body data-page="airport">

<!-- SITE-HEADER -->
<!-- /SITE-HEADER -->

<main id="main-content">
  <section class="hero hero--compact">
    <div class="container hero__inner fade-in">
      <h1>${p.h1}</h1>
      <p class="hero__lead">${p.lead}</p>
      <div class="btn-group">
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">Book online</a>
        <a href="${p.whatsapp}" class="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp for this route</a>
        <a href="tel:+447776897772" class="btn btn--outline">Call now</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container split">
      <div class="prose fade-in">
        <h2>${p.storyH2}</h2>
        ${p.story}
        <div class="callout">
          <p>${p.callout}</p>
        </div>
      </div>
      <div class="fade-in">
        <h2>What is included</h2>
        <ul class="included-list">
          ${p.included.map((item) => `<li>${item}</li>`).join('\n          ')}
        </ul>
        <p style="margin-top:1rem;">Collections back to Oxford use flight monitoring. Full detail: <a href="/how-airport-pickup-works">how airport pickup works</a>.</p>
      </div>
    </div>
  </section>

  <section class="section section--soft">
    <div class="container faq fade-in">
      <h2>${p.faqH2}</h2>
${faqHtml}
    </div>
  </section>
${related}
  <section class="section section--blue">
    <div class="container" style="text-align:center;max-width:32rem;margin-inline:auto;">
      <h2 class="fade-in">${p.cta}</h2>
      <div class="btn-group fade-in" style="justify-content:center;">
        <a href="https://customer.spires-taxis.com" class="btn btn--primary" target="_blank" rel="noopener noreferrer">Book online</a>
        <a href="/contact" class="btn btn--outline" style="border-color:rgba(255,255,255,.4);color:#fff;">Contact</a>
      </div>
    </div>
  </section>
</main>

<!-- SITE-FOOTER -->
<!-- /SITE-FOOTER -->
</body>
</html>
`;
}

const pages = [
  {
    file: 'oxford-to-stansted-taxi.html',
    path: '/oxford-to-stansted-taxi',
    title: 'Oxford to Stansted Taxi | Fixed Price Airport Transfer | Spires Taxis',
    description:
      'Oxford to Stansted Airport taxi. Standard Car £150 one way or £290 return. Fixed fare, flight monitoring on collections. WhatsApp 07776 897772.',
    ogTitle: 'Oxford to Stansted Taxi | Fixed Price Airport Transfer',
    ogDescription: 'Oxford to Stansted £150 one way or £290 return. Fixed fare agreed before travel.',
    crumb: 'Oxford to Stansted',
    serviceName: 'Oxford to Stansted taxi',
    oneWay: '150',
    h1: 'Oxford to Stansted taxi',
    lead: 'Pre booked transfers from Oxford to London Stansted Airport. Standard Car: <strong>£150 one way</strong> or <strong>£290 return</strong> when both journeys are booked together (up to 4 passengers). Airport charges are included.',
    whatsapp:
      'https://wa.me/447776897772?text=Hi%2C%20Oxford%20to%20Stansted%20on%20%5Bdate%5D.%20Pickup%3A%20%5Baddress%5D',
    storyH2: 'Why Stansted is a longer job than Luton',
    story: `<p>Stansted sits north east of London. From Oxford that usually means the M40, then around the north of the M25 onto the M11. It is a longer drive than Luton and more exposed to M25 delays, so we set pickup times from the flight, not from a hopeful average.</p>
        <p>The airport has one main terminal. Send the flight number anyway so we can time a collection and so the driver is not working from a schedule that has already slipped. See <a href="/how-airport-pickup-works">how airport pickup works</a>.</p>`,
    callout:
      '<strong>Standard Car is <span data-spires-price="stansted.standardCar.oneWay">£150</span> one way or <span data-spires-price="stansted.standardCar.return">£290</span> return</strong> for Oxford (up to 4 passengers). 8 Seater is <span data-spires-price="stansted.vito.oneWay">£185</span> one way or <span data-spires-price="stansted.vito.return">£360</span> return. <a href="/rates">Full rate card</a>.',
    included: [
      'Private hire to Stansted Airport',
      'Fixed fare confirmed before travel',
      'Airport charges included',
      'Flight monitoring on return pickups',
      '8 Seater <span data-spires-price="stansted.vito.oneWay">£185</span> one way. See <a href="/rates">rates</a> · <a href="/our-vehicles">vehicles</a>',
    ],
    faqH2: 'Stansted route FAQ',
    faqs: [
      {
        q: 'How much is Oxford to Stansted Airport?',
        a: 'Standard Car is <span data-spires-price="stansted.standardCar.oneWay">£150</span> one way or <span data-spires-price="stansted.standardCar.return">£290</span> return for up to 4 passengers. 8 Seater is <span data-spires-price="stansted.vito.oneWay">£185</span> one way or <span data-spires-price="stansted.vito.return">£360</span> return. Oxford journeys only; nearby towns are quoted separately.',
        schema:
          'Standard Car is £150 one way or £290 return for up to 4 passengers. 8 Seater is £185 one way or £360 return. Oxford journeys only; nearby towns are quoted separately.',
      },
      {
        q: 'How long does Oxford to Stansted take?',
        a: 'Plan for around two hours in normal traffic. The M25 and M11 can add a lot of time on Friday afternoons and Sunday evenings. We work pickup time back from your flight.',
      },
      {
        q: 'Do you collect from Stansted as well as drop off?',
        a: 'Yes. Book the collection with the flight number. We track the actual landing time and include 50 minutes from landing. See <a href="/how-airport-pickup-works">how airport pickup works</a>.',
        schema:
          'Yes. Book the collection with the flight number. We track the actual landing time and include 50 minutes from landing.',
      },
      {
        q: 'Is this the same as a Heathrow transfer?',
        a: 'No. Stansted is a different route, a longer drive, and a different published fare. Heathrow jobs are on the <a href="/oxford-to-heathrow-taxi">Oxford to Heathrow</a> and <a href="/heathrow-to-oxford-taxi">Heathrow to Oxford</a> pages.',
        schema:
          'No. Stansted is a different route, a longer drive, and a different published fare. Heathrow jobs have their own pages.',
      },
    ],
    cta: 'Book Oxford to Stansted',
  },
  {
    file: 'oxford-to-birmingham-airport-taxi.html',
    path: '/oxford-to-birmingham-airport-taxi',
    title: 'Oxford to Birmingham Airport Taxi | Fixed Price | Spires Taxis',
    description:
      'Oxford to Birmingham Airport taxi. Standard Car £110 one way or £215 return. Northbound M40 route, fixed fare. WhatsApp 07776 897772.',
    ogTitle: 'Oxford to Birmingham Airport Taxi | Fixed Price',
    ogDescription: 'Oxford to Birmingham Airport £110 one way or £215 return. Fixed fare agreed before travel.',
    crumb: 'Oxford to Birmingham Airport',
    serviceName: 'Oxford to Birmingham Airport taxi',
    oneWay: '110',
    h1: 'Oxford to Birmingham Airport taxi',
    lead: 'Pre booked transfers from Oxford to Birmingham Airport (BHX). Standard Car: <strong>£110 one way</strong> or <strong>£215 return</strong> when both journeys are booked together (up to 4 passengers). Airport charges are included.',
    whatsapp:
      'https://wa.me/447776897772?text=Hi%2C%20Oxford%20to%20Birmingham%20Airport%20on%20%5Bdate%5D.%20Pickup%3A%20%5Baddress%5D',
    storyH2: 'North on the M40, not around London',
    story: `<p>Birmingham Airport is the published Oxford fare that heads north rather than into the London airport belt. The usual run is the M40 towards the Midlands. That makes it a different job from Heathrow or Gatwick: less M25, more junction timing around Solihull, and a terminal that is used heavily for domestic and short European flights.</p>
        <p>It is still a private hire airport transfer from Oxford. We collect from your address, drop at the terminal, and for the way home we monitor the flight. Nearby towns such as Banbury and Bicester are quoted from the pickup address. Do not assume the Oxford figure applies. See <a href="/airport-transfers">airport transfers from Oxford</a>.</p>`,
    callout:
      '<strong>Standard Car is <span data-spires-price="birmingham.standardCar.oneWay">£110</span> one way or <span data-spires-price="birmingham.standardCar.return">£215</span> return</strong> for Oxford (up to 4 passengers). 8 Seater is <span data-spires-price="birmingham.vito.oneWay">£145</span> one way or <span data-spires-price="birmingham.vito.return">£280</span> return. <a href="/rates">Full rate card</a>.',
    included: [
      'Private hire to Birmingham Airport',
      'Fixed fare confirmed before travel',
      'Airport charges included',
      'Flight monitoring on return pickups',
      '8 Seater <span data-spires-price="birmingham.vito.oneWay">£145</span> one way. See <a href="/rates">rates</a> · <a href="/our-vehicles">vehicles</a>',
    ],
    faqH2: 'Birmingham Airport FAQ',
    faqs: [
      {
        q: 'How much is Oxford to Birmingham Airport?',
        a: 'Standard Car is <span data-spires-price="birmingham.standardCar.oneWay">£110</span> one way or <span data-spires-price="birmingham.standardCar.return">£215</span> return for up to 4 passengers. 8 Seater is <span data-spires-price="birmingham.vito.oneWay">£145</span> one way or <span data-spires-price="birmingham.vito.return">£280</span> return. Oxford journeys only; nearby towns are quoted separately.',
        schema:
          'Standard Car is £110 one way or £215 return for up to 4 passengers. 8 Seater is £145 one way or £280 return. Oxford journeys only; nearby towns are quoted separately.',
      },
      {
        q: 'Is this a taxi into Birmingham city centre?',
        a: 'This page is the airport transfer to Birmingham Airport. A city centre drop in Birmingham is a different journey and is quoted when you book. For other long runs see <a href="/long-distance-taxis">long distance taxis</a>.',
        schema:
          'This page is the airport transfer to Birmingham Airport. A city centre drop in Birmingham is a different journey and is quoted when you book.',
      },
      {
        q: 'How long does the run take?',
        a: 'Typically around 75 to 90 minutes from central Oxford in normal traffic. We allow more for morning peaks on the M40.',
      },
      {
        q: 'Can I book the return from arrivals?',
        a: 'Yes. Send the flight number. Waiting after landing follows the same 50 minute rule as our other airport collections. <a href="/how-airport-pickup-works">How airport pickup works</a>.',
        schema:
          'Yes. Send the flight number. Waiting after landing follows the same 50 minute rule as our other airport collections.',
      },
    ],
    cta: 'Book Oxford to Birmingham Airport',
  },
  {
    file: 'oxford-to-bristol-airport-taxi.html',
    path: '/oxford-to-bristol-airport-taxi',
    title: 'Oxford to Bristol Airport Taxi | Fixed Price | Spires Taxis',
    description:
      'Oxford to Bristol Airport taxi. Standard Car £165 one way or £320 return. Westbound private hire, fixed fare. WhatsApp 07776 897772.',
    ogTitle: 'Oxford to Bristol Airport Taxi | Fixed Price',
    ogDescription: 'Oxford to Bristol Airport £165 one way or £320 return. Fixed fare agreed before travel.',
    crumb: 'Oxford to Bristol Airport',
    serviceName: 'Oxford to Bristol Airport taxi',
    oneWay: '165',
    h1: 'Oxford to Bristol Airport taxi',
    lead: 'Pre booked transfers from Oxford to Bristol Airport. Standard Car: <strong>£165 one way</strong> or <strong>£320 return</strong> when both journeys are booked together (up to 4 passengers). Airport charges are included.',
    whatsapp:
      'https://wa.me/447776897772?text=Hi%2C%20Oxford%20to%20Bristol%20Airport%20on%20%5Bdate%5D.%20Pickup%3A%20%5Baddress%5D',
    storyH2: 'West from Oxford, not the London airports',
    story: `<p>Bristol Airport is the longest of our published Oxford airport fares. The usual routing is west via the A34 and M4, then south to the airport above the city. It is a different direction of travel from Heathrow, Luton or Stansted, and the published price is higher because of that distance.</p>
        <p>Holiday flights and early departures are common on this route. Send the flight time so we can work back to a sensible pickup. For collections we track the landing time in the same way as our other airport work. See <a href="/how-airport-pickup-works">how airport pickup works</a>.</p>`,
    callout:
      '<strong>Standard Car is <span data-spires-price="bristol.standardCar.oneWay">£165</span> one way or <span data-spires-price="bristol.standardCar.return">£320</span> return</strong> for Oxford (up to 4 passengers). 8 Seater is <span data-spires-price="bristol.vito.oneWay">£205</span> one way or <span data-spires-price="bristol.vito.return">£400</span> return. <a href="/rates">Full rate card</a>.',
    included: [
      'Private hire to Bristol Airport',
      'Fixed fare confirmed before travel',
      'Airport charges included',
      'Flight monitoring on return pickups',
      '8 Seater <span data-spires-price="bristol.vito.oneWay">£205</span> one way. See <a href="/rates">rates</a> · <a href="/our-vehicles">vehicles</a>',
    ],
    faqH2: 'Bristol Airport FAQ',
    faqs: [
      {
        q: 'How much is Oxford to Bristol Airport?',
        a: 'Standard Car is <span data-spires-price="bristol.standardCar.oneWay">£165</span> one way or <span data-spires-price="bristol.standardCar.return">£320</span> return for up to 4 passengers. 8 Seater is <span data-spires-price="bristol.vito.oneWay">£205</span> one way or <span data-spires-price="bristol.vito.return">£400</span> return. Oxford journeys only; nearby towns are quoted separately.',
        schema:
          'Standard Car is £165 one way or £320 return for up to 4 passengers. 8 Seater is £205 one way or £400 return. Oxford journeys only; nearby towns are quoted separately.',
      },
      {
        q: 'Do you drop in Bristol city as well?',
        a: 'This page is Bristol Airport. A city centre or Temple Meads drop is quoted separately. Other westbound work is on <a href="/long-distance-taxis">long distance taxis</a>.',
        schema:
          'This page is Bristol Airport. A city centre or Temple Meads drop is quoted separately.',
      },
      {
        q: 'How long should I allow?',
        a: 'Allow around two hours from central Oxford in normal traffic, more if you are travelling at peak times on the M4. We would rather leave earlier than cut it fine for check in.',
      },
      {
        q: 'Are airport charges included?',
        a: 'Yes. Advertised Oxford airport fares include the standard airport pickup or drop off charge. Extra waiting after the 50 minute collection allowance may cost extra.',
      },
    ],
    cta: 'Book Oxford to Bristol Airport',
  },
];

for (const p of pages) {
  fs.writeFileSync(path.join(root, p.file), page(p));
  console.log('Wrote', p.file);
}
