import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.QA_BASE || 'http://localhost:56207';
const OUT = path.resolve('qa-shots');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const PAGES = [
  '/',
  '/airport-transfers',
  '/rates',
  '/oxford-to-heathrow-taxi',
  '/heathrow-to-oxford-taxi',
  '/oxford-to-gatwick-taxi',
  '/oxford-to-luton-taxi',
  '/how-airport-pickup-works',
  '/student-taxis',
  '/corporate-taxis',
  '/our-vehicles',
  '/oxford-taxis',
  '/abingdon-taxis',
  '/bicester-taxis',
  '/banbury-to-oxford-taxi',
  '/contact',
  '/about',
  '/reviews',
  '/terms-and-conditions',
  '/offer-terms',
  '/thank-you',
  '/404.html',
  '/oxford-to-southampton-cruise-terminal',
  '/oxford-to-st-pancras-taxi',
  '/oxford-to-silverstone-taxi',
  '/cotswolds-tours-from-oxford',
  '/oxford-to-london-city-airport-taxi',
  '/long-distance-taxis'
];

const VIEWPORTS = [
  { w: 360, h: 780, name: '360' },
  { w: 390, h: 844, name: '390' },
  { w: 430, h: 932, name: '430' },
  { w: 768, h: 1024, name: '768' },
  { w: 1280, h: 800, name: '1280' }
];

const HOME_H1_EXTRA = [375, 412];

function slug(route) {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\.html$/, '');
}

async function inspect(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('h1');
    let h1Lines = [];
    if (h1) {
      const range = document.createRange();
      range.selectNodeContents(h1);
      h1Lines = [...range.getClientRects()].map((b) => ({
        textGuess: h1.innerText,
        w: Math.round(b.width),
        y: Math.round(b.top)
      }));
    }
    const wa = document.querySelector('.whatsapp-float');
    const wr = wa ? wa.getBoundingClientRect() : null;
    const overlaps = [];
    if (wr && wr.width) {
        document.querySelectorAll('h1, .hero__lead, a.btn, button, input, select, textarea, label, table, .site-footer__license, .site-footer__bottom, .site-footer__brand p, .site-footer__links a').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const hit = !(r.right < wr.left + 2 || r.left > wr.right - 2 || r.bottom < wr.top + 2 || r.top > wr.bottom - 2);
        if (hit) overlaps.push((el.tagName + ':' + (el.className || el.getAttribute('name') || '').toString().split(' ')[0]).slice(0, 50));
      });
    }
    return {
      inner: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollW: document.documentElement.scrollWidth,
      h1: h1 ? h1.innerText.replace(/\s+/g, ' ') : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      h1LineCount: h1Lines.length,
      lastLineW: h1Lines.length ? h1Lines[h1Lines.length - 1].w : 0,
      lastLineNarrow: h1Lines.length > 1 && h1Lines[h1Lines.length - 1].w < 96,
      wa: wr ? { x: Math.round(wr.left), y: Math.round(wr.top), w: Math.round(wr.width) } : null,
      overlaps: [...new Set(overlaps)],
      menuOpen: document.body.classList.contains('is-menu-open')
    };
  });
}

async function shot(page, file) {
  const dest = path.join(OUT, file);
  await page.screenshot({ path: dest, type: 'jpeg', quality: 72 });
  return dest;
}

fs.mkdirSync(OUT, { recursive: true });
const report = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: null,
  args: ['--hide-scrollbars', '--disable-gpu']
});

const page = await browser.newPage();
page.setDefaultNavigationTimeout(25000);

for (const vp of VIEWPORTS) {
  for (const route of PAGES) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 768, hasTouch: vp.w < 768 });
    const url = BASE + route;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 450));
    const metrics = await inspect(page);
    const name = `${slug(route)}--${vp.name}`;
    await shot(page, `${name}.jpg`);

    let extras = {};
    if (route === '/rates' && vp.w <= 430) {
      await page.evaluate(() => {
        const el = document.querySelector('#airport-price-cards, .airport-fare-card, .price-block');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--fares.jpg`);
      await page.evaluate(() => {
        const el = document.querySelector('.price-table');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--local-table.jpg`);
      extras.ratesMid = true;
    }
    if (route === '/contact' && (vp.w <= 430 || vp.w === 768)) {
      await page.evaluate(() => {
        const el = document.querySelector('.booking-form, form[method="POST"]');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--form.jpg`);
      extras.form = true;
    }
    if (route === '/' && vp.w <= 430) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--footer.jpg`);
      extras.footer = true;
    }
    if (route === '/our-vehicles' && (vp.w === 390 || vp.w === 1280)) {
      await page.evaluate(() => {
        const el = document.querySelector('.grid, .vehicle, .card');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--cards.jpg`);
    }
    if (route === '/reviews' && (vp.w === 390 || vp.w === 1280)) {
      await page.evaluate(() => {
        const el = document.querySelector('.grid');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await shot(page, `${name}--cards.jpg`);
    }

    report.push({ route, viewport: vp.name, ...metrics, ...extras, file: `${name}.jpg` });
  }
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 200));
await page.click('.site-menu-toggle');
await new Promise((r) => setTimeout(r, 350));
const menuOpen = await inspect(page);
await shot(page, 'home--390--menu-open.jpg');
const menuBox = await page.evaluate(() => {
  const m = document.querySelector('.site-menu');
  const r = m.getBoundingClientRect();
  return { left: r.left, width: r.width, height: r.height, open: m.classList.contains('is-open') };
});
await page.click('.site-menu__close, .site-menu-toggle');
await new Promise((r) => setTimeout(r, 250));
const menuClosed = await inspect(page);
await shot(page, 'home--390--menu-closed.jpg');
report.push({ route: '/menu', viewport: '390', menuOpen, menuBox, menuClosed, file: 'home--390--menu-open.jpg' });

for (const w of HOME_H1_EXTRA) {
  await page.setViewport({ width: w, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 180));
  const metrics = await inspect(page);
  await shot(page, `home--${w}.jpg`);
  report.push({ route: '/', viewport: String(w), ...metrics, file: `home--${w}.jpg` });
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const fails = report.filter((r) => r.overflow || r.lastLineNarrow || (r.overlaps && r.overlaps.length));
console.log(JSON.stringify({
  shots: fs.readdirSync(OUT).length,
  rows: report.length,
  overflow: report.filter((r) => r.overflow).map((r) => r.route + '@' + r.viewport),
  lastLineNarrow: report.filter((r) => r.lastLineNarrow).map((r) => r.route + '@' + r.viewport + ':' + r.h1),
  overlaps: report.filter((r) => r.overlaps && r.overlaps.length).map((r) => ({ route: r.route, vp: r.viewport, overlaps: r.overlaps })),
  menuBox
}, null, 2));
