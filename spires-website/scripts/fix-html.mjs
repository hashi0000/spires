import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..');

for (const file of readdirSync(root).filter((f) => f.endsWith('.html'))) {
  let html = readFileSync(join(root, file), 'utf8');
  const orig = html;

  // Keep only the last data-page value (prefer airport/home/rates etc. over legacy keys)
  const bodyMatch = html.match(/<body([^>]*)>/i);
  if (bodyMatch) {
    const attrs = bodyMatch[1];
    const pages = [...attrs.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]);
    if (pages.length > 1) {
      const preferred = ['home', 'airport', 'rates', 'about', 'contact', 'reviews'];
      const keep = preferred.find((p) => pages.includes(p)) ?? pages[pages.length - 1];
      const cleaned = attrs.replace(/\s*data-page="[^"]+"/g, '').trim();
      const newAttrs = cleaned ? ` ${cleaned} data-page="${keep}"` : ` data-page="${keep}"`;
      html = html.replace(/<body[^>]*>/i, `<body${newAttrs}>`);
    }
  }

  // Remove orphan closing divs between SITE-HEADER end and <main> or first <section class="hero">
  html = html.replace(
    /<!-- \/SITE-HEADER -->\s*(?:<\/div>\s*)+(?=\s*<(?:main|section))/i,
    '<!-- /SITE-HEADER -->\n\n'
  );

  // Remove legacy mobile nav comment junk after header
  html = html.replace(
    /<!-- \/SITE-HEADER -->\s*<!-- Header -->[\s\S]*?(?=\s*<(?:main|section))/i,
    '<!-- /SITE-HEADER -->\n\n'
  );

  if (html !== orig) {
    writeFileSync(join(root, file), html);
    console.log('fixed:', file);
  }
}
