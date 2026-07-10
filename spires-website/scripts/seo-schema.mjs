#!/usr/bin/env node
/** Add BreadcrumbList + Service schema to route and area pages. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = 'https://www.spires-taxis.com';
const ORG = { '@id': `${BASE}/#organization` };

const PAGES = [
  {
    file: 'oxford-to-heathrow-taxi.html',
    crumbs: ['Home', 'Airport transfers', 'Oxford to Heathrow'],
    paths: ['/', '/airport-transfers', '/oxford-to-heathrow-taxi'],
    service: { name: 'Oxford to Heathrow taxi', price: '87' },
  },
  {
    file: 'heathrow-to-oxford-taxi.html',
    crumbs: ['Home', 'Airport transfers', 'Heathrow to Oxford'],
    paths: ['/', '/airport-transfers', '/heathrow-to-oxford-taxi'],
    service: { name: 'Heathrow to Oxford taxi', price: '87' },
  },
  {
    file: 'oxford-to-gatwick-taxi.html',
    crumbs: ['Home', 'Airport transfers', 'Oxford to Gatwick'],
    paths: ['/', '/airport-transfers', '/oxford-to-gatwick-taxi'],
    service: { name: 'Oxford to Gatwick taxi', price: '130' },
  },
  {
    file: 'oxford-to-luton-taxi.html',
    crumbs: ['Home', 'Airport transfers', 'Oxford to Luton'],
    paths: ['/', '/airport-transfers', '/oxford-to-luton-taxi'],
    service: { name: 'Oxford to Luton taxi', price: '100' },
  },
  {
    file: 'oxford-taxis.html',
    crumbs: ['Home', 'Oxford taxis'],
    paths: ['/', '/oxford-taxis'],
    service: { name: 'Oxford local taxi', price: '8' },
  },
  {
    file: 'student-taxis.html',
    crumbs: ['Home', 'Student taxis'],
    paths: ['/', '/student-taxis'],
    service: { name: 'Oxford student taxi', price: null },
  },
  {
    file: 'corporate-taxis.html',
    crumbs: ['Home', 'Corporate taxis'],
    paths: ['/', '/corporate-taxis'],
    service: { name: 'Oxford corporate taxi', price: null },
  },
  {
    file: 'abingdon-taxis.html',
    crumbs: ['Home', 'Abingdon taxis'],
    paths: ['/', '/abingdon-taxis'],
    service: { name: 'Abingdon taxi', price: '20' },
  },
  {
    file: 'bicester-taxis.html',
    crumbs: ['Home', 'Bicester taxis'],
    paths: ['/', '/bicester-taxis'],
    service: { name: 'Bicester taxi', price: '35' },
  },
  {
    file: 'banbury-to-oxford-taxi.html',
    crumbs: ['Home', 'Banbury to Oxford'],
    paths: ['/', '/banbury-to-oxford-taxi'],
    service: { name: 'Banbury to Oxford taxi', price: '35' },
  },
  {
    file: 'airport-transfers.html',
    crumbs: ['Home', 'Airport transfers'],
    paths: ['/', '/airport-transfers'],
    service: null,
  },
];

function breadcrumb(crumbs, paths) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((name, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${BASE}${paths[i] === '/' ? '/' : paths[i]}`,
    })),
  };
}

function serviceBlock({ name, price }) {
  const block = {
    '@type': 'Service',
    name,
    provider: { '@type': 'TaxiService', name: 'Spires Taxis', telephone: '+447776897772', url: BASE },
    areaServed: { '@type': 'AdministrativeArea', name: 'Oxfordshire' },
  };
  if (price) {
    block.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: 'GBP',
      description: 'Return booking per leg where shown; up to 4 passengers unless stated otherwise.',
    };
  }
  return block;
}

for (const page of PAGES) {
  const filePath = path.join(root, page.file);
  if (!fs.existsSync(filePath)) continue;
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('"@type": "BreadcrumbList"')) continue;

  const graph = [breadcrumb(page.crumbs, page.paths)];
  if (page.service) graph.push(serviceBlock(page.service));
  graph.push({
    '@type': 'TaxiService',
    name: 'Spires Taxis',
    url: BASE,
    telephone: '+447776897772',
    parentOrganization: ORG,
  });

  const extra = `
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}
  </script>`;

  html = html.replace('</head>', `${extra}\n</head>`);
  fs.writeFileSync(filePath, html);
  console.log(`schema: ${page.file}`);
}

// Static pages
const staticSchema = {
  'rates.html': {
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Taxi prices from Oxford',
        url: `${BASE}/rates`,
        isPartOf: { '@id': `${BASE}/#website` },
      },
      breadcrumb(['Home', 'Rates'], ['/', '/rates']),
    ],
  },
  'about.html': {
    '@graph': [
      {
        '@type': 'AboutPage',
        name: 'About Spires Taxis',
        url: `${BASE}/about`,
        isPartOf: { '@id': `${BASE}/#website` },
        about: ORG,
      },
      breadcrumb(['Home', 'About'], ['/', '/about']),
    ],
  },
  'reviews.html': {
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Customer reviews',
        url: `${BASE}/reviews`,
        isPartOf: { '@id': `${BASE}/#website` },
        description: 'Links to verified Spires Taxis reviews on Trustpilot and Google.',
      },
      breadcrumb(['Home', 'Reviews'], ['/', '/reviews']),
    ],
  },
};

for (const [file, data] of Object.entries(staticSchema)) {
  const filePath = path.join(root, file);
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('"@type": "BreadcrumbList"')) continue;
  const block = `
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', ...data }, null, 2)}
  </script>`;
  html = html.replace('</head>', `${block}\n</head>`);
  fs.writeFileSync(filePath, html);
  console.log(`schema: ${file}`);
}

// Contact: merge LocalBusiness with existing FAQ
const contactPath = path.join(root, 'contact.html');
let contact = fs.readFileSync(contactPath, 'utf8');
if (!contact.includes('LocalBusiness')) {
  contact = contact.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": "${BASE}/#localbusiness",
        "name": "Spires Taxis",
        "url": "${BASE}",
        "telephone": "+447776897772",
        "email": "bookings@spires-taxis.com",
        "image": "${BASE}/images/spireslogo.svg",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Oxford",
          "addressRegion": "Oxfordshire",
          "addressCountry": "GB"
        },
        "areaServed": "Oxford and Oxfordshire",
        "openingHoursSpecification": {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          "opens": "00:00",
          "closes": "23:59"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Can I book a taxi on the same day?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes, subject to availability. Calling is usually quickest for same-day travel." }
          },
          {
            "@type": "Question",
            "name": "What areas does Spires Taxis cover?",
            "acceptedAnswer": { "@type": "Answer", "text": "Oxford, Headington, Summertown, Kidlington, Abingdon, Bicester, Witney, Didcot, Woodstock, Banbury and surrounding Oxfordshire." }
          }
        ]
      },
      ${JSON.stringify(breadcrumb(['Home', 'Contact'], ['/', '/contact']))}
    ]
  }
  </script>`
  );
  fs.writeFileSync(contactPath, contact);
  console.log('schema: contact.html');
}
