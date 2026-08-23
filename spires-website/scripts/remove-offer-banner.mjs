#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const noticeRe =
  /\n?<div class="notice no-print">\s*£5 off return airport bookings when you book both legs online\. <a href="\/offer-terms">Offer terms<\/a> · until 31 Dec 2026\s*<\/div>\n?/g;

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  const next = html.replace(noticeRe, '\n');
  if (next !== html) {
    fs.writeFileSync(fp, next);
    console.log('removed banner', file);
  }
}
