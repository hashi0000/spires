#!/usr/bin/env node
/**
 * Sync shared header/footer into HTML pages that use SITE-HEADER / SITE-FOOTER markers.
 * Pages without markers are skipped.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const header = fs.readFileSync(path.join(root, 'includes', 'header.html'), 'utf8').trim();
const footer = fs.readFileSync(path.join(root, 'includes', 'footer.html'), 'utf8').trim();

const headerBlock = `<!-- SITE-HEADER -->\n${header}\n<!-- /SITE-HEADER -->`;
const footerBlock = `<!-- SITE-FOOTER -->\n${footer}\n<!-- /SITE-FOOTER -->`;

const files = fs.readdirSync(root).filter((f) => f.endsWith('.html') && !f.startsWith('nav-'));

let updated = 0;
for (const file of files) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  if (!html.includes('<!-- SITE-HEADER -->')) continue;
  const next = html
    .replace(/<!-- SITE-HEADER -->[\s\S]*?<!-- \/SITE-HEADER -->/, headerBlock)
    .replace(/<!-- SITE-FOOTER -->[\s\S]*?<!-- \/SITE-FOOTER -->/, footerBlock);
  if (next !== html) {
    fs.writeFileSync(fp, next);
    console.log('Updated', file);
    updated++;
  }
}
console.log(`Done. ${updated} file(s) updated.`);
