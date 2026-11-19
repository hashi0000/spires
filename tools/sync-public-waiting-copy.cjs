const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const website = path.join(root, 'spires-website');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'service-policy.json'), 'utf8'));
const flight = policy.airport.flightFreeMinutes;
const fixed = policy.airport.fixedFreeMinutes;
const charge = policy.airport.chargePounds;
const block = policy.airport.blockMinutes;
const airport = `Flight monitored collection includes ${flight} minutes from verified actual landing, then £${charge} per started ${block} minutes. Fixed time collection includes ${fixed} minutes from the booked clock time, then the same rate; flight monitoring and automatic adjustment are not included. Your waiting timer stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point. We do not charge for delays caused by our driver. Your confirmation states the arrangement you selected.`;
const OLD_PARAGRAPHS = [
  /Flight monitored collection includes 60 minutes from verified actual landing, then £5 per started 15 minutes\. Fixed time collection includes 15 minutes from the booked clock time, then the same rate; flight monitoring and automatic adjustment are not included\. Your waiting timer stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point\. We do not charge for delays caused by our driver\. Your confirmation states the arrangement you selected\./g,
  /Flight monitored collection includes 50 minutes from verified actual landing, then £5 per started 15 minutes\. Fixed time collection includes 15 minutes from the booked clock time, then the same rate; flight monitoring and automatic adjustment are not included\. Your waiting timer stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point\. We do not charge for delays caused by our driver\. Your confirmation states the arrangement you selected\./g,
];
const LEGACY_FAQ = /We monitor your flight and allow 50 minutes from the actual landing time for you to clear immigration, collect your luggage and let us know you are ready\. Your driver will then make their way to the airport pickup point\. If you are not ready within 50 minutes of landing, waiting time is charged at £10 per additional 30 minutes or part thereof(\.?)/g;
const FAQ_REPLACEMENT = `We monitor your flight and allow ${flight} minutes from the actual landing time for you to clear immigration, collect your luggage and let us know you are ready. Your driver will then make their way to the airport pickup point. If you are not ready within ${flight} minutes of landing, waiting time is charged at £${charge} per started ${block} minutes$1`;

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'scripts', 'qa-shots'].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { walk(file); continue; }
    if (!item.name.endsWith('.html') && !item.name.endsWith('.js')) continue;
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    for (const pattern of OLD_PARAGRAPHS) html = html.replace(pattern, airport);
    html = html.replace(LEGACY_FAQ, FAQ_REPLACEMENT);
    if (html !== before) fs.writeFileSync(file, html);
  }
}
walk(website);
