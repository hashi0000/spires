#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'index.html',
  'rates.html',
  'airport-transfers.html',
  'oxford-to-heathrow-taxi.html',
  'how-airport-pickup-works.html',
  'our-vehicles.html',
  'student-taxis.html',
  'reviews.html',
  'about.html',
  'contact.html',
  'abingdon-taxis.html',
];

for (const f of pages) {
  const h = fs.readFileSync(path.join(root, f), 'utf8');
  const t = h.match(/<title>([^<]+)/)?.[1];
  const d = h.match(/name="description" content="([^"]+)/)?.[1];
  const c = h.match(/rel="canonical" href="([^"]+)/)?.[1];
  const r = h.match(/name="robots" content="([^"]+)/)?.[1];
  const h1 = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim();
  const og = h.match(/property="og:image" content="([^"]+)/)?.[1];
  console.log('---', f);
  console.log('TITLE', t);
  console.log('DESC', d);
  console.log('CANON', c);
  console.log('ROBOTS', r);
  console.log('H1', h1);
  console.log('OG', og);
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const [i, m] of blocks.entries()) {
    JSON.parse(m[1]);
    console.log('JSON-LD', i + 1, 'ok');
  }
}
