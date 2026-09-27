import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:56207';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'qa-shots';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
const page = await browser.newPage();

async function snap(route, w, h, file, after) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 78 });
}

for (const w of [360, 375, 390, 412, 430]) {
  await snap('/', w, 780, `home--${w}.jpg`);
}
await snap('/', 1280, 800, 'home--1280.jpg');
await snap('/rates', 360, 780, 'rates--360.jpg');
await snap('/rates', 768, 1024, 'rates--768.jpg');
await snap('/rates', 1280, 800, 'rates--1280.jpg');
await snap('/contact', 360, 780, 'contact--360--form.jpg', async (p) => {
  await p.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((el) => el.textContent.includes('Booking form'));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 200));
});
await snap('/contact', 360, 780, 'contact--360.jpg');
await snap('/student-taxis', 360, 780, 'student-taxis--360.jpg');
await snap('/corporate-taxis', 1280, 800, 'corporate-taxis--1280.jpg');
await snap('/', 390, 844, 'home--390--menu-open.jpg', async (p) => {
  await p.click('.site-menu-toggle');
  await new Promise((r) => setTimeout(r, 350));
});
await snap('/rates', 360, 780, 'rates--360--fares.jpg', async (p) => {
  await p.evaluate(() => document.querySelector('.airport-fare-card, .price-block')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 200));
});
await snap('/rates', 360, 780, 'rates--360--local-table.jpg', async (p) => {
  await p.evaluate(() => document.querySelector('.price-table')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 200));
});
await snap('/', 360, 780, 'home--360--footer.jpg', async (p) => {
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 200));
});
await browser.close();
console.log('recheck shots written');
