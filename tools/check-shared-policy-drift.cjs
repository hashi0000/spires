/**
 * Fails when published copies of shared customer policy drift from the root source.
 * Source: service-policy.json and customer-facing-labels.json
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`Missing published copy: ${rel}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function stable(value) {
  return JSON.stringify(value);
}

const canonicalPolicy = readJson("service-policy.json");
const policyCopies = [
  "functions/src/servicePolicy.json",
  "functions/lib/servicePolicy.json",
  "customer-app/src/servicePolicy.json",
  "customer-app/src/generatedDocuments/servicePolicy.json",
  "spires-admin-fresh/src/data/servicePolicy.json",
  "spires-admin-fresh/src/generatedDocuments/servicePolicy.json",
];

if (canonicalPolicy) {
  for (const rel of policyCopies) {
    const copy = readJson(rel);
    if (copy && stable(copy) !== stable(canonicalPolicy)) {
      errors.push(`${rel} drifts from service-policy.json — run node tools/sync-service-policy.cjs (and sync-document-renderer if generatedDocuments).`);
    }
  }

  const websiteJs = path.join(root, "spires-website/js/service-policy.js");
  if (!fs.existsSync(websiteJs)) {
    errors.push("Missing spires-website/js/service-policy.js");
  } else {
    const text = fs.readFileSync(websiteJs, "utf8");
    const match = text.match(/window\.SpiresServicePolicy\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match) {
      errors.push("spires-website/js/service-policy.js does not export SpiresServicePolicy JSON.");
    } else {
      try {
        const parsed = Function("return (" + match[1] + ")")();
        if (stable(parsed) !== stable(canonicalPolicy)) {
          errors.push("spires-website/js/service-policy.js drifts from service-policy.json — run node tools/sync-service-policy.cjs.");
        }
      } catch (err) {
        errors.push(`Could not parse spires-website/js/service-policy.js: ${err.message}`);
      }
    }
  }

  if (Number(canonicalPolicy.airport && canonicalPolicy.airport.flightFreeMinutes) !== 50) {
    errors.push(`service-policy.json flightFreeMinutes must be 50 (found ${canonicalPolicy.airport && canonicalPolicy.airport.flightFreeMinutes}).`);
  }
}

const canonicalLabels = readJson("customer-facing-labels.json");
const labelCopies = [
  "functions/src/customerFacingLabels.json",
  "customer-app/src/customerFacingLabels.json",
  "spires-admin-fresh/src/data/customerFacingLabels.json",
];

if (canonicalLabels) {
  for (const rel of labelCopies) {
    const copy = readJson(rel);
    if (copy && stable(copy) !== stable(canonicalLabels)) {
      errors.push(`${rel} drifts from customer-facing-labels.json — run node tools/sync-service-policy.cjs.`);
    }
  }
  const websiteLabels = path.join(root, "spires-website/js/customer-facing-labels.js");
  if (!fs.existsSync(websiteLabels)) {
    errors.push("Missing spires-website/js/customer-facing-labels.js — run node tools/sync-service-policy.cjs.");
  } else {
    const text = fs.readFileSync(websiteLabels, "utf8");
    const match = text.match(/window\.SpiresCustomerLabels\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match) {
      errors.push("spires-website/js/customer-facing-labels.js does not export SpiresCustomerLabels.");
    } else {
      try {
        const parsed = Function("return (" + match[1] + ")")();
        if (stable(parsed) !== stable(canonicalLabels)) {
          errors.push("spires-website/js/customer-facing-labels.js drifts from customer-facing-labels.json.");
        }
      } catch (err) {
        errors.push(`Could not parse customer-facing-labels.js: ${err.message}`);
      }
    }
  }

  for (const key of ["requestAQuote", "requestReceived", "confirmed", "depositPaid", "balanceDue"]) {
    if (!canonicalLabels.labels || !canonicalLabels.labels[key] || !canonicalLabels.labels[key].label) {
      errors.push(`customer-facing-labels.json missing labels.${key}`);
    }
  }
}

// Payment example: same record must yield £35 received and £200 due.
try {
  const paymentPath = path.join(root, "functions/src/paymentAmount.ts");
  // Prefer compiled JS when present so we do not need a TS loader.
  const compiled = path.join(root, "functions/lib/paymentAmount.js");
  if (fs.existsSync(compiled)) {
    const { effectiveReceivedPence, serverPayablePence } = require(compiled);
    const booking = {
      actualFare: 235,
      amountReceivedPence: 3500,
      depositRequired: true,
      depositAmount: 35,
      depositStatus: "paid",
      status: "confirmed",
    };
    const received = effectiveReceivedPence(booking);
    const due = serverPayablePence(booking);
    if (received !== 3500) errors.push(`Payment example: expected £35 received (3500p), got ${received}.`);
    if (!(due && due.ok && due.pence === 20000)) {
      errors.push(`Payment example: expected £200 due (20000p), got ${due && due.ok ? due.pence : JSON.stringify(due)}.`);
    }
  } else {
    errors.push("functions/lib/paymentAmount.js missing — run functions build so the £235/£35/£200 payment check can run.");
  }
} catch (err) {
  errors.push(`Payment example check failed: ${err.message}`);
}

console.log("Shared policy / labels / payment drift check");
if (errors.length) {
  for (const error of errors) console.log("  FAIL ", error);
  process.exit(1);
}
console.log("OK — published policy copies, labels and £235/£35→£200 payment example align.");
