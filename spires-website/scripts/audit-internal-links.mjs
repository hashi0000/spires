#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const redirectMap = new Map(
  (vercel.redirects || [])
    .filter((r) => !String(r.source).includes(':'))
    .map((r) => [r.source, { to: r.destination, status: r.statusCode }])
);

function listHtml(dir, prefix = '') {
  const names = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const name of names) {
    if (['node_modules', 'scripts', 'includes', 'api'].includes(name.name)) continue;
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) files.push(...listHtml(path.join(dir, name.name), rel));
    else if (name.name.endsWith('.html')) files.push(rel);
  }
  return files;
}

function urlFor(file) {
  const posix = file.replace(/\\/g, '/');
  if (posix === 'index.html') return '/';
  return '/' + posix.replace(/\.html$/, '');
}

const files = listHtml(root);
const exists = new Set(files.map(urlFor));
exists.add('/');

const incoming = new Map();
const broken = [];
const toRedirect = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const noindex = /noindex/i.test((html.match(/name="robots" content="([^"]+)"/i) || [])[1] || '');
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (/\.(svg|png|jpg|jpeg|css|js|xml|webmanifest|ico)$/i.test(href)) continue;
    if (href.startsWith('/api/')) continue;
    incoming.set(href, (incoming.get(href) || 0) + 1);
    const redir = redirectMap.get(href);
    if (redir) {
      toRedirect.push(`${file} -> ${href} (${redir.status} ${redir.to})`);
      continue;
    }
    if (!exists.has(href) && href !== '/share' && !href.startsWith('/share/')) {
      const destFile = href === '/' ? 'index.html' : href.replace(/^\//, '') + '.html';
      if (!fs.existsSync(path.join(root, destFile))) broken.push(`${file} -> ${href}`);
    }
  }
  incoming.set(urlFor(file), incoming.get(urlFor(file)) || 0);
}

const indexable = [];
const noindexUrls = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const robots = (html.match(/name="robots" content="([^"]+)"/i) || [])[1] || '';
  const url = urlFor(file);
  if (/noindex/i.test(robots) || (redirectMap.has(url) && redirectMap.get(url).status !== 404)) {
    noindexUrls.push(url);
    continue;
  }
  if (!/<link rel="canonical"/i.test(html)) continue;
  indexable.push(url);
}

const orphans = indexable.filter((u) => u !== '/' && (incoming.get(u) || 0) === 0);

console.log('Broken internal links:');
console.log(broken.length ? broken.join('\n') : '  none');
console.log('\nLinks to redirected URLs:');
console.log(toRedirect.length ? [...new Set(toRedirect)].join('\n') : '  none');
console.log('\nOrphan indexable URLs (no inbound href found):');
console.log(orphans.length ? orphans.join('\n') : '  none');
console.log('\nIndexable count', indexable.length);
console.log('Noindex/redirect file URLs', noindexUrls.length);
