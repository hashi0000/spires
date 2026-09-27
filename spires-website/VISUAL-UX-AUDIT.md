# Spires Taxis visual design and UX audit

Website: [spires-taxis.com](https://www.spires-taxis.com)  
Scope: public-facing pages in `spires-website/`  
Brand kept: navy `#002147`, white, gold `#b8956a` (the live accent is gold, not red)

This document is the site-wide audit requested before and after the presentation work. It lists every public route reviewed, the problems found, what was changed in the shared system, page-specific edits, what was deliberately left alone, viewport and SEO status, and the files touched.

---

## 1. Public routes reviewed

### Indexed / primary pages

| Route | File | Role |
| --- | --- | --- |
| `/` | `index.html` | Home |
| `/airport-transfers` | `airport-transfers.html` | Commercial — airports |
| `/rates` | `rates.html` | Commercial — pricing |
| `/oxford-to-heathrow-taxi` | `oxford-to-heathrow-taxi.html` | Commercial — Heathrow outbound |
| `/heathrow-to-oxford-taxi` | `heathrow-to-oxford-taxi.html` | Commercial — Heathrow inbound |
| `/oxford-to-gatwick-taxi` | `oxford-to-gatwick-taxi.html` | Commercial — Gatwick |
| `/oxford-to-luton-taxi` | `oxford-to-luton-taxi.html` | Commercial — Luton |
| `/how-airport-pickup-works` | `how-airport-pickup-works.html` | Trust — pickup, tracking, waiting |
| `/student-taxis` | `student-taxis.html` | Commercial — students |
| `/corporate-taxis` | `corporate-taxis.html` | Commercial — business |
| `/our-vehicles` | `our-vehicles.html` | Commercial — fleet |
| `/oxford-taxis` | `oxford-taxis.html` | Local Oxford |
| `/abingdon-taxis` | `abingdon-taxis.html` | Nearby town |
| `/bicester-taxis` | `bicester-taxis.html` | Nearby town |
| `/banbury-to-oxford-taxi` | `banbury-to-oxford-taxi.html` | Nearby town |
| `/contact` | `contact.html` | Booking / contact |
| `/about` | `about.html` | Trust — about |
| `/reviews` | `reviews.html` | Trust — reviews |

### Useful but not in sitemap (or noindex)

| Route | File | Notes |
| --- | --- | --- |
| `/terms-and-conditions` | `terms-and-conditions.html` | Noindex, follow |
| `/offer-terms` | `offer-terms.html` | Offer T&Cs |
| `/thank-you` | `thank-you.html` | Form confirmation, noindex |
| `/404.html` | `404.html` | Not found |
| `/booking` | `booking.html` | Redirect stub to customer portal |

### Redirects / stubs (not designed as standalone pages)

| Route | Redirects to |
| --- | --- |
| `/services`, `/services.html` | `/airport-transfers` |
| `/destinations` | `/airport-transfers` |
| `/airport-taxis-oxford` | `/airport-transfers` |
| `/abingdon-taxi` | `/abingdon-taxis` |
| `/heathrow-airport-taxis` | `/oxford-to-heathrow-taxi` |
| `/gatwick-airport-taxis` | `/oxford-to-gatwick-taxi` |
| `/birmingham-airport-taxis` | `/airport-transfers` |
| `/nav-snippet` | `/` |

### Not a public website page

- `email.html` — HTML email template, left alone
- `includes/header.html`, `includes/footer.html`, `includes/seo-head.html` — shared chrome, not routes

### Routes named in the brief that do not exist as separate URLs

There are no standalone pages for flight tracking, meet and greet, pricing policy, driver standards, safeguarding, accessibility, child seats, or a dedicated FAQ index. That content lives on existing pages, mainly `/how-airport-pickup-works`, `/rates`, `/our-vehicles`, `/about`, and `/terms-and-conditions`.

There are also no dedicated landing pages for Stansted, Birmingham or Bristol. Those airports are covered on `/airport-transfers` and `/rates`.

---

## 2. Main visual problems found

### Opening of inner pages (highest impact)

Inner pages stacked **visible breadcrumbs**, a **category eyebrow that repeated the H1**, then a **large H1**, often with a **template trust strip** immediately below.

Typical example on `/how-airport-pickup-works`:

1. Home / Airport transfers / How airport pickup works  
2. AIRPORT PICKUPS  
3. How airport pickup works with Spires Taxis  

That wasted a large part of the first mobile screen and looked auto-generated.

### Spacing and hierarchy

- Inner heroes used the same large padding as the homepage, so the first screen was mostly heading.
- H1s were too large on phones and wrapped onto ordinary words (`travel.` on its own line on home; long inner titles wrapping awkwardly).
- Section spacing and container widths were inconsistent (`max-width: 42rem` inline vs shared container).
- `.grid` used `auto-fit` / `minmax`, which squeezed cards on ~360px instead of stacking cleanly.
- Step lists used the same auto-fit pattern, so four steps became cramped on desktop and awkward on phones.

### Inconsistent components

- Primary CTAs: `btn--primary`, `btn-primary`, `btn-large`, `btn-email` mixed heights and styles.
- Legal pages (`terms-and-conditions`, `offer-terms`) and `thank-you` still used the old template: emoji card icons, leftover Cinzel/Playfair on thank-you, undefined CSS variables (`--oxford-cream`), and a different footer.
- Trust strips looked like a generic template row (flight monitoring / fixed price / licensed operator) repeated under many heroes.
- 404 had a shortened header and no shared footer or WhatsApp control.

### Mobile

- Breadcrumbs wrapping onto two or three lines.
- Hero button groups sitting in a row on phones (except home, which already stacked).
- Floating WhatsApp button covering footer copyright and, on short first screens, the last lines of hero copy.
- Pricing table last-column `white-space: nowrap` risked horizontal overflow on small phones.

### Amateur / accidental details

- Invalid CSS: `.site-footer__logo { loading: lazy; }`
- Emoji as icons on terms, offer terms, and thank-you
- Empty “section header only” blocks on the legal pages (heading section with no content, then cards in the next section)
- Heathrow page put WhatsApp before Book online, unlike other commercial pages
- Page-specific padding hacks on the Heathrow “route at a glance” block

---

## 3. Shared components and styles changed

All of this lives in `css/style.css` plus shared chrome in `includes/header.html` and `includes/footer.html` (synced with `scripts/apply-chrome.mjs`).

### Design tokens

- `--gutter`, `--space-section`, `--space-hero-home`, `--space-hero-page`
- `--h1-home`, `--h1-page`
- `--measure` (readable line length ~38rem)
- `--touch` (44px minimum control height)

### Layout

- `.container` uses `width: min(100% - 2 * gutter, 1120px)`
- `.container--narrow` for prose-width pages
- Section padding uses `--space-section`
- Inner heroes use `.hero--compact` (tight padding; following section has reduced top padding)
- Homepage keeps `.hero--home` as the only large opening

### Typography

- Page H1: `clamp(1.7rem, 1.2rem + 2.2vw, 2.4rem)`
- Home H1: `clamp(1.8rem, 1.15rem + 2.6vw, 2.95rem)`
- H2 / H3 also clamped
- Headings use `text-wrap: balance` to reduce orphaned last words
- `.hero__lead` and `.prose` capped to `--measure`

### Breadcrumbs and repeating labels

- Visible breadcrumb `<nav class="breadcrumbs">` **removed from HTML**
- JSON-LD `BreadcrumbList` **kept**
- `.hero__label` hidden in CSS as a safety net (markup also stripped)
- `.trust-strip` hidden in CSS as a safety net (markup also stripped)

### Components standardised

- Buttons: `min-height: var(--touch)`, shared radius 10px, legacy `btn-primary` / `btn-large` / `btn-email` aliased to the same system
- Cards: shared padding `1.25rem 1.35rem`, radius `--radius-lg`, `height: 100%`
- Grids: 1 column by default, 2 from 640px, 3/4 from 960px
- Price options and route-glance grids follow the same breakpoint pattern
- Steps: 1 → 2 → 4 columns; stay 1 column inside `.split`
- Forms: inputs/selects `min-height: var(--touch)`
- FAQ summaries: 44px tap target
- Price tables: allow wrapping on small screens; airport table already had overflow-x
- Footer: extra bottom padding on small screens so the WhatsApp float does not cover copyright
- WhatsApp float: 48px on small phones; label text hidden so the circle does not overflow
- `prefers-reduced-motion` already respected for button/card/float motion; left in place

---

## 4. Page-specific changes

Visible breadcrumbs, eyebrows and trust strips were stripped from every page that had them. H1s were shortened only where they repeated the page topic or wrapped badly.

| Page | What changed |
| --- | --- |
| Home | Already had no eyebrow/trust strip. Shared tokens now apply. CTA stack on mobile via shared hero rules. |
| Airport transfers | H1 → “Airport transfers from Oxford”. Breadcrumb/label/trust strip removed. |
| How airport pickup works | H1 → “How airport pickup works”. Breadcrumb/label removed. One H2 shortened to “What we need when you book”. |
| Oxford to Heathrow | H1 title case “Oxford to Heathrow taxi”. CTAs reordered to Book online → WhatsApp → Call. Route-glance padding hack removed. |
| Heathrow to Oxford, Gatwick, Luton | Breadcrumb/label/trust strip removed. Shared hero. |
| Rates | Breadcrumb/label removed. Shared hero. |
| Fleet | H1 → “Vehicles for Oxford airport runs”. |
| Abingdon | H1 → “Oxford to Abingdon taxi from £20”. |
| Bicester | H1 → “Oxford to Bicester taxi from £35”. |
| Student / corporate / Oxford / Banbury / About / Reviews / Contact | Breadcrumb and/or label and trust strip removed. Shared compact hero. |
| Terms | Compact hero, no “Legal Information” eyebrow, emoji icons removed, empty header section merged, navy CTA band using shared buttons, wrapped in `<main>`, shared footer. |
| Offer terms | Same treatment. Airport list is now `card--link` cards without emoji. Undefined `--oxford-cream` box replaced with `.callout`. Luton card now links to `/oxford-to-luton-taxi`. |
| Thank you | Rebuilt on shared header/footer. No emojis, no old fonts, no amateur “What Happens Next?” box. One H1, two CTAs, three contact cards. |
| 404 | Shared header/footer/WhatsApp. Compact hero, no “404” eyebrow. |
| Booking / other stubs | Not redesigned; they only exist to redirect. |

---

## 5. Deliberately not changed (and why)

- **Brand colours.** The brief said navy, white and red. The established site accent is gold. Red was not introduced.
- **URLs, titles, meta descriptions, canonicals, robots, Open Graph, JSON-LD** including `BreadcrumbList`, `FAQPage`, and LocalBusiness/TaxiService where already present.
- **Published Oxford airport fares and the outside-Oxford disclaimer.** Pricing copy is commercial, not decorative.
- **Homepage H1 wording.** It is long, but it is the agreed commercial line. Wrapping is handled with `clamp()` and `text-wrap: balance`, not a rewrite.
- **Reviews page honesty.** No fake testimonials, scores, awards or accreditations were added. Trustpilot/Google/Facebook remain the sources.
- **Long informational copy** on pickup, rates and terms. Presentation changed; content was not cut for length.
- **Email template** (`email.html`). Not a public page.
- **Redirect stubs.** They are not meant to be browsed.
- **New pages** for Stansted, Birmingham, Bristol, safeguarding, child seats, etc. Those URLs do not exist; inventing them would be a content/SEO project, not a visual tidy.
- **Heavy animation libraries.** None added.
- **WhatsApp float itself.** It will always cover a small corner of the viewport. Footer clearance was added; the control was not removed because it is a primary contact path.

---

## 6. Viewport review

Checked in the in-editor browser against the local static server.

| Viewport | What was reviewed | Result |
| --- | --- | --- |
| ~390px mobile | Home and How airport pickup works, plus overflow measurement | No horizontal overflow. Breadcrumbs/eyebrows gone. CTAs stack full-width. Header shows logo + menu. H1 on pickup stays one line. |
| ~360–430px | Shared CSS is mobile-first (1-col grids, stacked hero buttons, gutters via `--gutter`). Pickup page overflow at 391px: `scrollWidth` matched `innerWidth`. | System is built for these widths. Not every URL was screenshot at 360/375/412/430. |
| Tablet (~768) | Tokens/grids switch to 2 columns at 640px. | CSS reviewed; not every page screenshot. |
| Desktop (~1280+) | Pickup page screenshot after changes: compact hero, no breadcrumb/eyebrow, shared header. Steps use 2 columns until 1100px, then 4. | Coherent with the rest of the system. |

Remaining visual risk: the WhatsApp control still sits over the last lines of copy while you are mid-page (normal for a FAB). Footer copyright has extra padding on small screens so it is not covered at the end of the page.

---

## 7. SEO metadata, schema and content

Preserved:

- Existing URLs and `vercel.json` redirects
- Page `<title>` and meta descriptions
- Canonicals
- `robots` (including noindex on terms, thank-you, 404, booking stubs)
- Open Graph / Twitter image tags
- JSON-LD `BreadcrumbList` on commercial and trust pages
- FAQ schema on How airport pickup works
- Internal links and airport/location relevance
- One H1 per real page
- Visible body copy (nothing hidden with CSS for SEO)

Visible breadcrumb navigation was removed; structured breadcrumbs remain in JSON-LD.

H1 wording was tightened only where it duplicated the eyebrow or added a needless “with Spires Taxis” / “with fixed pricing” tail. Titles and meta tags were not rewritten.

---

## 8. Files changed

### Shared

- `spires-website/css/style.css`
- `spires-website/includes/header.html` (via chrome sync on pages)
- `spires-website/includes/footer.html` (via chrome sync on pages)
- `spires-website/scripts/apply-chrome.mjs` (existing; run to sync chrome)
- `spires-website/scripts/visual-cleanup.mjs` (one-off strip of breadcrumbs/labels/trust strips)
- `spires-website/scripts/qa-visual-html.mjs` (H1 / leftover-chrome check)
- `spires-website/scripts/find-local-server.mjs` (local QA helper)
- `spires-website/scripts/qa-render-shots.mjs` (Chrome first-viewport captures)
- `spires-website/.gitignore` (ignore local `qa-shots/`)

### Public HTML

- `index.html`
- `airport-transfers.html`
- `rates.html`
- `how-airport-pickup-works.html`
- `oxford-to-heathrow-taxi.html`
- `heathrow-to-oxford-taxi.html`
- `oxford-to-gatwick-taxi.html`
- `oxford-to-luton-taxi.html`
- `our-vehicles.html`
- `student-taxis.html`
- `corporate-taxis.html`
- `oxford-taxis.html`
- `abingdon-taxis.html`
- `bicester-taxis.html`
- `banbury-to-oxford-taxi.html`
- `contact.html`
- `about.html`
- `reviews.html`
- `terms-and-conditions.html`
- `offer-terms.html`
- `thank-you.html`
- `404.html`

### This report

- `spires-website/VISUAL-UX-AUDIT.md`

---

## Final rendered-page QA

Method: every primary route was loaded in headless Chrome against the local static server, not inferred from CSS. First-viewport JPEGs were saved for **22 routes × 5 widths** (360 / 390 / 430 / 768 / 1280). Extra shots: homepage H1 at 375 and 412; mobile menu open/closed at 390; homepage footer at 360/390; rates fare cards and local table at 360/390/430; contact form at 360/390/768; vehicle and review mid-page cards.

PASS in the table means that viewport’s rendered screenshot was opened and judged. Automated metrics on the same runs: **no page-level horizontal overflow**, **no stranded H1 last line under 96px**, **no WhatsApp overlap** against headings, buttons, form controls, or footer licence/link boxes after the spacing fixes.

Home H1 extra widths (not in the main columns): **375 PASS**, **412 PASS** — last line stays `before you travel.`

### Viewport matrix

| Route | 360 | 390 | 430 | 768 | 1280 | Issues found | Issues fixed | Remaining concerns |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | PASS | PASS | PASS | PASS | PASS | H1 last-word orphan with `text-wrap: balance`; redundant airport eyebrow; FAB sat on mid-page copy | Bound `before you travel.`; pretty wrap; right-hand FAB gutter; footer clearance | FAB still sits in the margin beside late-page copy, not on controls |
| `/airport-transfers` | PASS | PASS | PASS | PASS | PASS | First viewport was usable; FAB near trailing lines | Shared FAB/gutter/menu fixes | None material |
| `/rates` | PASS | PASS | PASS | PASS | PASS | Fuel notice dominated first screen; local table could scroll the page; FAB on table at 768 | Notice moved below fares; table in `.table-scroll`; cards at ≤720px | Vehicle example line still wraps to `or similar` in two-column cards |
| `/oxford-to-heathrow-taxi` | PASS | PASS | PASS | PASS | PASS | Glance card sat under FAB on small phones | Gutter + FAB size | Glance grid has an empty cell beside 8 Seater prices on desktop |
| `/heathrow-to-oxford-taxi` | PASS | PASS | PASS | PASS | PASS | Same chrome issues as other airport pages | Shared fixes | Cross-link “outbound?” can wrap onto its own line |
| `/oxford-to-gatwick-taxi` | PASS | PASS | PASS | PASS | PASS | First viewport cropped the fare callout under the FAB | Gutter increased; first screen now H1 + fare + CTAs + copy | None material |
| `/oxford-to-luton-taxi` | PASS | PASS | PASS | PASS | PASS | Inline `h2` margin leftover | Replaced with shared `.included-list + h2` rule | H1 wraps “Airport taxi” on the second line — readable |
| `/how-airport-pickup-works` | PASS | PASS | PASS | PASS | PASS | List flush against following paragraph; FAB on last sentence | Prose list spacing; FAB gutter | Last bullet can wrap “on the day” alone |
| `/student-taxis` | PASS | PASS | PASS | PASS | PASS | H1 wrap; `data-page` already local | `Student taxis in Oxford` bound earlier | Prose-led layout by design |
| `/corporate-taxis` | PASS | PASS | PASS | PASS | PASS | Desktop nav highlighted About; long H1 | `data-page="corporate"`; H1 tightened earlier | None material |
| `/our-vehicles` | PASS | PASS | PASS | PASS | PASS | Repeated Toyota copy; disclaimer only in first card; inline heading size; stretched empty card | Copy tightened; disclaimer under grid; card height auto | 8 Seater card is still denser than Standard Car |
| `/oxford-taxis` | PASS | PASS | PASS | PASS | PASS | About highlighted in nav | `data-page="local"` | None material |
| `/abingdon-taxis` | PASS | PASS | PASS | PASS | PASS | About highlighted in nav | `data-page="local"` | None material |
| `/bicester-taxis` | PASS | PASS | PASS | PASS | PASS | About highlighted in nav | `data-page="local"` | None material |
| `/banbury-to-oxford-taxi` | PASS | PASS | PASS | PASS | PASS | About highlighted in nav | `data-page="local"` | None material |
| `/contact` | PASS | PASS | PASS | PASS | PASS | Form card started at opacity 0; screenshot scroll hid fields under header | Fade-in exception; `scroll-margin-top`; FAB gutter beside inputs | Form sits below contact cards on tablet — correct, not first-viewport |
| `/about` | PASS | PASS | PASS | PASS | PASS | Long H1; a forced line-break made 390 worse | Left natural wrap (break experiment reverted) | At 390, line two can end on “does a” |
| `/reviews` | PASS | PASS | PASS | PASS | PASS | “Why this page looks different” callout; Trustpilot eyebrow | Callout removed; H1 “Customer reviews” | Trustpilot embed is an empty branded box until the live widget loads |
| `/terms-and-conditions` | PASS | PASS | PASS | PASS | PASS | Inline list styles | Shared card lists | Legal cards of unequal length (expected) |
| `/offer-terms` | PASS | PASS | PASS | PASS | PASS | Inline list styles; short vs long sibling cards | Shared card lists | Eligibility card has leftover height vs “How to claim” |
| `/thank-you` | PASS | PASS | PASS | PASS | PASS | Short confirmation; FAB near contact cards | Shared gutter | None material |
| `/404.html` | PASS | PASS | PASS | PASS | PASS | Footer tagline and Useful Links sat under the FAB because `.site-footer__grid { padding }` wiped the container gutter | Footer `padding-right` restored up to 1360px | Short page shows footer in the first screen — acceptable for 404 |

### Mobile menu (opened at 390)

Opened, closed, and re-shot. Panel is full viewport width (390×844). All ten links plus Call / WhatsApp / Book online stay on screen. Body is locked; the floating WhatsApp control is hidden while the menu is open. Link spacing is tight enough to avoid clipping Contact.

### WhatsApp control

Size on small screens is 48px, offset `0.9rem` / `0.7rem`. Main and footer now keep a right gutter so the control does not cover fares, form fields, or the licence line. It remains visible and tappable. It will still occupy the bottom-right corner; surrounding copy is indented instead of hidden.

### Totals

| | |
| --- | --- |
| Pages actually rendered | **22** |
| Viewport combinations actually inspected | **110** (22 × 5), plus homepage **375** and **412**, plus menu/form/footer/fare extras |
| Problems discovered on this second pass | Footer padding shorthand cancelled the FAB gutter (404/desktop footer links covered); rates first viewport was a fuel notice; home H1 orphan; contact form fade-in; vehicle card repetition and stretched empty space; pickup list flush to the next paragraph; Luton inline heading; nav `data-page` pointing at About on local/corporate pages; menu clipping Contact; left-shifted mobile gutter that looked broken |
| Problems fixed | All of the above that a customer would read as a mistake |
| Still needing human judgement | Live Trustpilot widget on production; whether the About H1 should be shortened; whether fare cards should drop “or similar” onto one line at 360; unequal-height legal cards on offer-terms |

---

## Residual QA notes

Highest-value checks on the live domain:

1. Confirm the Trustpilot widget fills on https://www.spires-taxis.com/reviews (local screenshots only show the fallback lockup).
2. Thumb-test the WhatsApp control on a real iPhone over the contact form and the rates cards.
3. Decide whether the About H1 should be shortened; a forced line break at 390 made the wrap worse, so it was left natural.
