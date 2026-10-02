import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve('.');
const OUT = path.resolve('qa-shots');
const PORT = 56217;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { w: 360, h: 780, name: '360' },
  { w: 375, h: 812, name: '375' },
  { w: 390, h: 844, name: '390' },
  { w: 412, h: 915, name: '412' },
  { w: 430, h: 932, name: '430' },
  { w: 768, h: 1024, name: '768' },
  { w: 1280, h: 800, name: '1280' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function serve() {
  return createServer((req, res) => {
    const url = new URL(req.url, BASE);
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!path.extname(file)) file += '.html';
    const fp = path.join(ROOT, file.replace(/\//g, path.sep));
    if (!fp.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    fs.readFile(fp, (err, buf) => {
      if (err) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
      res.end(buf);
    });
  }).listen(PORT, '127.0.0.1');
}

async function measure(page) {
  return page.evaluate(() => {
    const issues = [];
    const cards = [...document.querySelectorAll('.share-card')];
    const ctas = [...document.querySelectorAll('.share-card .btn, .share-card__cta')];
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      if (r.width > window.innerWidth + 1) issues.push(`card ${i} overflows viewport`);
      if (r.height < 120) issues.push(`card ${i} unexpectedly short`);
    });
    ctas.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height && r.height < 40) issues.push(`CTA ${el.textContent.trim()} below 40px (${Math.round(r.height)})`);
    });
    const h1 = document.querySelector('h1')?.getBoundingClientRect();
    if (h1 && h1.right > window.innerWidth - 8) issues.push('H1 may clip the right edge');
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent,
      cards: cards.length,
      occupancy: document.querySelectorAll('.share-occupancy').length,
      banner: document.querySelector('.share-pilot-banner')?.textContent,
      robots: document.querySelector('meta[name="robots"]')?.content,
      issues,
    };
  });
}

const notes = [];
const server = serve();
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/share.html?previewLayout=1`, { waitUntil: 'networkidle0', timeout: 30000 });
    const info = await measure(page);
    await page.screenshot({ path: path.join(OUT, `share-${vp.name}-top.png`), fullPage: false });
    await page.evaluate(() => document.querySelector('#departures')?.scrollIntoView());
    await page.screenshot({ path: path.join(OUT, `share-${vp.name}-cards.png`), fullPage: false });
    await page.evaluate(() => document.querySelector('#account')?.scrollIntoView());
    await page.screenshot({ path: path.join(OUT, `share-${vp.name}-form.png`), fullPage: false });
    notes.push({ viewport: vp.name, ...info });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(OUT, 'share-qa.json'), JSON.stringify(notes, null, 2));
console.log(JSON.stringify(notes, null, 2));
const failed = notes.filter((row) => row.issues.length);
if (failed.length) {
  console.error('QA issues', failed.map((row) => ({ viewport: row.viewport, issues: row.issues })));
  process.exitCode = 1;
} else {
  console.log('Share layout QA: no measured overflow/touch issues at', VIEWPORTS.map((row) => row.w).join(', '));
}
