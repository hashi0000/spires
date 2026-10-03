#!/usr/bin/env node
/**
 * Build sitemap.xml from public, indexable HTML pages.
 * lastmod comes from each file's mtime (UTC, YYYY-MM-DD).
 * No changefreq or priority — those were being invented.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = 'https://www.spires-taxis.com';

const SKIP_FILES = new Set([
  'nav-snippet.html',
  'booking.html',
  'email.html',
  'thank-you.html',
  'student-offers.html',
  '404.html',
  'offer-terms.html',
  'terms-and-conditions.html',
  'share-terms.html',
]);

function isRedirectStub(html) {
  return (
    /http-equiv="refresh"/i.test(html) &&
    /noindex/i.test(html)
  );
}

function isIndexable(html) {
  if (isRedirectStub(html)) return false;
  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  if (robots && /noindex/i.test(robots[1])) return false;
  return /<link\s+rel="canonical"/i.test(html);
}

function canonicalPath(html, file) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  if (!m) return file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`;
  const href = m[1].trim();
  if (!href.startsWith(BASE)) {
    throw new Error(`${file}: canonical is not on ${BASE}: ${href}`);
  }
  const url = new URL(href);
  return url.pathname || '/';
}

function lastmod(filePath) {
  const d = fs.statSync(filePath).mtime;
  return d.toISOString().slice(0, 10);
}

function listPublicHtml() {
  const files = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.html') && !SKIP_FILES.has(f));
  const shareDir = path.join(root, 'share');
  if (fs.existsSync(shareDir) && fs.statSync(shareDir).isDirectory()) {
    for (const f of fs.readdirSync(shareDir)) {
      if (f.endsWith('.html') && !SKIP_FILES.has(f)) files.push(path.join('share', f));
    }
  }
  return files;
}

const files = listPublicHtml();

const entries = [];
for (const file of files) {
  const filePath = path.join(root, file);
  const html = fs.readFileSync(filePath, 'utf8');
  if (!isIndexable(html)) continue;
  const locPath = canonicalPath(html, file);
  if (
    locPath.includes('/admin') ||
    locPath.includes('/login') ||
    locPath === '/share-terms' ||
    locPath.includes('spires-share')
  ) continue;
  entries.push({
    loc: `${BASE}${locPath === '/' ? '/' : locPath}`,
    lastmod: lastmod(filePath),
    file,
  });
}

entries.sort((a, b) => {
  if (a.loc === `${BASE}/`) return -1;
  if (b.loc === `${BASE}/`) return 1;
  return a.loc.localeCompare(b.loc);
});

const seen = new Set();
for (const e of entries) {
  if (seen.has(e.loc)) throw new Error(`Duplicate sitemap URL ${e.loc}`);
  seen.add(e.loc);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
  )
  .join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log(`Wrote sitemap.xml with ${entries.length} URLs`);
for (const e of entries) console.log(`  ${e.lastmod}  ${e.loc}`);
