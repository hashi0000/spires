import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PHONE_SVG_BTN = `<svg class="btn-inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.21z"/></svg>`;

const svg = {
  plane: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
  grad: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  bag: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h8v12z"/></svg>`,
  palace: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3L1 9l2 1.18V21h6v-6h6v6h6V10.18L23 9 12 3zm6 16h-2v-2H8v2H6v-4h12v4zM8.82 9 12 7.5 15.18 9 12 10.5 8.82 9z"/></svg>`,
  taxi: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`,
};

function iconCircle(inner) {
  return `<div class="card-icon icon-circle">${inner}</div>`;
}

function patchCss() {
  const p = path.join(root, "css", "style.css");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("Reusable gold icon circle")) return;
  const old = `.card-icon {
    width: 80px;
    height: 80px;
    background: var(--oxford-gold-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
    color: var(--oxford-gold);
}

.service-price {`;
  const neu = `.card-icon {
    width: 80px;
    height: 80px;
    background: var(--oxford-gold-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
    color: var(--oxford-gold);
}

/* Reusable gold icon circle (homepage + cards) */
.icon-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(197, 165, 114, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 24px;
    line-height: 1;
    color: #C5A572;
}

.card-icon.icon-circle {
    width: 60px;
    height: 60px;
    background: rgba(197, 165, 114, 0.15);
    margin: 0 auto 16px;
    font-size: 0;
}

.card-icon.icon-circle svg {
    width: 24px;
    height: 24px;
    display: block;
    flex-shrink: 0;
    color: inherit;
    fill: currentColor;
}

.btn-inline-icon {
    width: 18px;
    height: 18px;
    margin-right: 0.45rem;
    flex-shrink: 0;
    display: block;
}

.service-price {`;
  if (!s.includes(old)) throw new Error("CSS anchor not found");
  s = s.replace(old, neu);
  fs.writeFileSync(p, s);
  console.log("Patched css/style.css");
}

function patchIndex() {
  const p = path.join(root, "index.html");
  let html = fs.readFileSync(p, "utf8");

  html = html.replace(
    /<a href="tel:\+447776897772" class="btn btn-primary">[\s\S]*?Call: 07776 897772<\/a>/,
    `<a href="tel:+447776897772" class="btn btn-primary">${PHONE_SVG_BTN}<span>Call: 07776 897772</span></a>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Airport Transfers<\/h3>/,
    `${iconCircle(svg.plane)}\n        <h3>Airport Transfers</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Student Services<\/h3>/,
    `${iconCircle(svg.grad)}\n        <h3>Student Services</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Local Oxford<\/h3>/,
    `${iconCircle(svg.map)}\n        <h3>Local Oxford</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Heathrow Airport<\/h3>/,
    `${iconCircle(svg.plane)}\n        <h3>Heathrow Airport</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Bicester Village<\/h3>/,
    `${iconCircle(svg.bag)}\n        <h3>Bicester Village</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>Blenheim Palace<\/h3>/,
    `${iconCircle(svg.palace)}\n        <h3>Blenheim Palace</h3>`
  );

  html = html.replace(
    /<div class="card-icon">[\s\S]*?<\/div>\s*<h3>London Transfers<\/h3>/,
    `${iconCircle(svg.taxi)}\n        <h3>London Transfers</h3>`
  );

  html = html.replace(
    /<div class="service-price">From [^<]+to Heathrow<\/div>/,
    `<div class="service-price">From &pound;95 to Heathrow</div>`
  );

  html = html.replace(
    /Learn more about airport taxis[^<]+/,
    "Learn more about airport taxis &rarr;"
  );

  html = html.replace(
    /<p>[\s\S]*?Fantastic service![\s\S]*?<\/p>\s*<span class="author">/,
    `<p>&ldquo;Fantastic service! Arrived early, very polite driver, and comfortable car. Highly recommended.&rdquo;</p>\n        <span class="author">`
  );

  html = html.replace(
    /<p>[\s\S]*?Used Spires for airport[\s\S]*?<\/p>\s*<span class="author">/,
    `<p>&ldquo;Used Spires for airport transfers multiple times. Always punctual and very professional. Great value.&rdquo;</p>\n        <span class="author">`
  );

  html = html.replace(
    /<p>[\s\S]*?student and the discount[\s\S]*?<\/p>\s*<span class="author">/,
    `<p>&ldquo;I&rsquo;m a student and the discount really helps! Always feel safe and the cars are spotless.&rdquo;</p>\n        <span class="author">`
  );

  html = html.replace(
    /<a href="tel:\+447776897772" class="btn btn-primary btn-large">[\s\S]*?<\/a>\s*<a href="https:\/\/wa\.me/,
    `<a href="tel:+447776897772" class="btn btn-primary btn-large">${PHONE_SVG_BTN}<span>Call 07776 897772</span></a>\n      <a href="https://wa.me`
  );

  fs.writeFileSync(p, html);
  console.log("Patched index.html");
}

patchCss();
patchIndex();
console.log("Done.");
