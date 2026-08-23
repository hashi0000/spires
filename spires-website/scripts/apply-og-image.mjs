#!/usr/bin/env node
/** Point Open Graph / Twitter images at a real PNG. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = 'https://www.spires-taxis.com/android-chrome-512x512.png';
const extras = `  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta name="twitter:image" content="${PNG}">`;

for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, 'utf8');
  const before = html;
  html = html.replace(
    /https:\/\/www\.spires-taxis\.com\/images\/spireslogo\.svg/g,
    PNG
  );
  html = html.replace(
    /https:\/\/www\.spires-taxis\.com\/images\/spires-logo-email\.png/g,
    PNG
  );
  if (/property="og:image"/.test(html) && !/og:image:type/.test(html)) {
    html = html.replace(
      /(<meta property="og:image" content="[^"]+"\s*\/?>)/,
      `$1\n${extras}`
    );
  }
  if (html !== before) {
    fs.writeFileSync(fp, html);
    console.log('og:', file);
  }
}
