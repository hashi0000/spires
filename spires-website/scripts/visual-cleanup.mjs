#!/usr/bin/env node
/**
 * Strip visible breadcrumbs, repeating hero labels and template trust strips
 * from public HTML. JSON-LD BreadcrumbList is left untouched.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['email.html', 'nav-snippet.html']);

const h1s = {
  'how-airport-pickup-works.html': ['How airport pickup works with Spires Taxis', 'How airport pickup works'],
  'airport-transfers.html': ['Airport transfers from Oxford with fixed pricing', 'Airport transfers from Oxford'],
  'oxford-to-heathrow-taxi.html': ['Oxford to Heathrow Taxi', 'Oxford to Heathrow taxi'],
  'our-vehicles.html': ['Vehicles for Oxford airport runs and local jobs', 'Vehicles for Oxford airport runs'],
  'abingdon-taxis.html': ['Abingdon taxis: Oxford to Abingdon from £20', 'Oxford to Abingdon taxi from £20'],
  'bicester-taxis.html': ['Bicester taxis: Oxford to Bicester from £35', 'Oxford to Bicester taxi from £35'],
};

const files = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !skip.has(f));
let changed = 0;

for (const file of files) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  const original = html;

  html = html.replace(/\s*<nav class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/g, '');
  html = html.replace(/\s*<p class="hero__label">[\s\S]*?<\/p>/g, '');
  html = html.replace(/\s*<div class="container">\s*<div class="trust-strip fade-in">[\s\S]*?<\/div>\s*<\/div>/g, '');
  html = html.replace(/\s*<div class="container"><div class="trust-strip fade-in">[\s\S]*?<\/div><\/div>/g, '');
  html = html.replace(/\s*<div class="trust-strip fade-in">[\s\S]*?<\/div>/g, '');

  html = html.replace(/class="container" style="max-width:42rem;"/g, 'class="container container--narrow"');
  html = html.replace(/class="container" style="max-width:40rem;"/g, 'class="container container--narrow"');

  const pair = h1s[file];
  if (pair) html = html.replace(`<h1>${pair[0]}</h1>`, `<h1>${pair[1]}</h1>`);

  if (html !== original) {
    fs.writeFileSync(fp, html);
    console.log('cleaned', file);
    changed++;
  }
}

console.log(`Done. ${changed} file(s) updated.`);
