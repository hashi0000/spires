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

const p = path.join(root, "index.html");
let html = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

html = html.replace(
  `<a href="tel:+447776897772" class="btn btn-primary">📞 Call: 07776 897772</a>`,
  `<a href="tel:+447776897772" class="btn btn-primary">${PHONE_SVG_BTN}<span>Call: 07776 897772</span></a>`
);

html = html.replace(/<div class="card-icon">✈️<\/div>/g, iconCircle(svg.plane));
html = html.replace(/<div class="card-icon">🎓<\/div>/, iconCircle(svg.grad));
html = html.replace(/<div class="card-icon">🧳<\/div>/, iconCircle(svg.map));
html = html.replace(/<div class="card-icon">🛍️<\/div>/, iconCircle(svg.bag));
html = html.replace(/<div class="card-icon">🏰<\/div>/, iconCircle(svg.palace));
html = html.replace(/<div class="card-icon">🚆<\/div>/, iconCircle(svg.taxi));

html = html.replace(
  `        <div class="service-price">From £95 to Heathrow</div>
        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #1d3c74;">Learn more about airport taxis →</div>`,
  `        <div class="service-price">From &pound;95 to Heathrow</div>
        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #1d3c74;">Learn more about airport taxis &rarr;</div>`
);

html = html.replace(
  `      <a href="tel:+447776897772" class="btn btn-primary btn-large">
        📞 Call 07776 897772
      </a>`,
  `      <a href="tel:+447776897772" class="btn btn-primary btn-large">${PHONE_SVG_BTN}<span>Call 07776 897772</span></a>`
);

html = html.replace(
  `        <p>“Fantastic service! Arrived early, very polite driver, and comfortable car. Highly recommended.”</p>`,
  `        <p>&ldquo;Fantastic service! Arrived early, very polite driver, and comfortable car. Highly recommended.&rdquo;</p>`
);
html = html.replace(
  `        <p>“Used Spires for airport transfers multiple times. Always punctual and very professional. Great value.”</p>`,
  `        <p>&ldquo;Used Spires for airport transfers multiple times. Always punctual and very professional. Great value.&rdquo;</p>`
);
html = html.replace(
  `        <p>“I’m a student and the discount really helps! Always feel safe and the cars are spotless.”</p>`,
  `        <p>&ldquo;I&rsquo;m a student and the discount really helps! Always feel safe and the cars are spotless.&rdquo;</p>`
);

fs.writeFileSync(p, html);
console.log("OK");
