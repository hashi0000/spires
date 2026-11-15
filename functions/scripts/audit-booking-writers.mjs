/**
 * Classifies booking document writes in the functions source.
 * A nearby revision token means the write advances the booking revision.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "src");
const rows = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) scan(full);
  }
}

function scan(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/\.(update|set)\(/.test(line) && !/tx\.update\(/.test(line) && !/tx\.set\(/.test(line)) return;
    const window = lines.slice(Math.max(0, index - 25), Math.min(lines.length, index + 12)).join("\n");
    const mentionsBooking = /bookings/.test(window) || /bookingRef/.test(window) || /doc\.ref/.test(line);
    if (!mentionsBooking) return;
    const share = file.includes(`${path.sep}spiresShare${path.sep}`);
    const hasRevision = /revision/.test(window);
    const kind = share ? "Admin SDK, Share collection, separate from taxi booking revision" : "Admin SDK";
    rows.push({
      file: path.relative(root, file).replaceAll("\\", "/"),
      line: index + 1,
      kind,
      revision: hasRevision ? "advances revision" : "no revision in the surrounding write",
    });
  });
}

walk(root);
const missing = rows.filter((row) => row.revision.startsWith("no") && !row.kind.includes("Share"));
console.log(JSON.stringify({ writes: rows.length, missingRevision: missing, sample: rows }, null, 2));
if (missing.length) process.exitCode = 2;
