# Destination SEO audit

Website: [spires-taxis.com](https://www.spires-taxis.com)  
Scope: first set of high-intent destination landing pages in `spires-website/`  
Date: 28 September 2026  
Visual standards: follow [VISUAL-UX-AUDIT.md](./VISUAL-UX-AUDIT.md). Do not invent a second design system.

This file is the working record of the destination pages that were added, why they exist, how they are linked, what was deliberately not published, and how to add the next destination without creating doorway pages or keyword cannibalisation.

Do **not** auto-create further destination URLs from the future list at the end. Review those with the business first.

---

## 1. Pages created

| Page | File | Role |
| --- | --- | --- |
| Southampton Cruise Terminal | `oxford-to-southampton-cruise-terminal.html` | Long-distance route: cruise port |
| St Pancras International | `oxford-to-st-pancras-taxi.html` | Long-distance route: station / Eurostar |
| Silverstone Circuit | `oxford-to-silverstone-taxi.html` | Long-distance route: events |
| Cotswolds private tours | `cotswolds-tours-from-oxford.html` | Day hire / private driver, not a guided tour |
| London City Airport | `oxford-to-london-city-airport-taxi.html` | Airport cluster route (same family as Luton/Gatwick) |
| Long distance hub | `long-distance-taxis.html` | Service hub for non-airport longer runs |

No duplicate URLs existed for these five journeys. `/destinations/:path*` still 301s to `/airport-transfers`, so Cotswolds was **not** placed under `/destinations/`.

---

## 2. Final URLs

| Live URL |
| --- |
| https://www.spires-taxis.com/oxford-to-southampton-cruise-terminal |
| https://www.spires-taxis.com/oxford-to-st-pancras-taxi |
| https://www.spires-taxis.com/oxford-to-silverstone-taxi |
| https://www.spires-taxis.com/cotswolds-tours-from-oxford |
| https://www.spires-taxis.com/oxford-to-london-city-airport-taxi |
| https://www.spires-taxis.com/long-distance-taxis |

Canonicals match these paths (no trailing slash). Robots: `index, follow`. No accidental `noindex`.

---

## 3–7. Keywords, titles, descriptions, H1s

### Southampton Cruise Terminal

- **Primary:** Oxford to Southampton cruise terminal taxi
- **Secondary themes covered in natural copy:** cruise port / cruise transfer, door-to-door from Oxford, 8 seater, luggage, returns from the port, ship name, Mayflower / City / Horizon / Ocean / QEII
- **Title:** Oxford to Southampton Cruise Terminal Taxi \| Spires Taxis
- **Meta description:** Pre-booked private hire from Oxford to Southampton cruise terminals. Door-to-door collection, Standard Car or 8 Seater, and returns from the port. Request a fixed quote.
- **H1:** Oxford to Southampton Cruise Terminal taxi

Terminal names checked against current Associated British Ports / Visit Southampton passenger information (five terminals: Western Docks Mayflower, City, Horizon via Dock Gate 10; Eastern Docks Ocean, QEII via Dock Gate 4). Copy tells customers to confirm the terminal on their documents.

### St Pancras / Eurostar

- **Primary:** Oxford to St Pancras taxi
- **Secondary themes:** St Pancras International, Eurostar, UK rail connections, luggage, early starts, 8 seater, St Pancras to Oxford, not King’s Cross
- **Title:** Oxford to St Pancras Taxi & Eurostar Transfers \| Spires Taxis
- **Meta description:** Pre-booked taxi from Oxford to St Pancras International. Door-to-door for Eurostar and UK rail connections, Standard Car or 8 Seater. Request a fixed quote.
- **H1:** Oxford to St Pancras taxi

No official Eurostar check-in time is stated. No Eurostar affiliation is claimed.

### Silverstone Circuit

- **Primary:** Oxford to Silverstone taxi
- **Secondary themes:** Silverstone Circuit, Formula 1 weekends, other motorsport events, group / 8 seater, pre-arranged returns, event traffic, access restrictions
- **Title:** Oxford to Silverstone Taxi \| Spires Taxis
- **Meta description:** Pre-booked taxi from Oxford to Silverstone Circuit. Formula 1 weekends, other motorsport events, Standard Car or 8 Seater, and pre-arranged returns. Request a fixed quote.
- **H1:** Oxford to Silverstone Circuit taxi

No specific gate or pickup point is promised. No Silverstone / Formula 1 affiliation.

### Cotswolds private tours

- **Primary:** Cotswolds private tours from Oxford
- **Secondary themes:** private driver, agreed itinerary, waiting time, Standard Car / 8 seater, Bourton-on-the-Water, Stow-on-the-Wold, Broadway, Chipping Campden, Bibury, return to Oxford or another quoted drop
- **Title:** Cotswolds Private Tours from Oxford \| Spires Taxis
- **Meta description:** Private Cotswolds day hire from Oxford. Your group, an agreed itinerary, Standard Car or 8 Seater, and waiting while you walk around. From £200, confirmed when you book.
- **H1:** Cotswolds private tours from Oxford

This is **private hire with waiting**, not a qualified guided tour. No attraction tickets or partnerships are claimed. Village spellings use hyphenation (Bourton-on-the-Water, Stow-on-the-Wold).

### London City Airport

- **Primary:** Oxford to London City Airport taxi
- **Secondary themes:** LCY, Royal Docks single terminal, business travel, luggage, 8 seater, returns, flight number, flight monitoring on collections
- **Title:** Oxford to London City Airport Taxi \| Spires Taxis
- **Meta description:** Oxford to London City Airport taxi £150 one way or £290 return (Standard Car, up to 4 passengers). Fixed fare, flight monitoring on collections. WhatsApp 07776 897772.
- **H1:** Oxford to London City Airport taxi

Published Oxford fares from `js/airport-prices.js`: Standard Car £150 / £290, 8 Seater £190 / £370. Airport charges included. Flight monitoring is only claimed because it is already the airport-collection process on `/how-airport-pickup-works`.

### Long distance hub

- **Primary:** long distance taxis from Oxford
- **Secondary themes:** how quoting works vs published airport fares, Oxford operator (not destination offices), discovery of the four non-airport destinations plus the airport cluster
- **Title:** Long Distance Taxis from Oxford \| Spires Taxis
- **Meta description:** Pre-booked long distance private hire from Oxford: Southampton cruise terminals, St Pancras, Silverstone, Cotswolds day hire, and airport transfers. Fixed quote before you travel.
- **H1:** Long distance taxis from Oxford

Hub justified because `destinations.html` / station-style stubs already redirect to `/airport-transfers`. A non-airport parent was missing.

---

## 8. Internal links added FROM existing pages

Desktop primary nav was **not** given a destination item (already tight at 390px). Discovery is through the hub, contextual links, footer, sitemap, and the mobile menu.

| Existing page | New links (body / cards, not just chrome) |
| --- | --- |
| `/` | Places we’ve been: London City, Cotswolds, Southampton, St Pancras, Silverstone. What we do card → `/long-distance-taxis`. Airport card copy now includes London City. |
| `/airport-transfers` | Route card → London City (published fares). |
| `/rates` | London City table row. Cotswolds tour from £200. Note pointing cruise / St Pancras / Silverstone quotes to the hub. |
| `/how-airport-pickup-works` | Gatwick/Luton card also links London City. |
| `/our-vehicles` | 8 Seater copy links Southampton and Silverstone. |
| `/about` | London City in airport list. Hub for cruise / St Pancras / Silverstone / Cotswolds. |
| `/corporate-taxis` | London City list item + card. St Pancras for client pickups. |
| `/student-taxis` | St Pancras for Eurostar. |
| `/oxford-taxis` | Hub for longer pre-booked runs. |
| `/contact` | Hub for longer runs. |
| `/reviews` | Hub in service list. |
| Footer (`includes/footer.html`) | Oxford to London City; Long distance from Oxford. |
| Mobile menu (`includes/header.html`) | Long distance → hub. Highlighted via `data-page="long-distance"` on the four non-airport destination pages and the hub. LCY uses `data-page="airport"`. |

Chrome was synced with `scripts/apply-chrome.mjs` after the header/footer change.

---

## 9. Internal links added TO existing pages (from the new pages)

Typical destinations (where relevant, not stuffed):

- `/long-distance-taxis` (parent hub)
- `/airport-transfers`
- `/rates` (no invented fare; or published LCY / Cotswolds guide)
- `/our-vehicles`
- `/how-airport-pickup-works` (flight monitoring vs “we do not track ships”)
- `/contact`
- `/about`
- `/corporate-taxis` (Silverstone groups, LCY accounts)
- `/oxford-to-london-city-airport-taxi` (from Southampton body, to keep airport work in the airport cluster)
- `/oxford-to-heathrow-taxi` (from the hub’s airport cards)

---

## 10. Schema added

Same architecture as Luton/Gatwick: JSON-LD `FAQPage` (visible `<details>` only) plus `@graph` of `BreadcrumbList`, `Service`, and `TaxiService` pointing at `https://www.spires-taxis.com/#taxiservice`.

- Breadcrumbs are **structured only**. No visible breadcrumb bar (removed in the visual audit).
- LCY breadcrumb: Home → Airport transfers → Oxford to London City Airport.
- Other new pages: Home → Long distance taxis → [page]. Hub: Home → Long distance taxis.
- LCY `Service` includes an `Offer` at the published Oxford Standard Car one-way fare (£150). Other routes have **no** invented Offer price.
- Not added: `aggregateRating`, reviews, awards, extra `LocalBusiness` locations, destination offices.

FAQ `Question.name` values match the visible `<summary>` text.

---

## 11. Sitemap / technical

`sitemap.xml` now includes the six URLs (`lastmod` 2026-09-28). `lastmod` also bumped on `/`, `/airport-transfers`, `/rates`, `/how-airport-pickup-works` because those pages gained destination links.

`js/airport-prices.js`: `londonCity.slug` = `/oxford-to-london-city-airport-taxi` so rate-card name links resolve.

`robots.txt` already allows `/` and points at the sitemap. No vercel redirect changes. Existing `/destinations/:path*` 301s left alone.

`scripts/qa-render-shots.mjs` now includes the six new routes for future visual passes. `scripts/qa-dest-pages.mjs` is the focused destination checker.

---

## 12. Pricing / distance / time deliberately omitted

| Topic | Why omitted |
| --- | --- |
| Southampton cruise fare | Not on the rate card or `airport-prices.js`. Copy: request a fixed quote. |
| St Pancras fare | Not a published tariff. The rates “London £120” guide is **not** used as a St Pancras price. |
| Silverstone fare | Not published. Quoted for date, addresses, vehicle, return. |
| Journey times / miles for cruise, St Pancras, Silverstone | Not an established figure in the project. Not invented. |
| Parking charges, waiting-at-port fees, cruise-line check-in windows | Not Spires published data. |
| Eurostar official check-in recommendation | Not verified from an operator source at publish time. |
| Silverstone gate / exact pickup point | Event access changes. |
| Ship tracking | Explicitly **not** claimed. Flight monitoring remains airport-only. |
| Cotswolds hours/miles per village loop | Itinerary is agreed per booking. Guide price only: from £200 (already on `/rates`). |

Verified prices that **were** used:

- London City: Standard Car £150 one way / £290 return; 8 Seater £190 / £370 (`airport-prices.js`).
- Cotswolds tour: from £200 (`rates.html`).
- Hub airport cards: LCY and Heathrow Standard Car figures from the same price file.
- Extra stops £10 and waiting policy only where they already exist on `/rates`.

Nearby-town caveat is repeated: Abingdon, Kidlington and similar pickups are quoted separately.

---

## 13. Keyword cannibalisation checked

| Risk | Decision |
| --- | --- |
| LCY vs `/airport-transfers` | Same pattern as Luton: hub lists all airports; LCY is the route page. Not a duplicate of general “airport taxi Oxford”. |
| LCY vs Heathrow/Gatwick/Luton | Different airport, different corridor (Royal Docks vs M25/M4). |
| St Pancras vs rates “London £120” | Station/Eurostar intent vs generic London guide fare. Page states the London figure is not a St Pancras tariff. |
| St Pancras vs a future “Oxford to London taxi” page | Do **not** create a generic London taxi page; it would fight both rates and St Pancras. |
| Cotswolds vs rates “from £200” | Service/itinerary page vs price-list line. Linked both ways. |
| Cotswolds vs `/destinations/cotswold-tours` | Old path would 301 to airport-transfers. New URL is `/cotswolds-tours-from-oxford`. |
| Southampton cruise vs generic “Oxford to Southampton” | Page is cruise-terminal specific. A city-centre Southampton page was not created. |
| Hub vs the four destination URLs | Hub explains the service and lists journeys; it does not try to rank for “Oxford to Silverstone taxi”. |
| Hub vs `/airport-transfers` | Hub sends airport demand into the airport cluster. LCY lives there, not as the hub’s primary target. |

No page was skipped for cannibalisation. If a later destination would target the same intent as Heathrow, Gatwick, Luton, rates, or airport-transfers, stop and report rather than publishing.

---

## 14. Visual QA (rendered, not inferred)

Rendered at **360 / 390 / 430 / 768 / 1280** with puppeteer-core against `http://localhost:56207`. Chrome (header, footer, WhatsApp float) present on every shot. **No horizontal overflow.** No visible breadcrumb bars. No category eyebrows or trust strips under the heroes. Compact inner hero used.

| Page | 360 | 390 | 430 | 768 | 1280 |
| --- | --- | --- | --- | --- | --- |
| Southampton | Pass. H1 editorial break after “Southampton”; last line can be “taxi”. CTAs in first viewport. | Pass. Same wrap. | Pass. “Cruise Terminal taxi” on one line. | Pass. | Pass. Two-line H1: Oxford to Southampton / Cruise Terminal taxi. |
| St Pancras | Pass. `St Pancras` kept together. H1 + lead + 3 CTAs. | Pass. | Pass. | Pass. | Pass. |
| Silverstone | Pass. Lead shortened so CTAs fit. | Pass. | Pass. | Pass. | Pass. |
| Cotswolds | Pass. | Pass. | Pass. | Pass. | Pass. |
| London City | Pass. `data-page="airport"` highlights Airport transfers. Published fares in lead. | Pass. | Pass. | Pass. | Pass. |
| Hub | Pass. | Pass. Mobile menu includes Long distance (active). | Pass. | Pass. | Pass. Destination cards 2-up. |

WhatsApp float overlaps some in-flow body text at the bottom of the mobile viewport in the same way as the rest of the site (accepted in the visual audit). Footer license line can sit under the control at 1280; unchanged from existing chrome.

Southampton H1 at 360/390: “Cruise Terminal” stays together; “taxi” may sit on the last line. That is preferable to “Cruise” stranded on its own line.

---

## 15. Files changed

### New public pages

- `spires-website/oxford-to-southampton-cruise-terminal.html`
- `spires-website/oxford-to-st-pancras-taxi.html`
- `spires-website/oxford-to-silverstone-taxi.html`
- `spires-website/cotswolds-tours-from-oxford.html`
- `spires-website/oxford-to-london-city-airport-taxi.html`
- `spires-website/long-distance-taxis.html`

### Shared chrome and data

- `spires-website/includes/header.html` (mobile menu: Long distance)
- `spires-website/includes/footer.html` (London City + Long distance)
- `spires-website/js/airport-prices.js` (London City slug)
- `spires-website/sitemap.xml`

### Existing pages given contextual links

- `index.html`
- `airport-transfers.html`
- `rates.html`
- `how-airport-pickup-works.html`
- `our-vehicles.html`
- `about.html`
- `corporate-taxis.html`
- `student-taxis.html`
- `oxford-taxis.html`
- `contact.html`
- `reviews.html`

Apply-chrome also rewrote header/footer markers on the other SITE-HEADER pages (Heathrow, Gatwick, Luton, local towns, 404, terms, and so on) so the mobile menu and footer stay in sync.

### QA helpers

- `spires-website/scripts/qa-dest-pages.mjs`
- `spires-website/scripts/qa-render-shots.mjs` (routes list)

### This document

- `spires-website/DESTINATION-SEO-AUDIT.md`

---

## How to add the next destination page

1. Confirm the URL does not already exist and does not 301 into a competing page.
2. Confirm the search intent is not already owned by `/airport-transfers`, `/rates`, Heathrow/Gatwick/Luton, or one of the pages above.
3. Reuse header, footer, `hero--compact`, buttons, cards, FAQ `<details>`, containers, and schema shape. No new visual language. No visible breadcrumbs.
4. Do not invent fares, miles, minutes, parking, waiting, or discounts. If it is not in `airport-prices.js` or `/rates`, say “request a fixed quote” (or the live Spires wording).
5. Write as Oxford → destination. Do not imply an office at the far end. Do not claim affiliations.
6. Link the new URL from the hub **or** from `/airport-transfers` if it is an airport. Add one or two genuine contextual links from existing pages. Do not add it to desktop primary nav.
7. Add the URL to `sitemap.xml`. If it is a published airport, set `slug` in `airport-prices.js`.
8. Run `node scripts/apply-chrome.mjs` if chrome changed, then render 360/390/430/768/1280 before calling it done.

---

## Future destination opportunities (review only — not created)

These are candidates for a later brief. None of them should be published from this document automatically.

**Airport cluster (would sit with LCY, not the long-distance hub)**

- Dedicated Stansted page (currently rates + airport-transfers only)
- Dedicated Birmingham Airport page
- Dedicated Bristol Airport page
- Southampton **Airport** (SOU) — different intent from the cruise terminals; do not merge with `/oxford-to-southampton-cruise-terminal`

**Rail / coach (watch St Pancras and rates London)**

- Paddington
- Marylebone
- Do **not** build a generic “Oxford to London taxi” page

**Events (same caution as Silverstone: no promised gates)**

- Wembley
- Twickenham
- Ascot
- Cheltenham Festival (distinct from the town of Cheltenham on the homepage list)

**Places already named on the homepage without a landing page**

- Bath, Cambridge, Reading, Cheltenham, Milton Keynes, Swindon
- Portsmouth / ferry (different from Southampton cruise)

**Local attractions**

- Blenheim / Woodstock
- Bicester Village (old `/destinations/attractions/bicester-village` already redirects; a real page would need a unique intent vs `/bicester-taxis`)

Priority should stay with journeys people actually pre-book with luggage, a deadline, or a group, not every town Spires has ever quoted.
