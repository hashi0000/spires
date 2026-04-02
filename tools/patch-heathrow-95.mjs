import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.dirname(fileURLToPath(import.meta.url));
const proj = path.join(root, "..");

function rep(rel, pairs) {
  const p = path.join(proj, rel);
  let s = fs.readFileSync(p, "utf8");
  let n = s;
  for (const [a, b] of pairs) {
    if (!n.includes(a)) throw new Error(`Not found in ${rel}: ${a.slice(0, 60)}...`);
    n = n.split(a).join(b);
  }
  if (n !== s) fs.writeFileSync(p, n);
  console.log(rel, "OK");
}

rep("index.html", [["From &pound;85 to Heathrow", "From &pound;95 to Heathrow"]]);
rep("airport-taxis-oxford.html", [
  ["Fixed price from £85.", "Fixed price from £95."],
  ['<div class="service-price">From £85</div>', '<div class="service-price">From £95</div>'],
]);
rep("airport-transfers.html", [["Heathrow transfers from £85 and", "Heathrow transfers from £95 and"]]);
rep("rates.html", [
  [
    `<a href="./heathrow-airport-taxis.html" class="card fade-in" style="text-decoration: none; color: inherit;">
                    <div class="card-icon">✈️</div>
                    <h3>Heathrow Airport</h3>
                    <p>All terminals • 60 minutes journey time<br>Flight monitoring included</p>
                    <div class="service-price">From £85</div>`,
    `<a href="./heathrow-airport-taxis.html" class="card fade-in" style="text-decoration: none; color: inherit;">
                    <div class="card-icon">✈️</div>
                    <h3>Heathrow Airport</h3>
                    <p>All terminals • 60 minutes journey time<br>Flight monitoring included</p>
                    <div class="service-price">From £95</div>`,
  ],
]);
rep("services.html", [
  [
    `<a href="./heathrow-airport-taxis.html" class="card fade-in" style="text-decoration: none; color: inherit;">
                    <div class="card-icon">✈️</div>
                    <h3>Heathrow Airport</h3>
                    <p>Direct transfers to all terminals. Flight monitoring included. Professional meet and greet service available.</p>
                    <div class="service-price">From £85</div>`,
    `<a href="./heathrow-airport-taxis.html" class="card fade-in" style="text-decoration: none; color: inherit;">
                    <div class="card-icon">✈️</div>
                    <h3>Heathrow Airport</h3>
                    <p>Direct transfers to all terminals. Flight monitoring included. Professional meet and greet service available.</p>
                    <div class="service-price">From £95</div>`,
  ],
]);
rep("student-taxis.html", [["Airport transfers begin at £85 for Heathrow", "Airport transfers begin at £95 for Heathrow"]]);
rep("abingdon-taxi.html", [['<div class="service-price">From £90</div>', '<div class="service-price">From £95</div>']]);
rep("offer-terms.html", [
  [
    "The £5 discount will be applied to the total confirmed fare (for example, £85 outbound + £80 return becomes £160 instead of £165)",
    "The £5 discount will be applied to the total confirmed fare (for example, £95 outbound + £80 return becomes £170 instead of £175)",
  ],
]);

const h85 = "£85";
const h95 = "£95";
for (const rel of ["heathrow-airport-taxis.html", "pages/oxford-to-heathrow-taxi.html"]) {
  const p = path.join(proj, rel);
  let s = fs.readFileSync(p, "utf8");
  const count = s.split(h85).length - 1;
  const n = s.split(h85).join(h95);
  fs.writeFileSync(p, n);
  console.log(rel, "replaced", count, "x £85→£95");
}
