#!/usr/bin/env node
/**
 * Write public titles and meta descriptions from scripts/lib/seo-copy.mjs
 * into existing head tags. Does not add a second title or description.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SEO_BY_FILE } from "./lib/seo-copy.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["nav-snippet.html"]);
const TITLE_KEYS = [
  "title",
  "ogTitle",
  "_hoTitle",
  "_hoOg",
  "_gwTitle",
  "_gwOg",
  "_hiTitle",
  "_hiOg",
  "_pkTitle",
  "_pkOg",
  "_stTitle",
  "_stOg",
  "_ctTitle",
  "_ctOg",
  "hoT",
  "hoOg",
  "gwT",
  "gwOg",
  "hiT",
  "hiOg",
  "pkT",
  "pkOg",
  "stT",
  "stOg",
  "ctT",
  "ctOg",
];
const DESC_KEYS = [
  "description",
  "ogDescription",
  "_hoDesc",
  "_hoOgDesc",
  "_gwDesc",
  "_gwOgDesc",
  "_hiDesc",
  "_hiOgDesc",
  "_pkDesc",
  "_pkOgDesc",
  "_stDesc",
  "_stOgDesc",
  "_ctDesc",
  "_ctOgDesc",
  "hoD",
  "hoOD",
  "gwD",
  "gwOD",
  "hiD",
  "hiOD",
  "pkD",
  "pkOD",
  "stD",
  "stOD",
  "ctD",
  "ctOD",
];
const GENERATORS = [
  "scripts/write-i18n-pages.mjs",
  "scripts/write-missing-airport-routes.mjs",
];

function listHtml(dir, prefix = "") {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "scripts", "includes", "api"].includes(name.name)) continue;
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...listHtml(path.join(dir, name.name), rel));
    else if (name.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function one(html, regex, label, file) {
  const found = html.match(regex) || [];
  if (found.length !== 1) {
    throw new Error(`${file}: expected 1 ${label}, found ${found.length}`);
  }
  return found[0];
}

function replaceOne(html, regex, next, label, file) {
  one(html, regex, label, file);
  return html.replace(regex, next);
}

function replaceOptional(html, regex, next) {
  const found = html.match(regex) || [];
  if (found.length > 1) throw new Error(`expected at most 1 optional tag, found ${found.length}`);
  if (!found.length) return html;
  return html.replace(regex, next);
}

function replaceAssigned(source, key, oldValue, newValue) {
  if (!oldValue || oldValue === newValue) return { source, count: 0 };
  let count = 0;
  for (const quote of ['"', "'"]) {
    const from = `${key}: ${quote}${oldValue}${quote}`;
    const to = `${key}: ${quote}${newValue}${quote}`;
    const parts = source.split(from);
    count += parts.length - 1;
    source = parts.join(to);
  }
  return { source, count };
}

function hyphenProblems(text) {
  const cleaned = text.replace(/Henley-on-Thames/g, "").replace(/E-Mail/g, "");
  return cleaned.match(/[\p{L}\p{N}]-[\p{L}\p{N}]/gu) || [];
}

const files = listHtml(root);
const indexable = files.filter((file) => {
  if (SKIP.has(file)) return false;
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const noindex = /name="robots"[^>]*noindex/i.test(html);
  const stub = /http-equiv="refresh"/i.test(html);
  return !noindex && !stub;
});

const missing = indexable.filter((file) => !SEO_BY_FILE[file]);
const extra = Object.keys(SEO_BY_FILE).filter((file) => !indexable.includes(file));
if (missing.length || extra.length) {
  console.error("MISSING", missing);
  console.error("EXTRA", extra);
  process.exit(1);
}

const titles = new Map();
const descriptions = new Map();
const problems = [];
for (const [file, seo] of Object.entries(SEO_BY_FILE)) {
  if (titles.has(seo.title)) problems.push(`duplicate title ${seo.title} (${file}, ${titles.get(seo.title)})`);
  titles.set(seo.title, file);
  if (descriptions.has(seo.description)) {
    problems.push(`duplicate description (${file}, ${descriptions.get(seo.description)})`);
  }
  descriptions.set(seo.description, file);
  const blob = `${seo.title}\n${seo.description}`;
  const claimText = blob.normalize("NFD").replace(/\p{M}/gu, "");
  if (/\bcheap(est)?\b/i.test(claimText) || /\bbest\b/i.test(claimText) || /24\/7|24-7/.test(blob)) {
    problems.push(`${file}: unsupported claim`);
  }
  if (/meet and greet|meet & greet/i.test(blob)) problems.push(`${file}: meet and greet`);
  const english = !file.includes("/");
  if (english && /pre-booked|door-to-door|one-way|8-seater|fixed-price/i.test(blob)) {
    problems.push(`${file}: hyphenated compound`);
  }
  if (english) {
    const hyphens = hyphenProblems(blob);
    if (hyphens.length) problems.push(`${file}: hyphen ${hyphens.join(",")}`);
  }
  if (file.includes("gatwick") && /£150|\b150\b/.test(blob)) problems.push(`${file}: Gatwick uses £150`);
  if (file.includes("banbury") && /£35|\bfrom £/.test(blob)) problems.push(`${file}: Banbury price claim`);
  if (file.endsWith("-taxis.html") || file === "banbury-to-oxford-taxi.html") {
    if (/from £\d/.test(blob)) problems.push(`${file}: uses from £`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const report = [];
const generatorText = Object.fromEntries(
  GENERATORS.map((rel) => [rel, fs.readFileSync(path.join(root, rel), "utf8")])
);
const generatorHits = Object.fromEntries(GENERATORS.map((rel) => [rel, 0]));

for (const file of indexable) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, "utf8");
  const oldTitle = one(html, /<title>[^<]*<\/title>/i, "title", file).replace(/<\/?title>/gi, "");
  const oldDesc = one(html, /<meta name="description" content="[^"]*">/i, "description", file).match(
    /content="([^"]*)"/
  )[1];
  const oldOg = (html.match(/<meta property="og:title" content="([^"]*)"/i) || [])[1] || "";
  const oldOgDesc = (html.match(/<meta property="og:description" content="([^"]*)"/i) || [])[1] || "";
  const seo = SEO_BY_FILE[file];
  const title = esc(seo.title);
  const description = esc(seo.description);

  html = replaceOne(html, /<title>[^<]*<\/title>/i, `<title>${title}</title>`, "title", file);
  html = replaceOne(
    html,
    /<meta name="description" content="[^"]*">/i,
    `<meta name="description" content="${description}">`,
    "description",
    file
  );
  html = replaceOne(
    html,
    /<meta property="og:title" content="[^"]*">/i,
    `<meta property="og:title" content="${title}">`,
    "og:title",
    file
  );
  html = replaceOne(
    html,
    /<meta property="og:description" content="[^"]*">/i,
    `<meta property="og:description" content="${description}">`,
    "og:description",
    file
  );
  html = replaceOptional(
    html,
    /<meta name="twitter:title" content="[^"]*">/i,
    `<meta name="twitter:title" content="${title}">`
  );
  html = replaceOptional(
    html,
    /<meta name="twitter:description" content="[^"]*">/i,
    `<meta name="twitter:description" content="${description}">`
  );

  const titleCount = (html.match(/<title>/gi) || []).length;
  const descCount = (html.match(/<meta name="description"/gi) || []).length;
  if (titleCount !== 1 || descCount !== 1) {
    throw new Error(`${file}: title ${titleCount}, description ${descCount}`);
  }

  fs.writeFileSync(full, html);

  for (const rel of GENERATORS) {
    for (const key of TITLE_KEYS) {
      for (const oldValue of [oldTitle, oldOg]) {
        const next = replaceAssigned(generatorText[rel], key, oldValue, seo.title);
        generatorHits[rel] += next.count;
        generatorText[rel] = next.source;
      }
    }
    for (const key of DESC_KEYS) {
      for (const oldValue of [oldDesc, oldOgDesc]) {
        const next = replaceAssigned(generatorText[rel], key, oldValue, seo.description);
        generatorHits[rel] += next.count;
        generatorText[rel] = next.source;
      }
    }
  }

  report.push({
    file,
    beforeTitle: oldTitle,
    afterTitle: seo.title,
    titleLength: seo.title.length,
    description: seo.description,
    descriptionLength: seo.description.length,
  });
}

for (const rel of GENERATORS) {
  fs.writeFileSync(path.join(root, rel), generatorText[rel]);
}

const out = path.join(root, "scripts", "_seo-report.json");
fs.writeFileSync(out, JSON.stringify({ generatorHits, report }, null, 2));
const shortTitles = report.filter((row) => row.titleLength < 35 || row.titleLength > 70);
const oddDesc = report.filter((row) => row.descriptionLength < 110 || row.descriptionLength > 175);
console.log(`Updated ${report.length} pages`);
console.log("Generator replacements", generatorHits);
console.log(
  "Title length outliers",
  shortTitles.map((row) => `${row.file} ${row.titleLength}`)
);
console.log(
  "Description length outliers",
  oddDesc.map((row) => `${row.file} ${row.descriptionLength}`)
);
