#!/usr/bin/env node
/**
 * SEO audit fixes: redirect stubs, sitemap, robots, shared head meta, internal links.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = 'https://www.spires-taxis.com';
const TODAY = '2026-07-10';

const SEO_BLOCK = `  <link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/spireslogo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0c2340">
  <meta property="og:site_name" content="Spires Taxis">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary">`;

const OG_IMAGE = `${BASE}/images/spireslogo.svg`;

const SITEMAP_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/airport-transfers', priority: '0.9', changefreq: 'monthly' },
  { loc: '/rates', priority: '0.9', changefreq: 'monthly' },
  { loc: '/contact', priority: '0.9', changefreq: 'monthly' },
  { loc: '/about', priority: '0.8', changefreq: 'monthly' },
  { loc: '/reviews', priority: '0.75', changefreq: 'monthly' },
  { loc: '/oxford-to-heathrow-taxi', priority: '0.95', changefreq: 'weekly' },
  { loc: '/heathrow-to-oxford-taxi', priority: '0.95', changefreq: 'weekly' },
  { loc: '/oxford-to-gatwick-taxi', priority: '0.9', changefreq: 'monthly' },
  { loc: '/oxford-to-luton-taxi', priority: '0.85', changefreq: 'monthly' },
  { loc: '/oxford-taxis', priority: '0.85', changefreq: 'monthly' },
  { loc: '/student-taxis', priority: '0.8', changefreq: 'monthly' },
  { loc: '/corporate-taxis', priority: '0.8', changefreq: 'monthly' },
  { loc: '/abingdon-taxis', priority: '0.8', changefreq: 'monthly' },
  { loc: '/bicester-taxis', priority: '0.8', changefreq: 'monthly' },
  { loc: '/banbury-to-oxford-taxi', priority: '0.8', changefreq: 'monthly' },
  { loc: '/offer-terms', priority: '0.5', changefreq: 'yearly' },
  { loc: '/terms-and-conditions', priority: '0.5', changefreq: 'yearly' },
];

const REDIRECT_STUBS = {
  'services.html': { title: 'Services | Spires Taxis', target: '/airport-transfers' },
  'destinations.html': { title: 'Destinations | Spires Taxis', target: '/airport-transfers' },
  'airport-taxis-oxford.html': { title: 'Airport Taxis Oxford | Spires Taxis', target: '/airport-transfers' },
  'abingdon-taxi.html': { title: 'Abingdon Taxi | Spires Taxis', target: '/abingdon-taxis' },
  'heathrow-airport-taxis.html': { title: 'Heathrow Airport Taxi | Spires Taxis', target: '/oxford-to-heathrow-taxi' },
  'gatwick-airport-taxis.html': { title: 'Gatwick Airport Taxi | Spires Taxis', target: '/oxford-to-gatwick-taxi' },
  'birmingham-airport-taxis.html': { title: 'Birmingham Airport Taxi | Spires Taxis', target: '/airport-transfers' },
};

const LINK_REPLACEMENTS = [
  [/href="\/services"/g, 'href="/airport-transfers"'],
  [/href="\/destinations"/g, 'href="/airport-transfers"'],
  [/href="\/heathrow-airport-taxis"/g, 'href="/oxford-to-heathrow-taxi"'],
  [/href="\/gatwick-airport-taxis"/g, 'href="/oxford-to-gatwick-taxi"'],
  [/href="\/birmingham-airport-taxis"/g, 'href="/airport-transfers"'],
  [/href="\/airport-taxis-oxford"/g, 'href="/airport-transfers"'],
  [/href="\/abingdon-taxi"/g, 'href="/abingdon-taxis"'],
];

function redirectStub({ title, target }) {
  const url = `${BASE}${target}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${url}">
  <meta http-equiv="refresh" content="0;url=${url}">
  <link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
</head>
<body>
  <p>This page has moved. <a href="${url}">Continue to ${target.replace(/^\//, '').replace(/-/g, ' ')}</a>.</p>
</body>
</html>
`;
}

function generateSitemap() {
  const urls = SITEMAP_PAGES.map(
    (p) =>
      `  <url><loc>${BASE}${p.loc === '/' ? '/' : p.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function writeRobots() {
  const content = `User-agent: *
Allow: /

Disallow: /pages/
Disallow: /login
Disallow: /admin
Disallow: /booking
Disallow: /email
Disallow: /thank-you
Disallow: /node_modules/

Sitemap: ${BASE}/sitemap.xml
`;
  fs.writeFileSync(path.join(root, 'robots.txt'), content);
}

function writeManifest() {
  const manifest = {
    name: 'Spires Taxis',
    short_name: 'Spires Taxis',
    description: 'Oxford private hire and airport transfers',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0c2340',
    icons: [
      { src: '/images/spireslogo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  fs.writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
}

function injectSeoBlock(html) {
  if (html.includes('rel="manifest" href="/site.webmanifest"')) return html;
  return html.replace(
    /(<meta name="viewport" content="width=device-width, initial-scale=1\.0">)/,
    `$1\n${SEO_BLOCK}`
  );
}

function completeOpenGraph(html, pageUrl, title, description) {
  let out = html;
  if (!out.includes('property="og:image"')) {
    out = out.replace(
      /(<meta name="robots" content="index, follow">)/,
      `$1\n  <meta property="og:image" content="${OG_IMAGE}">`
    );
  }
  if (!out.includes('property="og:type"')) {
    out = out.replace(
      /(<meta name="robots" content="index, follow">)/,
      `$1\n  <meta property="og:type" content="website">`
    );
  }
  if (!out.includes('property="og:title"') && title) {
    out = out.replace(
      /(<meta name="robots" content="index, follow">)/,
      `$1\n  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">`
    );
  }
  if (!out.includes('property="og:description"') && description) {
    out = out.replace(
      /(<meta name="robots" content="index, follow">)/,
      `$1\n  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">`
    );
  }
  if (!out.includes('property="og:url"') && pageUrl) {
    out = out.replace(
      /(<meta name="robots" content="index, follow">)/,
      `$1\n  <meta property="og:url" content="${pageUrl}">`
    );
  }
  if (!out.includes('name="twitter:title"') && title) {
    out = out.replace(
      /(<meta name="twitter:card" content="summary">)/,
      `$1\n  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">`
    );
  }
  return out;
}

function fixInternalLinks(html) {
  let out = html;
  for (const [pattern, replacement] of LINK_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : '';
}

function processHtmlFiles() {
  const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  for (const file of files) {
    if (REDIRECT_STUBS[file]) {
      fs.writeFileSync(path.join(root, file), redirectStub(REDIRECT_STUBS[file]));
      console.log(`stub: ${file}`);
      continue;
    }
    let html = fs.readFileSync(path.join(root, file), 'utf8');
    const before = html;
    html = fixInternalLinks(html);
    if (!html.includes('noindex')) {
      html = injectSeoBlock(html);
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      const title = extractTitle(html);
      const desc = extractMeta(html, 'description');
      if (canonical && html.includes('index, follow')) {
        html = completeOpenGraph(html, canonical, title, desc);
      }
    }
    html = html.replace(/<meta name="keywords"[^>]*>\s*/gi, '');
    html = html.replace(
      /family=DM\+Sans:ital,opsz,wght@[^&]+/g,
      'family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700'
    );
    if (html !== before) {
      fs.writeFileSync(path.join(root, file), html);
      console.log(`updated: ${file}`);
    }
  }
}

// Run
for (const [file, cfg] of Object.entries(REDIRECT_STUBS)) {
  fs.writeFileSync(path.join(root, file), redirectStub(cfg));
  console.log(`stub: ${file}`);
}
processHtmlFiles();
fs.writeFileSync(path.join(root, 'sitemap.xml'), generateSitemap());
writeRobots();
writeManifest();
console.log('sitemap.xml, robots.txt, site.webmanifest updated');
