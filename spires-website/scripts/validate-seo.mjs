#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.spires-taxis.com';
const SKIP = new Set(['nav-snippet.html']);
const issues = [];

const files = fs
  .readdirSync(root)
  .filter((f) => f.endsWith('.html') && !SKIP.has(f));

const titles = {};
const descs = {};
const canonicals = {};

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  return blocks.map((m, i) => {
    try {
      return JSON.parse(m[1]);
    } catch (err) {
      issues.push(`Invalid JSON-LD block ${i + 1}: ${err.message}`);
      return null;
    }
  }).filter(Boolean);
}

for (const f of files) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const isStub = /http-equiv="refresh"/i.test(html) && /noindex/i.test(html);
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

  if (isStub || noindex) continue;

  const t = html.match(/<title>([^<]*)<\/title>/i)?.[1];
  const d = html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
  const c = html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1];
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );

  if (!t) issues.push(`${f}: missing title`);
  if (t && titles[t]) issues.push(`duplicate title "${t}" (${f}, ${titles[t]})`);
  if (t) titles[t] = f;

  if (!d) issues.push(`${f}: missing description`);
  if (d && descs[d]) issues.push(`duplicate description (${f}, ${descs[d]})`);
  if (d) descs[d] = f;

  if (!c) issues.push(`${f}: missing canonical`);
  if (c && !c.startsWith(BASE)) issues.push(`${f}: canonical not on ${BASE}`);
  if (c && canonicals[c]) issues.push(`duplicate canonical ${c} (${f}, ${canonicals[c]})`);
  if (c) canonicals[c] = f;

  if (h1s.length !== 1) issues.push(`${f}: ${h1s.length} H1 tags`);

  if (!/property="og:title"/.test(html)) issues.push(`${f}: missing og:title`);
  if (!/property="og:description"/.test(html)) issues.push(`${f}: missing og:description`);
  if (!/property="og:url"/.test(html)) issues.push(`${f}: missing og:url`);
  if (!/property="og:image"/.test(html)) issues.push(`${f}: missing og:image`);
  if (/og:image" content="[^"]+\.svg"/i.test(html)) {
    issues.push(`${f}: og:image is SVG (poor social/crawler support)`);
  }
  if (/spires-logo-email\.png/.test(html)) {
    issues.push(`${f}: references missing spires-logo-email.png`);
  }

    if (/"@id"\s*:\s*"[^"]+"\s*,\s*"@id"\s*:/.test(html)) {
      issues.push(`${f}: duplicate @id property in JSON-LD`);
    }
    extractJsonLd(html);
}

const forbidden = [
  ['Valid until Dec 31st 2025', /Valid until Dec 31st 2025/i],
  ['From £85', /From £85/],
  ['From £87', /From £87/],
  ['Admin Panel', /Admin Panel/],
  ['Oxford’s Newest Premium Taxi Service', /Newest Premium Taxi Service/i],
  ['PayPal', /PayPal/i],
];

for (const f of files) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  for (const [label, re] of forbidden) {
    if (re.test(html)) issues.push(`${f}: contains forbidden phrase "${label}"`);
  }
  if (/31 December 2025/.test(html) && f === 'offer-terms.html') {
    issues.push(`${f}: still lists 31 December 2025 offer end date`);
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
if (sitemap.includes('<changefreq>') || sitemap.includes('<priority>')) {
  issues.push('sitemap.xml includes invented changefreq/priority');
}
if (!sitemap.includes('<lastmod>')) issues.push('sitemap.xml missing lastmod');

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${BASE}/sitemap.xml`)) {
  issues.push('robots.txt missing sitemap declaration');
}
if (/Disallow:\s*\/css/i.test(robots) || /Disallow:\s*\/js/i.test(robots)) {
  issues.push('robots.txt blocks CSS or JS');
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('OK: unique titles/descriptions, single H1, valid JSON-LD, sitemap, robots');
