#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'https://www.spires-taxis.com/#taxiservice';

const providerRe =
  /"provider": \{\s*"@type": "TaxiService",\s*"name": "Spires Taxis",\s*"telephone": "\+447776897772",\s*"url": "https:\/\/www\.spires-taxis\.com"\s*\}/g;

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  const before = html;
  html = html.replace(providerRe, `"provider": { "@id": "${ID}" }`);
  html = html.replace(
    /"@type": "TaxiService",\r?\n(\s*)(?!"@id")/g,
    `"@type": "TaxiService",\n$1"@id": "${ID}",\n$1`
  );
  html = html.replace(
    /"description": "Return booking per leg where shown; up to 4 passengers unless stated otherwise\."/g,
    '"description": "Guide fare as shown on the page, confirmed when you book."'
  );
  if (html !== before) {
    fs.writeFileSync(fp, html);
    console.log('schema', file);
  }
}
