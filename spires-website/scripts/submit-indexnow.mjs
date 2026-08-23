#!/usr/bin/env node
/**
 * Submit canonical public URLs to IndexNow (Bing, Yandex, and other engines).
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs
 *   node scripts/submit-indexnow.mjs https://www.spires-taxis.com/rates https://www.spires-taxis.com/
 *
 * Key resolution (first match wins):
 *   1. INDEXNOW_KEY environment variable
 *   2. The public key file in this folder (*.txt whose name equals its contents)
 *
 * The verification file MUST stay publicly available at:
 *   https://www.spires-taxis.com/{key}.txt
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const HOST = 'www.spires-taxis.com';
const BASE = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function readKeyFromFile() {
  const txt = fs.readdirSync(root).filter((f) => /^[a-f0-9]{8,128}\.txt$/i.test(f));
  for (const name of txt) {
    const key = path.basename(name, '.txt');
    const body = fs.readFileSync(path.join(root, name), 'utf8').trim();
    if (body === key) return key;
  }
  return null;
}

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const key = (process.env.INDEXNOW_KEY || '').trim() || readKeyFromFile();
if (!key) {
  console.error('No IndexNow key. Set INDEXNOW_KEY or keep the public {key}.txt file in the site root.');
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a.startsWith('http'));
const urlList = args.length ? args : sitemapUrls();

for (const u of urlList) {
  if (!u.startsWith(BASE)) {
    console.error(`Refusing non-canonical URL: ${u}`);
    process.exit(1);
  }
}

const payload = {
  host: HOST,
  key,
  keyLocation: `${BASE}/${key}.txt`,
  urlList,
};

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  console.error(`IndexNow ${res.status}: ${text}`);
  process.exit(1);
}
console.log(`IndexNow accepted ${urlList.length} URL(s) (HTTP ${res.status}).`);
for (const u of urlList) console.log(`  ${u}`);
