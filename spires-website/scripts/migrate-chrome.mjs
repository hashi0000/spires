#!/usr/bin/env node
/**
 * Attach new site chrome to legacy HTML pages (header/footer + fonts).
 * Skips: login, email, thank-you, nav-snippet, pages already with SITE-HEADER.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const skip = new Set(['login.html', 'email.html', 'thank-you.html', 'nav-snippet.html']);
const header = fs.readFileSync(path.join(root, 'includes', 'header.html'), 'utf8').trim();
const footer = fs.readFileSync(path.join(root, 'includes', 'footer.html'), 'utf8').trim();
const fontLink =
  '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">';

const headerBlock = `<!-- SITE-HEADER -->\n${header}\n<!-- /SITE-HEADER -->`;
const footerBlock = `<!-- SITE-FOOTER -->\n${footer}\n<!-- /SITE-FOOTER -->`;

const stripOldChrome = (html) => {
  let out = html;
  out = out.replace(/<div class="promo-banner[\s\S]*?<\/div>\s*/gi, '');
  out = out.replace(/<div class="student-banner[\s\S]*?<\/div>\s*/gi, '');
  out = out.replace(/<!-- Header[\s\S]*?<!-- \/Header -->/gi, '');
  out = out.replace(/<header[\s\S]*?<\/header>\s*/i, '');
  out = out.replace(/<div class="mobile-nav-overlay"><\/div>\s*/gi, '');
  out = out.replace(/<div class="mobile-nav-panel">[\s\S]*?<\/div>\s*(?=<)/gi, '');
  out = out.replace(/<footer[\s\S]*?<\/footer>\s*/i, '');
  out = out.replace(/<a[^>]*class="whatsapp-float"[\s\S]*?<\/a>\s*/gi, '');
  out = out.replace(/<script[^>]*src="[^"]*navigation\.js"[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>\s*/gi, '');
  return out;
};

const pageMap = {
  'services.html': 'airport',
  'destinations.html': 'airport',
  'reviews.html': 'about',
  'booking.html': 'contact',
  'oxford-to-heathrow-taxi.html': 'airport',
  'heathrow-to-oxford-taxi.html': 'airport',
  'oxford-to-gatwick-taxi.html': 'airport',
  'oxford-to-luton-taxi.html': 'airport',
};

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
  if (skip.has(file)) continue;
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes('<!-- SITE-HEADER -->')) continue;

  html = stripOldChrome(html);
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=[^"]+" rel="stylesheet">\s*/gi, '');
  if (!html.includes('DM+Sans')) {
    html = html.replace(/<link rel="stylesheet" href="[^"]*style\.css">\s*/i, (m) => fontLink + '\n  ' + m);
  }
  html = html.replace(/css\/style\.css/g, '/css/style.css');
  html = html.replace(/\.\/images\//g, '/images/');
  html = html.replace(/js\/main\.js/g, '/js/main.js');

  const dataPage = pageMap[file] || file.replace('.html', '').replace(/-/g, '_');
  html = html.replace(/<body([^>]*)>/i, `<body$1 data-page="${dataPage}">`);

  html = html.replace(/<body[^>]*>/i, (m) => `${m}\n\n<div class="notice no-print">\n  £5 off return airport bookings when you book both legs online. <a href="/offer-terms">Offer terms</a> · until 31 Dec 2026\n</div>\n\n${headerBlock}\n`);

  html = html.replace(/<\/body>/i, `\n${footerBlock}\n\n</body>`);

  fs.writeFileSync(fp, html);
  console.log('Migrated', file);
}

console.log('Migration complete.');
