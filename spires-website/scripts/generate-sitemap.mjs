#!/usr/bin/env node
/**
 * Build sitemap.xml from public, indexable HTML pages.
 * lastmod comes from the file's last git commit date when available,
 * otherwise the filesystem mtime. No changefreq or priority.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { LANG_CLUSTERS } from './lib/i18n-clusters.mjs';

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
  'office-jobs.html',
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
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', filePath], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (dirty) return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', filePath], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch {
    /* untracked or git unavailable */
  }
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function ownPath(file) {
  const posix = file.replace(/\\/g, '/');
  if (posix === 'index.html') return '/';
  const noExt = posix.replace(/\.html$/, '');
  if (noExt.endsWith('/index')) return '/' + noExt.slice(0, -'/index'.length);
  return '/' + noExt;
}

function loadRedirectSources() {
  try {
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    return new Set(
      (vercel.redirects || [])
        .filter((r) => !String(r.source).includes(':') && r.statusCode !== 404)
        .map((r) => r.source)
    );
  } catch {
    return new Set();
  }
}

function listPublicHtml() {
  const files = [];
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'scripts', 'includes', 'api'].includes(name.name)) continue;
      const rel = prefix ? `${prefix}/${name.name}` : name.name;
      if (name.isDirectory()) walk(path.join(dir, name.name), rel);
      else if (name.name.endsWith('.html') && !SKIP_FILES.has(name.name) && !SKIP_FILES.has(rel)) {
        files.push(rel);
      }
    }
  }
  walk(root);
  return files;
}

const files = listPublicHtml();
const redirectSources = loadRedirectSources();

const entries = [];
for (const file of files) {
  const filePath = path.join(root, file);
  const html = fs.readFileSync(filePath, 'utf8');
  if (!isIndexable(html)) continue;
  const locPath = canonicalPath(html, file);
  const selfPath = ownPath(file);
  if (redirectSources.has(selfPath)) continue;
  if (locPath !== selfPath) continue;
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

function clusterFor(locPath) {
  return LANG_CLUSTERS.find((cluster) => Object.values(cluster).includes(locPath)) || null;
}

function xhtmlLinks(cluster) {
  const defaultHref = `${BASE}${cluster['en-GB']}`;
  return [
    ...Object.entries(cluster).map(
      ([lang, p]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE}${p}"/>`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultHref}"/>`,
  ].join('\n');
}

function urlXml(entry) {
  const locPath = entry.loc.replace(BASE, '') || '/';
  const cluster = clusterFor(locPath);
  const links = cluster ? `\n${xhtmlLinks(cluster)}` : '';
  return `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>${links}\n  </url>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(urlXml).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log(`Wrote sitemap.xml with ${entries.length} URLs`);
for (const e of entries) console.log(`  ${e.lastmod}  ${e.loc}`);
