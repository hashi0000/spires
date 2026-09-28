import fs from 'node:fs';
import path from 'node:path';
import { request } from 'node:http';
import puppeteer from 'puppeteer-core';

const BASE = process.env.QA_BASE || 'http://localhost:56207';
const ROOT = path.resolve('.');
const OUT = path.resolve('qa-shots');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const PAGES = [
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

function slug(route) {
  return route.replace(/^\//, '');
}

function get(url) {
  return new Promise((resolve, reject) => {
    request(url, { headers: { Accept: 'text/html' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        location: res.headers.location,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    }).on('error', reject).end();
  });
}

function fileForRoute(route) {
  return path.join(ROOT, `${route.replace(/^\//, '')}.html`);
}

function seoCheck() {
  const issues = [];
  const titles = new Map();
  const metas = new Map();
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
    const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
    if (title) {
      if (titles.has(title)) issues.push(`duplicate title: ${file} and ${titles.get(title)}`);
      else titles.set(title, file);
    }
    if (desc) {
      if (metas.has(desc)) issues.push(`duplicate meta: ${file} and ${metas.get(desc)}`);
      else metas.set(desc, file);
    }
  }

  const rows = [];
  for (const route of PAGES) {
    const file = fileForRoute(route);
    const html = fs.readFileSync(file, 'utf8');
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || '';
    const robots = (html.match(/<meta name="robots" content="([^"]+)"/i) || [])[1] || '';
    const noindex = /noindex/i.test(robots);
    const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => {
      try { return JSON.parse(m[1]); } catch { return { parseError: true, raw: m[1].slice(0, 80) }; }
    });
    const summaries = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    const faq = ldBlocks.find((b) => b['@type'] === 'FAQPage');
    const faqNames = faq ? faq.mainEntity.map((q) => q.name) : [];
    const faqMismatch = faqNames.filter((n, i) => n !== summaries[i]);
    const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
    const missing = [];
    for (const href of new Set(hrefs)) {
      if (href.startsWith('//') || href === '/') continue;
      const candidate = path.join(ROOT, `${href.replace(/^\//, '')}.html`);
      const dirIndex = path.join(ROOT, href.replace(/^\//, ''), 'index.html');
      if (!fs.existsSync(candidate) && !fs.existsSync(dirIndex)) missing.push(href);
    }
    rows.push({
      route,
      h1Count: h1s.length,
      h1: h1s[0] ? h1s[0][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
      title,
      desc,
      canonical,
      robots,
      noindex,
      ldOk: ldBlocks.every((b) => !b.parseError),
      faqVisible: summaries,
      faqSchema: faqNames,
      faqMismatch,
      missingLinks: missing,
      hasEyebrow: /section__eyebrow/.test(html) && /hero/.test(html.slice(html.indexOf('<main'), html.indexOf('</main>') + 8)),
    });
    if (h1s.length !== 1) issues.push(`${route}: expected 1 H1, got ${h1s.length}`);
    if (noindex) issues.push(`${route}: robots noindex`);
    if (!canonical.endsWith(route)) issues.push(`${route}: canonical ${canonical}`);
    if (faqMismatch.length) issues.push(`${route}: FAQ schema names differ from visible summaries`);
    if (missing.length) issues.push(`${route}: missing targets ${missing.join(', ')}`);
  }
  return { issues, rows };
}

async function inspect(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('h1');
    let h1Lines = [];
    if (h1) {
      const range = document.createRange();
      range.selectNodeContents(h1);
      h1Lines = [...range.getClientRects()].map((b) => ({
        w: Math.round(b.width),
        y: Math.round(b.top),
        h: Math.round(b.height)
      }));
    }
    const wa = document.querySelector('.whatsapp-float');
    const wr = wa ? wa.getBoundingClientRect() : null;
    const crumb = document.querySelector('.breadcrumbs, .breadcrumb, nav[aria-label="Breadcrumb"]');
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollW: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      h1: h1 ? h1.innerText.replace(/\s+/g, ' ') : null,
      h1LineCount: h1Lines.length,
      lastLineW: h1Lines.length ? h1Lines[h1Lines.length - 1].w : 0,
      lastLineNarrow: h1Lines.length > 1 && h1Lines[h1Lines.length - 1].w < 96,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      chrome: !!(document.querySelector('.site-header') && document.querySelector('.site-footer') && document.querySelector('.whatsapp-float')),
      visibleBreadcrumb: !!(crumb && crumb.offsetParent !== null && crumb.getBoundingClientRect().height > 8),
      wa: wr ? { x: Math.round(wr.left), y: Math.round(wr.top) } : null
    };
  });
}

const seo = seoCheck();
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: null,
  args: ['--hide-scrollbars', '--disable-gpu']
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(25000);
const report = [];

for (const route of PAGES) {
  const live = await get(BASE + route);
  if (live.status !== 200) seo.issues.push(`${route}: HTTP ${live.status}`);
}

for (const vp of VIEWPORTS) {
  for (const route of PAGES) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 768, hasTouch: vp.w < 768 });
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 400));
    const metrics = await inspect(page);
    const name = `${slug(route)}--${vp.name}`;
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 78 });
    report.push({ route, viewport: vp.name, ...metrics, file: `${name}.jpg` });

    if (vp.w === 390 || vp.w === 1280) {
      await page.evaluate(() => {
        const el = document.querySelector('.faq, .grid, .card');
        if (el) el.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 120));
      await page.screenshot({ path: path.join(OUT, `${name}--mid.jpg`), type: 'jpeg', quality: 72 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 120));
      await page.screenshot({ path: path.join(OUT, `${name}--footer.jpg`), type: 'jpeg', quality: 72 });
    }
  }
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(BASE + '/long-distance-taxis', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 250));
await page.click('.site-menu-toggle');
await new Promise((r) => setTimeout(r, 350));
await page.screenshot({ path: path.join(OUT, 'long-distance-taxis--390--menu-open.jpg'), type: 'jpeg', quality: 78 });
const menuOpen = await page.evaluate(() => document.body.classList.contains('is-menu-open'));

await browser.close();

const visualIssues = report.filter((r) => r.overflow || r.lastLineNarrow || r.visibleBreadcrumb || !r.chrome);
const out = {
  seoIssues: seo.issues,
  seo: seo.rows.map((r) => ({
    route: r.route,
    h1Count: r.h1Count,
    h1: r.h1,
    title: r.title,
    desc: r.desc,
    canonical: r.canonical,
    robots: r.robots,
    faqMismatch: r.faqMismatch,
    missingLinks: r.missingLinks
  })),
  overflow: report.filter((r) => r.overflow).map((r) => r.route + '@' + r.viewport),
  lastLineNarrow: report.filter((r) => r.lastLineNarrow).map((r) => r.route + '@' + r.viewport + ':' + r.h1),
  missingChrome: report.filter((r) => !r.chrome).map((r) => r.route + '@' + r.viewport),
  visibleBreadcrumb: report.filter((r) => r.visibleBreadcrumb).map((r) => r.route + '@' + r.viewport),
  menuOpen,
  visualIssues: visualIssues.length,
  rows: report.length
};
fs.writeFileSync(path.join(OUT, 'dest-report.json'), JSON.stringify({ ...out, full: report }, null, 2));
console.log(JSON.stringify(out, null, 2));
if (seo.issues.length || visualIssues.length) process.exitCode = 1;
