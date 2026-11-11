/**
 * Point every airport route landing page at its WhatsApp enquiry.
 * Header, footer, and in-page links are rewritten. The shared helper
 * also rewrites chrome links after a later header/footer sync.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "node:module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { hrefForRoute, routeIdForFilename } = require("../js/whatsapp-route.js");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = '<script src="/js/whatsapp-route.js" defer></script>';

function listHtml(dir, prefix = "") {
  const files = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "node_modules" || name.name === "scripts" || name.name === "includes") continue;
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) files.push(...listHtml(full, rel));
    else if (name.name.endsWith(".html")) files.push(rel);
  }
  return files;
}

let updated = 0;
const report = [];

for (const rel of listHtml(root)) {
  const routeId = routeIdForFilename(rel);
  if (!routeId) continue;
  const href = hrefForRoute(routeId);
  const fp = path.join(root, rel);
  let html = fs.readFileSync(fp, "utf8");
  const before = html;

  html = html.replace(/<body\b([^>]*)>/, (match, attrs) => {
    if (/\sdata-wa-route=/.test(attrs)) {
      return match.replace(/data-wa-route="[^"]*"/, `data-wa-route="${routeId}"`);
    }
    return `<body${attrs} data-wa-route="${routeId}">`;
  });

  let links = 0;
  html = html.replace(/href="https:\/\/wa\.me\/447776897772(?:\?[^"]*)?"/g, () => {
    links += 1;
    return `href="${href}"`;
  });

  if (!html.includes("/js/whatsapp-route.js")) {
    if (html.includes("</body>")) html = html.replace("</body>", `${SCRIPT}\n</body>`);
    else html += `\n${SCRIPT}\n`;
  }

  if (html !== before) {
    fs.writeFileSync(fp, html);
    updated += 1;
  }
  report.push({ rel, routeId, links });
}

for (const row of report) {
  console.log(`${row.links} links  ${row.routeId}  ${row.rel}`);
}
console.log(`Done. ${updated} file(s) written, ${report.length} route page(s).`);
