#!/usr/bin/env node
/**
 * Keep visible data-spires-price tokens in HTML in sync with js/airport-prices.js
 * so Google sees the current fares in the initial HTML, not only after JS runs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPublishedFares, fare, money } from './lib/published-fares.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { data, classes, returnSaving } = loadPublishedFares();

function resolveToken(token) {
  if (token === 'disclaimer') return null;
  const parts = String(token || '').split('.');
  if (parts[0] === 'vehicle' && parts[1] && classes[parts[1]]) {
    const vc = classes[parts[1]];
    if (parts[2] === 'name') return vc.name;
    if (parts[2] === 'examples') return vc.examples;
    if (parts[2] === 'capacity') return vc.capacity;
    if (parts[2] === 'tableExamples') return vc.tableExamples || vc.examples;
    return vc.name;
  }
  const amount = fare(data, parts[0], parts[1], parts[2]);
  if (parts[2] === 'oneWay' || parts[2] === 'return') return amount != null ? money(amount) : null;
  if (parts[2] === 'save') {
    const prices = data.routes[parts[0]]?.[parts[1]];
    const save = returnSaving(prices);
    return save ? money(save) : null;
  }
  return null;
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === 'scripts' || name.name === 'api') continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (name.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  const next = html.replace(
    /(<[^>]*data-spires-price="([^"]+)"[^>]*>)([^<]*)(<\/[^>]+>)/g,
    (all, open, token, _text, close) => {
      const value = resolveToken(token);
      if (!value) return all;
      return `${open}${value}${close}`;
    }
  );
  if (next !== html) {
    fs.writeFileSync(file, next);
    changed++;
    console.log('Synced prices in', path.relative(root, file));
  }
}
console.log(`Price sync complete. ${changed} file(s) updated.`);
