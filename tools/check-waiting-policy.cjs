/**
 * Customer-facing airport waiting policy check.
 * Source of truth: service-policy.json (current version only).
 * Fails on conflicting flight-monitored allowances in live surfaces.
 * Warns on unresolved overage / fixed-time wording for Hashim's review.
 * Excludes archived terms and historical version maps so older bookings stay intact.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "service-policy.json"), "utf8"));
const flight = Number(policy.airport.flightFreeMinutes);
const fixed = Number(policy.airport.fixedFreeMinutes);
const charge = Number(policy.airport.chargePounds);
const block = Number(policy.airport.blockMinutes);

const errors = [];
const warnings = [];

if (!Number.isFinite(flight) || flight !== 50) {
  errors.push(`service-policy.json flightFreeMinutes must be 50 for the confirmed rule (found ${policy.airport.flightFreeMinutes}).`);
}

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "docs",
  "archive",
  "lib",
  "dist",
  "build",
  "coverage",
  "qa-shots",
]);

const EXCLUDE_FILE_NAMES = new Set([
  "2026-11-15.html",
  "2026-10-25.html",
  "previous-public.html",
  "NOVEMBER_SERVICE_UPDATE-2026-11-15.md",
  "check-waiting-policy.cjs",
]);

const EXCLUDE_PATH_PARTS = [
  `${path.sep}docs${path.sep}archive${path.sep}`,
  `${path.sep}terms${path.sep}2026-11-15.html`,
  `${path.sep}terms${path.sep}2026-10-25.html`,
  `${path.sep}terms${path.sep}previous-public.html`,
];

function excluded(filePath) {
  const rel = path.relative(root, filePath);
  if (EXCLUDE_FILE_NAMES.has(path.basename(filePath))) return true;
  if (EXCLUDE_PATH_PARTS.some((part) => filePath.includes(part))) return true;
  // Historical published waiting map for 2026-11-15 must keep 60 in code.
  if (/airportWaitingPolicy\.(js|ts)$/.test(rel) === false && rel.startsWith(`docs${path.sep}`)) {
    // docs/policies and checklists may mention 60 as history — warn only via content rules below
  }
  return false;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIR_NAMES.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === "terms") {
        // Include current terms pages; skip historic files by name later.
        walk(full, acc);
        continue;
      }
      walk(full, acc);
      continue;
    }
    if (!/\.(html|js|jsx|ts|tsx|css|md|json)$/i.test(item.name)) continue;
    if (excluded(full)) continue;
    acc.push(full);
  }
  return acc;
}

const roots = [
  path.join(root, "spires-website"),
  path.join(root, "customer-app", "src"),
  path.join(root, "spires-admin-fresh", "src"),
  path.join(root, "functions", "src"),
  path.join(root, "service-policy.json"),
];

const files = [];
for (const entry of roots) {
  if (fs.statSync(entry).isFile()) files.push(entry);
  else walk(entry, files);
}

// Also check email + guest booking templates explicitly if under website.
const extra = [
  path.join(root, "spires-website", "email.html"),
  path.join(root, "spires-website", "contact.html"),
  path.join(root, "spires-website", "js", "guest-booking.js"),
  path.join(root, "spires-website", "js", "service-policy.js"),
  path.join(root, "spires-website", "js", "collection-policy.js"),
  path.join(root, "spires-website", "js", "driver-hub-private.js"),
  path.join(root, "spires-website", "js", "airport-prices.js"),
];
for (const file of extra) {
  if (fs.existsSync(file) && !files.includes(file) && !excluded(file)) files.push(file);
}

const FLIGHT_60 = [
  /includes\s+60\s+minutes\s+from\s+(?:the\s+)?verified\s+actual\s+landing/i,
  /allow(?:ance)?\s+(?:of\s+)?60\s+minutes\s+from\s+(?:the\s+)?(?:verified\s+)?actual\s+landing/i,
  /included\s+allowance\s+is\s+60\s+minutes\s+from\s+that\s+verified\s+landing/i,
  /60\s+minutes\s+are\s+included\s+from\s+verified\s+actual\s+landing/i,
  /flightFreeMinutes["']?\s*:\s*60(?![\s\S]{0,80}2026-11-15)/,
  /freeMinutes:\s*fixed\s*\?\s*15\s*:\s*60/,
  /CURRENT\s*=\s*["']2026-11-15["']/,
];

const LEGACY_CHARGE = [
  /£10\s+per\s+additional\s+30\s+minutes/i,
  /£10\s+per\s+started\s+30\s+minutes/i,
  /£10\s+per\s+every\s+additional\s+30/i,
  /£10\s+for\s+each\s+extra\s+30\s+minutes/i,
  /waiting.*£10.*30\s+minute/i,
  /£10\s+per\s+started\s+30/,
];

const FIXED_REVIEW = [
  /fixed\s+time[^\n.]{0,80}(?:30|45|60)\s+minutes/i,
  /includes\s+(?:30|45|60)\s+minutes\s+from\s+the\s+booked/i,
];

function isHistoricalVersionMap(line) {
  return /["']2026-11-15["']\s*:\s*\{[^}]*flightFreeMinutes\s*:\s*60/.test(line)
    || /flightFreeMinutes:\s*60,\s*fixedFreeMinutes:\s*15/.test(line) && /2026-11-15/.test(line);
}

function stripExcludedPolicyMaps(text) {
  // Keep PUBLISHED_WAITING / version history for 2026-11-15 out of the fail set.
  return text.replace(/["']2026-11-15["']\s*:\s*\{[^}]*\}/g, "/* historic-2026-11-15 */");
}

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  let text = fs.readFileSync(file, "utf8");
  text = stripExcludedPolicyMaps(text);

  // Share waitlist "60 minutes to claim" is not airport waiting.
  const cleaned = text
    .replace(/60 minutes to claim/gi, "")
    .replace(/plus_minus_60/g, "")
    .replace(/60 minutes either side/gi, "")
    .replace(/Allow 60[–-]90 minutes driving/gi, "");

  for (const pattern of FLIGHT_60) {
    if (pattern.test(cleaned)) {
      errors.push(`${rel}: conflicting flight-monitored waiting wording (expected ${flight} minutes from actual landing).`);
      break;
    }
  }

  if (!/\.test\.(ts|tsx|js|mjs)$/.test(rel) && !/\/__tests__\//.test(rel)) {
    for (const pattern of LEGACY_CHARGE) {
      if (pattern.test(cleaned)) {
        warnings.push(`${rel}: legacy £10 / 30 waiting charge wording — Needs Hashim’s approval (current published stamp uses £${charge} / ${block}).`);
        break;
      }
    }
  }

  for (const pattern of FIXED_REVIEW) {
    if (pattern.test(cleaned)) {
      warnings.push(`${rel}: fixed-time waiting wording may disagree with ${fixed} minutes — Needs Hashim’s approval.`);
      break;
    }
  }
}

// Shared config must match website generated policy.
const websitePolicyPath = path.join(root, "spires-website", "js", "service-policy.js");
if (fs.existsSync(websitePolicyPath)) {
  const websitePolicy = fs.readFileSync(websitePolicyPath, "utf8");
  if (!websitePolicy.includes(`"flightFreeMinutes": ${flight}`) && !websitePolicy.includes(`flightFreeMinutes: ${flight}`)) {
    errors.push(`spires-website/js/service-policy.js does not match service-policy.json flightFreeMinutes (${flight}). Run tools/sync-service-policy.cjs.`);
  }
}

console.log(`Waiting policy check (current ${policy.version}: flight ${flight} / fixed ${fixed} / £${charge} per ${block})`);
console.log(`Scanned ${files.length} files.`);

if (warnings.length) {
  console.log(`\nReview flags (${warnings.length}):`);
  for (const warning of warnings) console.log(`  WARN  ${warning}`);
}

if (errors.length) {
  console.log(`\nFailures (${errors.length}):`);
  for (const error of errors) console.log(`  FAIL  ${error}`);
  process.exit(1);
}

console.log("\nOK — no conflicting current flight-monitored allowances.");
if (warnings.length) {
  console.log(`${warnings.length} charge/fixed-time item(s) flagged for review (non-blocking).`);
}
