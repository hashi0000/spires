const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'spires-website');
const airport = '<li>For flight monitored airport terminal collection, 60 minutes are included from verified actual landing. Additional waiting is £5 per started 15 minutes. Flight delays before landing do not use this allowance.</li><li>For fixed time collection, including airport hotels unless otherwise agreed, 15 minutes are included from the booked clock time, then £5 per started 15 minutes. Flight monitoring and automatic adjustment for early or late flights are not included. Earlier collection or rescheduling is subject to availability. You must contact us promptly if delayed.</li><li>The airport waiting timer stops when you call or message Spires or your assigned driver to confirm that your whole group and luggage are ready at the agreed collection point. We record that contact time, not when the driver later enters it. Time caused by our driver is not charged.</li><li>Your booking and confirmation state your selected arrangement and rate. Please review and acknowledge these before submitting. Previously accepted bookings keep their agreed terms.</li>';
let html = fs.readFileSync(path.join(site, 'terms-and-conditions.html'), 'utf8');
html = html.replaceAll('2026-10-25', '2026-11-15');
html = html.replace(/<li>Airport collections include[\s\S]*?<\/li>/, airport);
const timed = '<section class="terms-section"><h2>Cotswolds and timed private hire</h2><p>Your quote states the agreed start time, total duration, itinerary, final drop off and fare. Time includes all driving, visits, meals, shopping and passenger delays from the agreed collection until final drop off. Driver travel to collect you is excluded. If our driver is late, the included finishing time moves back accordingly. A four hour booking is total hire, not four hours at attractions.</p><p>Additional time is £10 per started 20 minutes per vehicle for Standard, Executive and 8 Seater. 1 to 20 extra minutes costs £10, 21 to 40 costs £20 and 41 to 60 costs £30. Extended visits and passenger lateness count. Extensions and itinerary changes are subject to availability. Any additional mileage charge is explained before agreeing a route change. A reminder does not replace or suspend the charges agreed at booking.</p><p>Normal congestion, known roadworks and known events are allowed for in itinerary planning. Extra time caused solely by unexpected accidents, unplanned road closures, emergency diversions or severe weather disruption is recorded and excluded after review. Separately identifiable passenger delays remain chargeable. We may discuss changing the remaining itinerary if disruption affects the day.</p><p>This is private car and driver hire without guided commentary. Attraction tickets, food and drinks are excluded. Parking and other journey charges are stated in the quote. Existing accepted bookings retain their agreed prices and terms.</p></section>';
html = html.replace('</main>', timed + '\n</main>');
fs.writeFileSync(path.join(site, 'terms-and-conditions.html'), html);
fs.writeFileSync(path.join(site, 'terms/2026-11-15.html'), html.replace('href="https://www.spires-taxis.com/terms-and-conditions"', 'href="https://www.spires-taxis.com/terms/2026-11-15"'));
const targets = [
  'functions/src/terms/bookingTerms.ts', 'spires-admin-fresh/src/utils/bookingTerms.ts',
  'customer-app/src/bookingTerms.js', 'customer-app/src/terms.js', 'customer-app/src/termsConfig.js',
  'spires-website/contact.html', 'spires-website/js/guest-booking.js', 'spires-website/terms-accept.html',
];
for (const target of targets) {
  const file = path.join(root, target);
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8').replaceAll('2026-10-25', '2026-11-15');
  if (target.endsWith('bookingTerms.ts') || target.endsWith('bookingTerms.js')) {
    text = text.replace('if (version === CURRENT_BOOKING_TERMS.version)', 'if (version === "2026-10-25") return "https://www.spires-taxis.com/terms/2026-10-25";\n  if (version === CURRENT_BOOKING_TERMS.version)');
  }
  fs.writeFileSync(file, text);
}
