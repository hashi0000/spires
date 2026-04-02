import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PHONE_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.21z"/></svg>`;
const WA_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.403"/></svg>`;
const EMAIL_SVG = `<svg class="cta-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
const PHONE_SVG_BTN = `<svg class="btn-inline-icon cta-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.21z"/></svg>`;
const CTA = `<!-- CALL TO ACTION -->
<section class="section contact-section cta-section">
  <div class="container text-center">
    <div class="section-subtitle">Ready to Travel?</div>
    <h2 class="section-title">Book Your Journey Today</h2>
    <p class="section-description cta-section-description" style="max-width: 600px; margin: 0 auto 2rem;">
      Reliable, professional, and <strong>available 24/7</strong> - including early mornings, late nights, weekends, and holidays. Contact us now for premium taxi services in Oxford and beyond.
    </p>
    <div class="cta-buttons">
      <a href="tel:+447776897772" class="btn btn-primary btn-large">${PHONE_SVG_BTN}<span>Call 07776 897772</span></a>
      <a href="https://wa.me/447776897772?text=Hi,%20I'd%20like%20to%20book%20a%20taxi%20please" class="btn btn-whatsapp btn-large">
        <svg class="cta-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.403"/></svg>
        <span>WhatsApp Us</span>
      </a>
      <a href="mailto:bookings@spires-taxis.com" class="btn btn-email btn-large">${EMAIL_SVG}<span>Email Us</span></a>
    </div>
  </div>
</section>
<!-- FOOTER -->
<footer class="footer">
  <div class="footer-container">
    <div class="footer-grid">
      <div class="footer-col footer-brand">
        <h4 class="footer-logo">Spires Taxis</h4>
        <p class="footer-tagline">Oxford's Newest Premium Taxi Service</p>
        <p class="footer-description">Professional, reliable service with Oxford's traditional values of quality and attention to detail.</p>
        <div class="footer-contact">
          <a class="footer-contact-row footer-contact-item" href="tel:+447776897772"><span class="contact-icon contact-icon--phone" aria-hidden="true">${PHONE_SVG}</span><span class="contact-text"><span class="contact-label">Phone</span><span class="contact-value">07776 897772</span></span></a>
          <a class="footer-contact-row footer-contact-item" href="https://wa.me/447776897772?text=Hello%2C%20I%27d%20like%20to%20book%20a%20taxi%20please" target="_blank" rel="noopener noreferrer"><span class="contact-icon contact-icon--whatsapp" aria-hidden="true">${WA_SVG}</span><span class="contact-text"><span class="contact-label">WhatsApp</span><span class="contact-value">07776 897772</span></span></a>
          <a class="footer-contact-row footer-contact-item footer-contact-row--email" href="mailto:bookings@spires-taxis.com"><span class="contact-icon contact-icon--email" aria-hidden="true">${EMAIL_SVG.replace(' class="cta-btn-icon"','')}</span><span class="contact-text"><span class="contact-label">Email</span><span class="contact-value">bookings@spires-taxis.com</span></span></a>
        </div>
      </div>
      <div class="footer-col"><h4 class="footer-heading">Services</h4><ul><li><a href="./airport-transfers.html">Airport Transfers</a></li><li><a href="./student-taxis.html">Student Discounts</a></li><li><a href="./corporate-taxis.html">Corporate Travel</a></li><li><a href="./oxford-taxis.html">Local Oxford</a></li></ul></div>
      <div class="footer-col"><h4 class="footer-heading">Popular Destinations</h4><ul><li><a href="./heathrow-airport-taxis.html">Heathrow Airport</a></li><li><a href="./gatwick-airport-taxis.html">Gatwick Airport</a></li><li><a href="./birmingham-airport-taxis.html">Birmingham Airport</a></li><li><a href="./oxford-taxis.html">Oxford Taxis</a></li><li><a href="./abingdon-taxis.html">Abingdon Taxis</a></li><li><a href="./bicester-taxis.html">Bicester Taxis</a></li></ul></div>
      <div class="footer-col"><h4 class="footer-heading">Information</h4><ul><li><a href="./rates.html">Rates &amp; Pricing</a></li><li><a href="./contact.html">Contact Us</a></li><li><a href="./offer-terms.html">Offer Terms &amp; Conditions</a></li><li><a href="./terms-and-conditions.html">Terms &amp; Conditions</a></li><li><a href="#" class="availability-badge">24/7 Available</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copyright">&copy; 2026 Spires Taxis Oxford. All rights reserved.</p>
      <p class="license-info">Licensed Private Hire Vehicle Operator &bull; Oxford City Council</p>
    </div>
  </div>
</footer>
`;
const indexPath = path.join(root, "index.html");
let index = fs.readFileSync(indexPath, "utf8").replace(/\r\n/g, "\n");
const s = index.indexOf("<!-- CALL TO ACTION -->");
const e = index.indexOf("<!-- Floating WhatsApp Button -->");
if (s < 0 || e < 0) throw new Error("markers");
index = index.slice(0, s) + CTA + "\n\n" + index.slice(e);
fs.writeFileSync(indexPath, index);
console.log("index ok");
