const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../spires-website');
const airport = 'Flight monitored collection includes 60 minutes from verified actual landing, then £5 per started 15 minutes. Fixed time collection includes 15 minutes from the booked clock time, then the same rate; flight monitoring and automatic adjustment are not included. Your waiting timer stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point. We do not charge for delays caused by our driver. Your confirmation states the arrangement you selected.';
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'scripts', 'terms', 'qa-shots'].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { walk(file); continue; }
    if (!item.name.endsWith('.html')) continue;
    let html = fs.readFileSync(file, 'utf8');
    // Replace complete policy paragraphs, preserving unrelated fares and travel times.
    html = html.replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/g, (whole, tag, attrs, inner) => {
      if (/50(?:\s|&nbsp;|-)+(?:minute|minutes)/i.test(inner) && /waiting|collection|landing/i.test(inner)) return `<${tag}${attrs}>${airport}</${tag}>`;
      return whole;
    });
    if (item.name === 'rates.html') {
      html = html.replace('Half day (4 hours): £150', 'Cotswolds Standard Car, 4 hours total hire: £180').replace('Full day (8 hours): £280', 'Cotswolds Standard Car, 8 hours total hire: £340').replace('Cotswolds tour</a>: from £200', 'Cotswolds trip</a>: from £180').replace('Hourly rate: from £35 per hour', 'Cotswolds additional time: £10 per started 20 minutes for all vehicle categories');
    }
    if (item.name === 'terms-and-conditions.html') html = html.replace('1 April 2026', '15 November 2026 for new agreements').replace('25 October 2026', '15 November 2026');
    fs.writeFileSync(file, html);
  }
}
walk(root);
const termsPath = path.join(root, 'terms/2026-11-15.html');
let terms = fs.readFileSync(termsPath, 'utf8').replace('1 April 2026', '15 November 2026 for new agreements').replace('25 October 2026', '15 November 2026');
fs.writeFileSync(termsPath, terms);
