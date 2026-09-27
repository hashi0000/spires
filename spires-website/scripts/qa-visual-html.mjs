#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['email.html', 'nav-snippet.html']);
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !skip.has(f));

const issues = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const h1 = [...html.matchAll(/<h1\b[^>]*>/gi)];
  if (h1.length !== 1) issues.push(`${file}: ${h1.length} H1s`);
  if (html.includes('class="breadcrumbs"')) issues.push(`${file}: visible breadcrumbs class still present`);
  if (html.includes('hero__label')) issues.push(`${file}: hero__label still present`);
  if (html.includes('trust-strip')) issues.push(`${file}: trust-strip still present`);
  if (!html.includes('<title>')) issues.push(`${file}: missing title`);
  if (!html.includes('canonical') && !file.includes('404') && file !== 'booking.html' && !file.includes('services') && !file.includes('destinations') && !file.includes('airport-taxis') && !file.includes('abingdon-taxi.html') && !file.includes('heathrow-airport') && !file.includes('gatwick-airport') && !file.includes('birmingham')) {
    issues.push(`${file}: missing canonical`);
  }
}

if (issues.length) {
  console.log(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK: ${files.length} HTML files, each with one H1; no visible breadcrumbs/labels/trust strips.`);
}
