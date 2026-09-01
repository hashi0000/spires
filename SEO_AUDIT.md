# Spires Taxis SEO audit

**Site audited:** https://www.spires-taxis.com  
**Codebase:** `spires-website/` (static HTML on Vercel; `cleanUrls: true`, no trailing slash)  
**Primary commercial query:** Oxford to Heathrow taxi  
**Date:** 1 September 2026

This audit describes the **current** implementation. It does not assume more content is the answer. Several technical SEO items (canonicals, unique titles, sitemap generation, IndexNow, 404, cache headers) are already in place and should be left alone unless a finding says otherwise.

---

## Architecture (do not treat as a JS SPA)

The public marketing site is **server-rendered static HTML**. Crawlers do not need JavaScript to see fares, copy, or links. `js/airport-prices.js` can rewrite displayed Heathrow figures to the same published numbers already in HTML. Booking lives on **https://customer.spires-taxis.com** (separate app). Firebase/admin are not part of this Vercel site.

There is **no blog**. There is **no programmatic generator** of postcode, OX1/OX2, Headington, or Cowley landing pages.

---

## Phase 1 — Public route map

### INDEX (in `sitemap.xml`, `index,follow`)

| URL | File | Intent |
| --- | --- | --- |
| `/` | `index.html` | Brand / local private hire home |
| `/oxford-to-heathrow-taxi` | `oxford-to-heathrow-taxi.html` | **Primary money page:** Oxford → Heathrow |
| `/heathrow-to-oxford-taxi` | `heathrow-to-oxford-taxi.html` | Arrivals: Heathrow → Oxford |
| `/airport-transfers` | `airport-transfers.html` | Hub: all airports from Oxford |
| `/oxford-to-gatwick-taxi` | `oxford-to-gatwick-taxi.html` | Oxford → Gatwick |
| `/oxford-to-luton-taxi` | `oxford-to-luton-taxi.html` | Oxford → Luton |
| `/how-airport-pickup-works` | `how-airport-pickup-works.html` | Arrivals process (meet, flight tracking) |
| `/rates` | `rates.html` | Price list (all airports + local + extras) |
| `/our-vehicles` | `our-vehicles.html` | RAV4 / Vito capacity |
| `/oxford-taxis` | `oxford-taxis.html` | Local Oxford journeys |
| `/abingdon-taxis` | `abingdon-taxis.html` | Abingdon local + airport connect |
| `/bicester-taxis` | `bicester-taxis.html` | Bicester / Village |
| `/banbury-to-oxford-taxi` | `banbury-to-oxford-taxi.html` | Banbury ↔ Oxford |
| `/student-taxis` | `student-taxis.html` | Students / term / luggage |
| `/corporate-taxis` | `corporate-taxis.html` | Accounts / business |
| `/reviews` | `reviews.html` | Trustpilot + Google/Facebook links |
| `/about` | `about.html` | Operator, licensing, how they work |
| `/contact` | `contact.html` | Call / WhatsApp / email / form |
| `/terms-and-conditions` | `terms-and-conditions.html` | Legal |
| `/offer-terms` | `offer-terms.html` | £5-off portal offer terms |

### NOINDEX / not in sitemap (correct)

| URL | Status | Notes |
| --- | --- | --- |
| `/404` custom | `noindex` | Vercel 404 page |
| `/booking` | `noindex` + 301 to customer app | |
| `/email` | `noindex,nofollow` + robots Disallow | B2B page, not for search |
| `/thank-you` | `noindex,nofollow` | |
| `/services`, `/destinations`, `/airport-taxis-oxford`, `/abingdon-taxi`, `/heathrow-airport-taxis`, `/gatwick-airport-taxis`, `/birmingham-airport-taxis` | `noindex` + meta refresh + canonical to live URL + Vercel 301 | Redirect stubs |

### Dynamically generated routes

**None** on the marketing site. No city/postcode template loop.

### Chrome, metadata, crawl files

- **Canonicals:** present and unique on indexable pages; HTTPS www.
- **Open Graph / Twitter:** PNG OG image `android-chrome-512x512.png` (512×512). Most pages lack `twitter:description` (see LOW). Twitter tags do not affect Google ranking.
- **JSON-LD:** TaxiService `@id` `https://www.spires-taxis.com/#taxiservice`. Organization defined fully on the homepage. FAQPage used where visible `<details>` exist on several pages.
- **Visible breadcrumbs:** present on the Heathrow page and most inner pages.
- **Nav:** desktop = Home, Airport transfers, Rates, Reviews, About, Contact + phone + Book online. **Oxford to Heathrow is only in the mobile menu and footer**, not desktop nav.
- **Footer:** includes Oxford to Heathrow, Heathrow to Oxford, Gatwick, Luton, pickup guide, rates, vehicles.
- **Images:** logo SVG; one rates table PNG with width/height and lazy load. **No real vehicle photographs in the repo.**
- **Lazy load:** footer logo and rates PNG. Hero logo is not lazy (correct).
- **Redirects:** apex → www 301; several legacy paths in `vercel.json`.
- **robots.txt:** allows `/`, CSS, JS, images; disallows booking/email/admin/scripts; declares sitemap.
- **IndexNow:** public key file at site root (`3f569e285f8a4c30a76a5971841458d5.txt`); submit via `npm run indexnow`.
- **Cache:** HTML/sitemap/robots `max-age=0, must-revalidate`.

---

## Findings

Severity: **CRITICAL** / **HIGH** / **MEDIUM** / **LOW** / **NO ACTION REQUIRED**.

---

### H1 — Heathrow money page answers the query, but the “glance” is scattered

**Severity:** HIGH  
**Affected:** `/oxford-to-heathrow-taxi`

**Current implementation:** Strong commercial page. Unique title `Oxford to Heathrow Taxi | Fixed Price Airport Transfer`. Single H1. Return-booking prices are explicit: £87 / £110 per leg, £174 / £220 both legs, one-way as Quote. Distance (45–50 miles) and 60–90 minutes sit in a later section. Terminals sit further down. Vehicle names (Toyota RAV4, Mercedes Vito) sit in the vehicles section. The page does **not** invent a one-way fare.

**Problem:** Someone searching “Oxford to Heathrow taxi” can get the answer, but not “within seconds” in one block. They must scan hero → trust strip → four price cards → then journey/terminals.

**Why it matters:** This is the primary commercial landing page. Clarity at the top beats extra paragraphs.

**Recommended solution:** Add a compact **Route at a glance** block immediately under the trust strip (route, distance, typical time, terminals, vehicles, return totals, one-way = get a quote, CTAs). Do not replace existing price cards or FAQs.

**Risk:** Low–medium visual change on an indexed money page. Additive and reversible. Does not change URL, title, or pricing logic.

---

### H2 — Heathrow → Oxford title and H1 still lead with “from £87”

**Severity:** HIGH  
**Affected:** `/heathrow-to-oxford-taxi`

**Current implementation:** Title and OG title: `Heathrow to Oxford Taxi from £87 | Spires Taxis`. H1: `Heathrow to Oxford — from £87 return booking`. Body copy does explain return-booking vs one-way.

**Problem:** SERP snippet can be read as a one-way £87 fare — the exact confusion the Oxford→Heathrow page already works hard to avoid.

**Why it matters:** Competes with the outbound page for overlapping queries (“Oxford Heathrow taxi”) while sending a muddier price signal.

**Recommended solution (approval required):** Align title/H1/description with the outbound page pattern, e.g. emphasise arrivals, flight tracking and return-booking, without “from £87” as the headline claim. Keep unique arrivals content (meet & greet, terminals table, colleges/hotels). Do not duplicate the outbound page and reverse the words.

**Risk:** Medium. Title/H1 change on an indexed URL. Google may take time to recrawl. Do not ship without approval.

---

### H3 — Desktop navigation omits the primary money page

**Severity:** HIGH  
**Affected:** `includes/header.html` (all pages using SITE-HEADER); desktop `.site-nav`

**Current implementation:** Oxford to Heathrow is in the mobile drawer and footer only.

**Problem:** The most important commercial URL is not in the main crawl path from every desktop page. Internal PageRank-style equity is weaker than it should be.

**Why it matters:** Google uses internal links as relevance and importance signals. Users on desktop cannot reach Heathrow from the primary nav.

**Recommended solution (approval required):** Add one desktop item, e.g. “Heathrow”, pointing to `/oxford-to-heathrow-taxi`, without stuffing “Oxford to Heathrow taxi” on every page. Keep the current six-item set if adding an item would wrap badly — in that case swap a lower-value item (Reviews can stay in footer/mobile).

**Risk:** Medium. Sitewide layout. Test at 1024px and 1280px before shipping.

---

### H4 — No analytics or conversion events on the marketing site

**Severity:** HIGH  
**Affected:** All `spires-website` HTML; booking is off-site

**Current implementation:** No Google Analytics, GTM, or gtag in this codebase. Call/WhatsApp/book links are plain `tel:`, `wa.me`, and `customer.spires-taxis.com`. Search Console is not implemented in HTML (verification is typically DNS or a meta tag in GSC — not present here).

**Problem:** You cannot measure Heathrow landing visits vs call clicks vs WhatsApp vs booking starts from this site.

**Why it matters:** Ranking without measurement makes the next SEO round guesswork.

**Recommended solution (approval required):** Add GA4 (or GTM) with events for `tel:` clicks, WhatsApp clicks, and outbound booking clicks. Use one measurement ID supplied by you. Do not put secrets in the repo; a public GA4 ID is normal.

**Risk:** Medium. Third-party script affects INP/privacy. Needs a measurement ID and a cookie/privacy decision.

---

### H5 — “Photos coming soon” on commercial pages

**Severity:** MEDIUM (copy) — **implemented as low-risk removal in this pass**  
**Affected:** `/oxford-to-heathrow-taxi`, `/our-vehicles`

**Current implementation:** Heathrow page: “Vehicle photos are being added to the site.” Vehicles page: “Photos coming soon.”

**Problem:** Explicitly forbidden customer-facing placeholder. It also signals an unfinished business.

**Why it matters:** Trust and conversion. No SEO benefit.

**Recommended solution:** Remove the callouts. Keep capacity copy. Add real photos later with width/height, WebP, lazy load below the fold, and natural alt text. Do not invent images.

**Risk:** Low. Copy deletion only.

---

### H6 — Content cannibalisation among airport URLs

**Severity:** MEDIUM  
**Affected:** `/oxford-to-heathrow-taxi`, `/heathrow-to-oxford-taxi`, `/airport-transfers`, `/rates`, `/oxford-taxis`, `/`

**Current implementation:** Distinct URLs with overlapping Heathrow price mentions (“from £87”) on home, rates, airport hub, local Oxford, Abingdon, Bicester, student, corporate.

**Problem:** Google may split “Oxford to Heathrow taxi” / “Oxford airport taxi” / “Oxford airport transfers” across several URLs. The outbound Heathrow page is the right primary target; others should **support** it, not rank as alternatives.

**Why it matters:** Diluted ranking for the money query.

**Recommended solution:** Do **not** merge or delete pages. Tighten supporting pages so they link to `/oxford-to-heathrow-taxi` for route detail and keep their own intent (hub, price list, local, arrivals). Review the Heathrow→Oxford title (H2). No new location pages.

**Risk:** Medium if titles on supporting pages are rewritten. Leave URLs unchanged.

**Intent map (keep all):**

| Query family | Primary URL | Supporting |
| --- | --- | --- |
| Oxford to Heathrow taxi / Oxford Heathrow taxi / taxi Oxford to Heathrow | `/oxford-to-heathrow-taxi` | Home, rates, airport-transfers |
| Heathrow to Oxford taxi | `/heathrow-to-oxford-taxi` | Pickup guide |
| Oxford airport transfers / airport taxi Oxford | `/airport-transfers` | Rates, home |
| Price-led “Heathrow from £87” | `/rates` + Heathrow page | Do not create a third price URL |

---

### H7 — `/offer-terms` is still indexable after the sitewide offer banner was removed

**Severity:** MEDIUM  
**Affected:** `/offer-terms`, sitemap

**Current implementation:** Indexable, in sitemap, describes a £5-off airport return offer via the customer portal. Banner was removed sitewide.

**Problem:** If the offer is withdrawn, this page is leftover commercial/legal content competing for crawl attention and possibly confusing users.

**Why it matters:** Thin or obsolete indexed pages waste crawl budget and can mismatch ads/snippets.

**Recommended solution (approval required):** Confirm whether the portal offer is live. If yes: INDEX, keep. If no: `noindex` and remove from sitemap (do not 404 immediately if people still have the link).

**Risk:** Medium. Indexing change.

---

### H8 — Waiting-time wording is inconsistent

**Severity:** MEDIUM  
**Affected:** `/airport-transfers` (meta + body: **60 minutes** after landing); `/rates` (allowance + £25/hour extra); `/how-airport-pickup-works` and Heathrow pages (“standard allowance”); `terms-and-conditions` (5–10 minutes at pickup — different context)

**Problem:** Airport transfers states a specific 60-minute arrivals wait. Other pages stay vague. Terms mention 5–10 minutes for general pickup.

**Why it matters:** Trust and possible rich-result mismatch. Not a ranking lever by itself.

**Recommended solution (approval required):** Confirm the operational rule, then use the **same** phrase on airport pages. Do not invent a number if 60 minutes is wrong.

**Risk:** Medium. This is a business-policy statement.

---

### H9 — Reviews: genuine, but Google is a search link, not a profile

**Severity:** MEDIUM  
**Affected:** `/reviews`, `/oxford-to-heathrow-taxi` Trustpilot widget

**Current implementation:** No fake AggregateRating. Trustpilot widget + links. Google CTA is `google.com/maps/search/?api=1&query=Spires+Taxis+Oxford` (search), not a Business Profile write-review URL. Heathrow page embeds a Trustpilot widget **without** the Trustpilot bootstrap script used on `/reviews` (falls back to a text link — acceptable).

**Problem:** Google reviews are harder to leave than they should be. Do not hardcode star ratings.

**Why it matters:** Local pack trust. Conversion on the money page.

**Recommended solution (approval required):** Supply the official Google review / GBP URL. Add it on `/reviews` and a single line on the Heathrow reviews section. Keep Trustpilot. No review gating.

**Risk:** Low once the URL is known. Wrong URL is worse than a search link.

---

### H10 — Legal / entity name “Spires Taxis Ltd” is unused

**Severity:** MEDIUM  
**Affected:** Sitewide identity, JSON-LD Organization on `/`

**Current implementation:** Public name is **Spires Taxis**. Footer: licensed Oxford City Council private hire. About: honest note that the operator licence number is not published yet. Phone `07776 897772` / `+447776897772` and `bookings@spires-taxis.com` are consistent. No street address in schema (locality Oxford only).

**Problem:** Google’s local entity is stronger with legal name, licence number, and a consistent GBP NAP. Ltd never appears.

**Why it matters:** Local SEO / Knowledge Panel, not keyword ranking.

**Recommended solution (needs facts from you):** Optional `legalName` in Organization schema and a one-line About/footer “Spires Taxis Ltd” **only if that is the trading/legal name you want public**. Add operator licence number when confirmed. Do not invent an address.

**Risk:** Medium. NAP mismatch with GBP if wrong.

---

### H11 — No conversion measurement; CTAs themselves are sound

**Severity:** LOW (UX) / see H4 for tracking  
**Affected:** `/oxford-to-heathrow-taxi` and global chrome

**Current implementation:** Hero and mid-page: WhatsApp quote, Call, Book online. Sticky WhatsApp FAB sitewide. Mobile menu repeats Call / WhatsApp / Book. No popups.

**Problem:** Three equally weighted buttons in the hero. WhatsApp is often the fastest quote path; Book online is the account path. Not broken.

**Why it matters:** Conversion, not crawl.

**Recommended solution:** Optional: on the Heathrow page only, make WhatsApp the primary and Book/Call secondary — **approval** (design). Do not add popups or a second sticky bar.

**Risk:** Low–medium visual.

**NO ACTION REQUIRED** on booking URLs, Firebase, or `customer.spires-taxis.com`.

---

### H12 — Performance: fonts and third parties, not huge images

**Severity:** MEDIUM (performance)  
**Affected:** All pages; `/reviews` Trustpilot; `/rates` PNG

**Current implementation:** Two Google Fonts families (DM Sans + Source Serif 4) loaded from fonts.googleapis.com (render-blocking CSS). `main.js` is small and deferred. No GA. Rates image has dimensions. Fade-in CSS can start at `opacity: 0` until JS (prefers-reduced-motion respected). WhatsApp FAB is CSS/SVG.

**Problem:** LCP on text-hero pages is likely the H1/font, not a giant photo. CLS risk is low without ads. Trustpilot on `/reviews` is the main third party.

**Why it matters:** Core Web Vitals are a light ranking factor; usability matters more here.

**Recommended solution:** Do not self-host fonts or strip the design in this pass. Optional later: `media="print" onload` pattern or fewer weights. Do not add Trustpilot JS to every page.

**Risk:** Medium if fonts are changed (brand look).

---

### H13 — JSON-LD is valid but incomplete as a local entity graph

**Severity:** LOW  
**Affected:** Inner pages referencing `#organization` without repeating the full Organization node; Offer schema on Heathrow uses price `87` with a correct description that it is return-booking per leg.

**Problem:** Google can still connect `@id`s. Missing street address and legal name (H10). Offer price without `priceSpecification` nuance can still be misread as a one-way fare in some tools — visible HTML is clearer than schema.

**Why it matters:** Rich results / entity, secondary to visible copy.

**Recommended solution:** Do **not** rebuild schema architecture in this pass. After approval: add `legalName` / licence on homepage Organization only. Do not add AggregateRating.

**Risk:** Medium if schema architecture is rewritten (user instruction: review first).

---

### L1 — Missing `twitter:description` on most pages

**Severity:** LOW  
**Affected:** Almost all HTML except Heathrow, offer-terms, terms

**Why it matters:** Social sharing only. Google uses title + meta description.

**Recommended solution:** No action for Google SEO. Optional copy from `og:description` later.

**Risk:** None.

---

### L2 — Homepage popular-routes grid only shows Heathrow and Gatwick

**Severity:** LOW  
**Affected:** `/` `#popular-airport-routes`

**Current implementation:** Two cards (Heathrow, Gatwick) in a three-column grid. Luton exists as a dedicated page and is linked from airport-transfers and footer.

**Recommended solution:** Optional third card to Luton. Not required for the Heathrow query.

**Risk:** Low.

---

### L3 — Heathrow Trustpilot widget without bootstrap script

**Severity:** LOW  
**Affected:** `/oxford-to-heathrow-taxi` reviews section

**Current implementation:** Widget markup + plain Trustpilot link. Script is only on `/reviews`.

**Recommended solution:** Keep the text link (works without JS). Do not load Trustpilot sitewide. Optional: one line linking to `/reviews`.

**Risk:** Low. Adding the script is a performance trade-off.

---

### N1 — Technical SEO baseline

**Severity:** NO ACTION REQUIRED  
**Affected:** Indexable HTML

Unique titles and descriptions on indexable pages, one H1 each, canonicals on www, robots allow CSS/JS, sitemap generated from indexable files with file `lastmod`, no invented changefreq/priority, 404 `noindex`, redirect stubs `noindex`, no client-side-only fares, no index.html duplicate in sitemap, no programmatic thin location pages.

Do not “fix” these because a crawler tool wants more meta tags.

---

### N2 — Do not create OX1 / Headington / Cowley Heathrow clones

**Severity:** NO ACTION REQUIRED (do not build)

No generator exists. Do not add one. Distinct value would require real pickup constraints (college access, station, hospital), not a find-and-replace town name.

---

## Sitemap quality classification

| URL | Class | Reasoning |
| --- | --- | --- |
| `/` | INDEX | Home |
| `/oxford-to-heathrow-taxi` | INDEX | Primary money page |
| `/heathrow-to-oxford-taxi` | INDEX | Distinct arrivals intent |
| `/airport-transfers` | INDEX | Airport hub |
| `/oxford-to-gatwick-taxi` | INDEX | Distinct airport |
| `/oxford-to-luton-taxi` | INDEX | Distinct airport |
| `/how-airport-pickup-works` | INDEX | Process page supporting arrivals |
| `/rates` | INDEX | Price list |
| `/our-vehicles` | INDEX | Fleet / luggage |
| `/oxford-taxis` | INDEX | Local (not Heathrow) |
| `/abingdon-taxis` | INDEX | Town page with unique £20 fare |
| `/bicester-taxis` | INDEX | Town / Village |
| `/banbury-to-oxford-taxi` | INDEX | Distinct corridor |
| `/student-taxis` | INDEX | Audience page |
| `/corporate-taxis` | INDEX | Audience page |
| `/reviews` | INDEX | Trust |
| `/about` | INDEX | Entity |
| `/contact` | INDEX | Conversion |
| `/terms-and-conditions` | INDEX | Legal (normal for a hire operator) |
| `/offer-terms` | **REVIEW** | Offer may be obsolete (H7) |
| Redirect stubs, `/email`, `/thank-you`, `/booking`, `/404` | NOINDEX / REMOVE FROM SITEMAP | Already excluded |

Do not auto-delete any INDEX page.

---

## Conversion path (Oxford to Heathrow)

A visitor can Call, WhatsApp, or Book. Email and `/contact` are available. The WhatsApp FAB is always present. Primary route is obvious enough; tracking is the gap (H4).

---

## What should stay untouched

- URL `/oxford-to-heathrow-taxi`
- Published Heathrow return-booking figures (£87 / £110 / £174 / £220) unless you change prices
- One-way as quote, not a invented fare
- Booking domain and Firebase/customer app
- FAQ answers that match visible `<details>`
- No fake reviews, ratings, awards, or journey counts
- No new programmatic location pages
- Redirect map in `vercel.json` unless a specific 404 is proven
