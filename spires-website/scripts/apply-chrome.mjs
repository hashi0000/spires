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

function listHtml(dir, prefix = '') {
  const names = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const name of names) {
    if (name.name.startsWith('nav-') || name.name === 'node_modules' || name.name === 'scripts' || name.name === 'includes') continue;
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) files.push(...listHtml(full, rel));
    else if (name.name.endsWith('.html')) files.push(rel);
  }
  return files;
}

const files = listHtml(root);

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
