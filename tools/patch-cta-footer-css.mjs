import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, "..", "css", "style.css");
let s = fs.readFileSync(cssPath, "utf8");

const oldCta = `/* CTA Section */
.cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.contact-info {
    margin-top: 2rem;
}`;

const newCta = `/* CTA Section */
.contact-section.cta-section {
    padding-bottom: 60px;
}

.cta-section-description {
    opacity: 0.92;
}

.cta-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    align-items: stretch;
}

.cta-buttons a.btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 22px;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.2s ease;
    min-height: 52px;
    box-sizing: border-box;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}

.cta-buttons a.btn:hover {
    transform: translateY(-2px);
}

.cta-buttons .btn-primary:hover,
.cta-buttons .btn-whatsapp:hover,
.cta-buttons .btn-email:hover {
    transform: translateY(-2px);
}

.cta-buttons .cta-btn-icon,
.cta-buttons .btn-inline-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: block;
}

.cta-buttons .btn-email::before {
    content: none;
    display: none;
}

.contact-info {
    margin-top: 2rem;
}`;

if (!s.includes(oldCta)) {
  throw new Error("CTA block not found");
}
s = s.replace(oldCta, newCta);

s = s.replace(
  /\.section {\s*\n    padding: 4rem 0;/,
  ".section {\n    padding: 4.5rem 0;"
);

s = s.replace(
  /  padding: 0 1\.5rem 0;\s*\n  font-family: 'Inter', sans-serif;\s*\n  position: relative;\s*\n  overflow: hidden;\s*\n}/,
  `  padding: 50px 1.5rem 0;
  font-family: 'Inter', sans-serif;
  position: relative;
  overflow: hidden;
}`
);

s = s.replace(
  /\.footer-grid {\s*\n  display: grid;\s*\n  grid-template-columns: 2fr 1fr 1fr 1fr;\s*\n  gap: 40px;\s*\n  margin-bottom:/,
  `.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  align-items: start;
  margin-bottom:`
);

s = s.replace(
  /\.footer-tagline {\s*\n  font-family: 'Playfair Display', serif;\s*\n  font-size: 1\.05rem;/,
  `.footer-tagline {
  font-family: 'Playfair Display', serif;
  font-size: 1.15rem;`
);

if (!s.includes("line-height: 1.35")) {
  s = s.replace(
    /(\.footer-tagline \{[\s\S]*?letter-spacing: 0\.02em;)\s*\n(\})/,
    "$1\n  line-height: 1.35;\n$2"
  );
}

s = s.replace(
  /\.footer-description {\s*\n  color: rgba\(255, 255, 255, 0\.82\);/,
  `.footer-description {
  color: rgba(255, 255, 255, 0.72);`
);

const oldContact = `.footer-contact-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  margin: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
  color: rgba(255, 255, 255, 0.95) !important;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.footer-contact-row:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(197, 165, 114, 0.35);
  color: #fff !important;
}`;

const newContact = `.footer-contact-row,
.footer .footer-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 14px;
  margin: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  text-decoration: none;
  color: rgba(255, 255, 255, 0.95) !important;
  transition: all 0.2s ease;
}

.footer-contact-row:hover,
.footer .footer-contact-item:hover {
  border-color: #C5A572;
  background: rgba(197, 165, 114, 0.05);
  color: #fff !important;
}`;

if (!s.includes(oldContact)) {
  throw new Error("footer-contact block not found");
}
s = s.replace(oldContact, newContact);

const oldBottom = `.footer-bottom {
  text-align: center;
  margin-top: 0;
  padding: 1rem 1rem 1.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  position: relative;
  z-index: 1;
}

.footer-bottom::before {
  content: "";
  display: block;
  width: min(8rem, 50vw);
  height: 1px;
  margin: 0 auto 0.65rem;
  background: linear-gradient(to right, transparent, rgba(197, 165, 114, 0.65), transparent);
}`;

const newBottom = `.footer-bottom {
  text-align: center;
  margin-top: 40px;
  padding: 20px 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
  opacity: 0.8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  position: relative;
  z-index: 1;
}

.footer-bottom::before {
  display: none;
}`;

if (!s.includes(oldBottom)) {
  throw new Error("footer-bottom block not found");
}
s = s.replace(oldBottom, newBottom);

fs.writeFileSync(cssPath, s);
console.log("css/style.css patched");
