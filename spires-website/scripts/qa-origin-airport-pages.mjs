import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.spires-taxis.com';
const origin = [
  'witney-airport-transfers.html',
  'wallingford-airport-transfers.html',
  'wantage-airport-transfers.html',
  'carterton-airport-transfers.html',
  'didcot-airport-transfers.html',
  'abingdon-airport-transfers.html',
  'bicester-airport-transfers.html',
  'thame-airport-transfers.html',
];
const pagesToCheck = [
  ...origin,
  'airport-transfers.html',
  'index.html',
  'oxford-to-heathrow-taxi.html',
  'heathrow-to-oxford-taxi.html',
  'oxford-to-gatwick-taxi.html',
  'oxford-to-stansted-taxi.html',
  'oxford-to-birmingham-airport-taxi.html',
  'oxford-to-bristol-airport-taxi.html',
  'abingdon-taxis.html',
  'bicester-taxis.html',
  'contact.html',
];
const issues = [];

function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const allHtml = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const h1s = {};
for (const f of allHtml) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
  if (h1[0]) {
    if (h1s[h1[0]]) issues.push(`duplicate H1 "${h1[0]}" (${f}, ${h1s[h1[0]]})`);
    h1s[h1[0]] = f;
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

for (const f of origin) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const slug = f.replace(/\.html$/, '');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const robots = html.match(/<meta name="robots" content="([^"]+)"/i)?.[1] || '';
  const ogurl = html.match(/property="og:url" content="([^"]+)"/)?.[1];
  if (!canonical) issues.push(`${f}: missing canonical`);
  if (canonical !== `${BASE}/${slug}`) issues.push(`${f}: canonical mismatch ${canonical}`);
  if (ogurl !== canonical) issues.push(`${f}: og:url != canonical`);
  if (/noindex/i.test(robots)) issues.push(`${f}: accidental noindex`);
  if (!sitemap.includes(canonical)) issues.push(`${f}: missing from sitemap`);
  if (!html.includes('site-header')) issues.push(`${f}: chrome header missing`);
  if (!html.includes('site-footer')) issues.push(`${f}: chrome footer missing`);
  if (!html.includes('Airport transfers across Oxfordshire')) {
    issues.push(`${f}: footer oxfordshire link missing`);
  }

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(
    (m) => JSON.parse(m[1])
  );
  const flat = [];
  for (const b of blocks) {
    if (b['@graph']) flat.push(...b['@graph']);
    else flat.push(b);
  }
  const types = flat.map((x) => x['@type']);
  if (!types.includes('FAQPage')) issues.push(`${f}: missing FAQPage`);
  if (!types.includes('Service')) issues.push(`${f}: missing Service`);
  if (!types.includes('TaxiService')) issues.push(`${f}: missing TaxiService`);
  if (!types.includes('BreadcrumbList')) issues.push(`${f}: missing BreadcrumbList`);
  if (types.includes('LocalBusiness')) issues.push(`${f}: unexpected LocalBusiness`);
  const service = flat.find((x) => x['@type'] === 'Service');
  if (service?.offers) issues.push(`${f}: Service should not have Offer prices`);
  const taxi = flat.find((x) => x['@type'] === 'TaxiService');
  if (taxi?.address?.addressLocality && taxi.address.addressLocality !== 'Oxford') {
    issues.push(`${f}: TaxiService address not Oxford`);
  }
  if (taxi?.['@id'] !== `${BASE}/#taxiservice`) issues.push(`${f}: TaxiService @id wrong`);

  const faq = flat.find((x) => x['@type'] === 'FAQPage');
  const summaries = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
  const qnames = (faq?.mainEntity || []).map((q) => q.name);
  if (summaries.join('|') !== qnames.join('|')) {
    issues.push(`${f}: FAQ schema questions do not match visible summaries`);
  }

  const main = (html.split('<main')[1]?.split('</main>')[0] || '').replace(/^[^>]*>/, '');
  const text = stripTags(main);
  const hyphens = text.match(/\b[A-Za-z]+-[a-z]+\b/g) || [];
  const allowed = new Set(['check-in']);
  const bad = [...new Set(hyphens.filter((w) => !allowed.has(w.toLowerCase())))];
  if (bad.length) issues.push(`${f}: hyphenated copy: ${bad.join(', ')}`);

  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith('/api/') || href === '/share' || href.startsWith('/share/')) continue;
    if (/\.(svg|png|jpg|jpeg|css|js|xml|webmanifest|ico)$/i.test(href)) continue;
    const dest = href.replace(/^\//, '').replace(/\/$/, '') || 'index';
    const file = dest === 'index' ? 'index.html' : `${dest}.html`;
    if (!fs.existsSync(path.join(root, file))) issues.push(`${f}: broken link ${href}`);
  }
}

for (const f of pagesToCheck) {
  if (origin.includes(f)) continue;
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith('/api/') || href === '/share' || href.startsWith('/share/')) continue;
    if (/\.(svg|png|jpg|jpeg|css|js|xml|webmanifest|ico)$/i.test(href)) continue;
    const dest = href.replace(/^\//, '').replace(/\/$/, '') || 'index';
    const file = dest === 'index' ? 'index.html' : `${dest}.html`;
    if (!fs.existsSync(path.join(root, file))) issues.push(`${f}: broken link ${href}`);
  }
}

const hub = fs.readFileSync(path.join(root, 'airport-transfers.html'), 'utf8');
if (!hub.includes('id="areas-we-serve"')) issues.push('airport-transfers missing areas-we-serve id');
for (const f of origin) {
  const slug = f.replace('.html', '');
  if (!hub.includes(`/${slug}`)) issues.push(`airport-transfers missing link to /${slug}`);
}

function shingles(text) {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i < words.length - 2; i++) s.add(words.slice(i, i + 3).join(' '));
  return s;
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}
const mains = origin.map((f) => [
  f,
  shingles(
    stripTags(
      (fs.readFileSync(path.join(root, f), 'utf8').split('<main')[1] || '').split('</main>')[0] || ''
    )
  ),
]);
for (let i = 0; i < mains.length; i++) {
  for (let j = i + 1; j < mains.length; j++) {
    const sim = jaccard(mains[i][1], mains[j][1]);
    if (sim > 0.55) {
      issues.push(`high duplicate content ${mains[i][0]} vs ${mains[j][0]} (${sim.toFixed(2)})`);
    }
  }
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('QA OK: 8 origin pages, unique H1s, schema, sitemap, links, content variation');
