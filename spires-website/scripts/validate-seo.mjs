import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html') && f !== 'nav-snippet.html');
const titles = {};
const descs = {};
const issues = [];

for (const f of files) {
  const h = fs.readFileSync(path.join(root, f), 'utf8');
  const t = h.match(/<title>([^<]*)<\/title>/i)?.[1];
  const d = h.match(/<meta name="description" content="([^"]*)"/i)?.[1];
  const c = h.match(/<link rel="canonical" href="([^"]*)"/i)?.[1];
  const h1s = [...h.matchAll(/<h1[^>]*>([^<]*)</gi)].map((m) => m[1].trim());
  if (t && titles[t]) issues.push(`dup title: ${t} (${f}, ${titles[t]})`);
  if (t) titles[t] = f;
  if (d && descs[d]) issues.push(`dup desc (${f}, ${descs[d]})`);
  if (d) descs[d] = f;
  if (h1s.length !== 1) issues.push(`${f}: ${h1s.length} h1 tags`);
  if (!c) issues.push(`${f}: missing canonical`);
}

console.log(issues.length ? issues.join('\n') : 'OK: unique titles/descriptions, single H1 each');
