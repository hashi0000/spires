# Spires Taxis SEO audit

**Site:** https://www.spires-taxis.com  
**Codebase:** `spires-website/` (static HTML on Vercel; `cleanUrls: true`, no trailing slash)  
**Booking app:** https://customer.spires-taxis.com (separate; not this Vercel site)  
**Date:** 4 September 2026  
**Live HTTP sampled:** 4 September 2026

This audit uses **real Google Search Console figures** supplied for this review plus live headers and the current HTML. It does not assume more content is the answer. Google already associates Spires with Oxford → Heathrow. The problem is **ranking position** (typically 20–70+), not missing keywords and not 0% CTR at those positions.

A previous audit (1 September 2026) already added the Heathrow **Route at a glance** block, removed “photos coming soon”, and linked `/reviews` to Heathrow. Those remain. This document is the current state, not a request to redo that work.

---

## Architecture (do not treat as a React SPA)

The marketing site is **static HTML**. Crawlers see fares, copy, and links without JavaScript. `js/airport-prices.js` can rewrite displayed Heathrow figures to the same published numbers already in HTML. Firebase/admin are out of scope for this Vercel site.

There is **no blog**. There is **no programmatic generator** of OX1/OX2, Headington, Cowley, or postcode landing pages. Do not create them.

---

## 1. Google Search Console evidence

### Queries (as supplied)

| Query | Clicks | Impressions | Approx. avg position |
| --- | ---: | ---: | ---: |
| spire taxis | 4 | 89 | — |
| taxi companies in oxford | 2 | 5 | — |
| airport transfers oxford to heathrow | 1 | 4 | 17.75 |
| oxford to heathrow taxi | 0 | 138 | 43.26 |
| taxi oxford to heathrow | 0 | 94 | 25.89 |
| airport taxis oxford | 0 | 34 | — |
| oxford taxi to heathrow | 0 | 33 | 25.55 |
| airport taxi oxford to heathrow | 0 | 29 | 36.69 |
| taxi oxford prices | 0 | 26 | — |
| taxi in oxford england | 0 | 25 | — |
| oxford to heathrow taxi price | 0 | ~25 | 41.76 |
| oxford to heathrow airport taxi | 0 | ~25 | 77.92 |
| taxis oxford to heathrow | 0 | ~24 | 21.00 |

**Conclusion:** Relevance is established. Several Heathrow queries already sit around positions **21–43**. CTR near zero at those positions is expected. Do not “fix CTR” by stuffing titles.

### Pages (as supplied)

| Page | Impressions | Clicks | Approx. avg position |
| --- | ---: | ---: | ---: |
| `/oxford-to-heathrow-taxi` | ~175 | 0 | **68.09** |
| `/rates` | ~364 | 0 | **25.43** |
| `/about` | ~197 | 1 | **11.55** |
| `/services` | ~153 | 1 | **8.12** |
| `/our-vehicles` | ~22 | 1 | **5.59** |

**Conclusion:** The domain *can* rank around positions 5–12. The Heathrow URL is the weak page, not the whole site. `/services` in GSC is **not** the current live document (see §4).

### Devices (as supplied)

| Device | Clicks | Impressions | CTR | Avg position |
| --- | ---: | ---: | ---: | ---: |
| Mobile | 76 | 746 | 10.19% | 11.4 |
| Desktop | 43 | 1,898 | 2.27% | 34.66 |

Different query mixes (brand/local vs competitive airport) explain much of this. HTML content is not swapped by device (see §10).

### Hostnames (historical GSC)

www homepage ~75 clicks / 1,745 imp / pos 23.2; apex homepage ~37 clicks / 155 imp / pos 7.53. Live consolidation is already correct (see §5).

---

## 2. Heathrow ranking diagnosis

**Affected:** `/oxford-to-heathrow-taxi`

**Current implementation:** Unique title `Oxford to Heathrow Taxi | Fixed Price Airport Transfer`. Single H1. Canonical www HTTPS. Indexable. In sitemap. Route at a glance under the trust strip (distance, 60–90 minutes, T2–T5, RAV4 £174/£87, Vito £220/£110, per vehicle, one-way = quote). Price cards, terminals, FAQs, BreadcrumbList + Service + TaxiService + FAQPage. Footer + mobile nav + homepage card + rates table all link here.

**Evidence:** Page average position **68** vs several Heathrow *queries* at **21–43**. That gap means Google often ranks a **different Spires URL** for those queries. The dedicated page is not the consistent winner.

**Problem (ranked, not guessed):**

1. **Mixed ranking / cannibalisation of *signals*, not duplicate 200 pages.** Homepage, `/rates`, `/airport-transfers`, and `/heathrow-to-oxford-taxi` all talk about Heathrow and £87. Google has not fully assigned the query family to the dedicated URL.
2. **Desktop main nav omits Heathrow** (`includes/header.html`). Mobile drawer includes it. Sitewide crawl path from every desktop page is weaker than for Rates/About.
3. **External authority** from Oxford colleges, student housing, and local organisations cannot be manufactured in this repo. Competitors with those links will keep positions 1–10 until Spires earns equivalent mentions. The page must still be the obvious on-site answer.
4. **Age and competition.** Positions 20–70 on “Oxford to Heathrow taxi” is a national-comparison SERP. Technical cleanliness will not by itself produce page one.

**What is *not* the problem:** Missing the phrase “Oxford to Heathrow taxi” (title and H1 already use it). Thin on-page answers (the glance and FAQs already answer the nine customer questions). 0% CTR at position 68. Need for another landing page.

**Why it matters:** This is the primary commercial URL. Until Google consistently selects it, extra paragraphs will not move the query.

**Recommended solution:** Keep this URL. Add a desktop nav item (approval). Use GSC to list competing Spires URLs per query. Do not rewrite the page into an article. Do not change the title without a documented SERP test. Earn links to this URL (best target for partners).

**Expected SEO benefit:** Better chance that query-level positions 21–43 consolidate onto this URL rather than remaining split. Unlikely to jump to page one from code alone.

**Risk:** Low if we do not change the URL or pricing. Medium if we change title/H1.

**Safe now?** Glance/pricing already shipped. Desktop nav — **not** without layout approval.

---

## 3. Keyword-to-URL cannibalisation

See `KEYWORD_TO_URL_MAP.md`.

**Genuine cannibalisation?** **Yes, as mixed ranking — not as two indexable copies of the same page.** Live site has one canonical Heathrow money URL. Supporting pages correctly exist. Google’s query-to-page assignment is still messy, which is why the dedicated page’s average position is worse than several query averages.

Do **not** delete `/rates`, `/airport-transfers`, or `/heathrow-to-oxford-taxi`.

---

## 4. Legacy `.html` URLs and `/services`

Live headers, 4 September 2026 (no follow):

| Request | Status | Location |
| --- | --- | --- |
| `/rates` | 200 | — |
| `/rates.html` | **308** | `/rates` |
| `/services` | **301** | `/airport-transfers` |
| `/services.html` | **308** | `/services` (then 301 to `/airport-transfers`) |
| `/oxford-to-heathrow-taxi.html` | **308** | `/oxford-to-heathrow-taxi` |

**Current implementation:** Vercel `cleanUrls` 308s `.html` → clean path. `vercel.json` 301s `/services` → `/airport-transfers`. Stub HTML is `noindex` + meta refresh + canonical to the live URL.

**Problem:** `/services.html` is a **two-hop chain** (308 then 301). `/rates.html` is a **single hop** to the live page. There are **no duplicate 200 documents**.

**GSC `/services` ~position 8:** Treat as **historical (or redirect attribution)** for the old services URL, not proof that a live `/services` page still ranks. The current equivalent is `/airport-transfers`. Do not rewrite a stub. Do not recreate `/services` as indexable.

**Why it matters:** Chains slow consolidation slightly. Duplicate 200s would be CRITICAL; they do not exist.

**Recommended solution:** Optional (approval): add an explicit `301 /services.html → /airport-transfers` in `vercel.json` so Vercel redirects run before `cleanUrls` and skip the hop. Leave `/rates.html` as the 308 from `cleanUrls`.

**Expected benefit:** Marginal crawl hygiene.

**Risk:** Low–medium (touches a historically indexed path).

**Safe now?** Documented only — **not implemented** (indexed-URL redirect).

**Verdict:** `/rates.html` and `/services.html` are **not a current duplicate-content problem**. They are historical GSC rows plus correct redirects. `/services.html` chain is a small remaining hygiene item.

---

## 5. WWW vs non-WWW

Live headers:

| Request | Status | Location |
| --- | --- | --- |
| `https://www.spires-taxis.com/` | 200 | — |
| `https://spires-taxis.com/` | **301** | `https://www.spires-taxis.com/` |
| `http://www.spires-taxis.com/` | **308** | `https://www.spires-taxis.com/` |
| `http://spires-taxis.com/` | **308** | `https://spires-taxis.com/` (then 301 to www) |

Canonicals, sitemap, robots sitemap line, Open Graph URLs use **https://www.spires-taxis.com**.

**Intended hostname:** `https://www.spires-taxis.com`

**Problem:** HTTP apex is a two-hop chain (platform HTTPS upgrade on the same host, then apex→www). Normal for Vercel. Historical GSC for both hostnames is expected.

**Verdict: NO ACTION REQUIRED** for hostname policy. Do not change canonicals.

**HTTP apex chain:** LOW / leave unless Vercel ever supports collapsing it.

---

## 6. Technical SEO

### Phase 1 — Public route inventory

#### INDEX (sitemap, `index,follow`)

| URL | File | Intent |
| --- | --- | --- |
| `/` | `index.html` | Brand / local private hire |
| `/oxford-to-heathrow-taxi` | `oxford-to-heathrow-taxi.html` | **Primary:** Oxford → Heathrow |
| `/heathrow-to-oxford-taxi` | `heathrow-to-oxford-taxi.html` | Arrivals: Heathrow → Oxford |
| `/airport-transfers` | `airport-transfers.html` | All airports from Oxford |
| `/oxford-to-gatwick-taxi` | `oxford-to-gatwick-taxi.html` | Oxford → Gatwick |
| `/oxford-to-luton-taxi` | `oxford-to-luton-taxi.html` | Oxford → Luton |
| `/how-airport-pickup-works` | `how-airport-pickup-works.html` | Arrivals process |
| `/rates` | `rates.html` | Full price list |
| `/our-vehicles` | `our-vehicles.html` | RAV4 / Vito |
| `/oxford-taxis` | `oxford-taxis.html` | Local Oxford |
| `/abingdon-taxis` | `abingdon-taxis.html` | Abingdon |
| `/bicester-taxis` | `bicester-taxis.html` | Bicester |
| `/banbury-to-oxford-taxi` | `banbury-to-oxford-taxi.html` | Banbury ↔ Oxford |
| `/student-taxis` | `student-taxis.html` | Students |
| `/corporate-taxis` | `corporate-taxis.html` | Business / accounts |
| `/reviews` | `reviews.html` | Trustpilot + Google/Facebook links |
| `/about` | `about.html` | Operator / licensing |
| `/contact` | `contact.html` | Call / WhatsApp / form |
| `/terms-and-conditions` | `terms-and-conditions.html` | Legal |
| `/offer-terms` | `offer-terms.html` | Portal offer terms (**still indexed**) |

#### NOINDEX / not in sitemap (correct unless noted)

| URL | Status | Notes |
| --- | --- | --- |
| Custom 404 | `noindex` | |
| `/booking` | `noindex` + 301 to customer app | |
| `/email` | `noindex,nofollow` + robots Disallow | |
| `/thank-you` | `noindex,nofollow` | Still loads legacy `navigation.js` — not a ranking page |
| `/services`, `/destinations`, `/airport-taxis-oxford`, `/abingdon-taxi`, `/heathrow-airport-taxis`, `/gatwick-airport-taxis`, `/birmingham-airport-taxis` | `noindex` stubs + Vercel 301 | |

#### Was 200 without noindex (fixed in this pass)

| URL | Finding | Action |
| --- | --- | --- |
| `/nav-snippet` | Live **200** HTML fragment, no robots meta, not in sitemap | **Implemented:** robots `Disallow: /nav-snippet`; Vercel **301 → /** |

Titles are unique across indexable HTML. Each indexable page has one H1, a canonical on www, and `robots` index,follow (except stubs/utility).

**Trailing slash:** `trailingSlash: false`. Consistent.

**Programmatic SEO:** none. Do not add OX1–OX4 or neighbourhood templates.

---

## Findings by severity

### CRITICAL

None on the live marketing site. No duplicate 200 copies of `/rates` or `/services`. No accidental sitewide noindex. No fake AggregateRating. Booking/Firebase not broken by this site’s SEO layer.

---

### HIGH — Mixed ranking for Heathrow queries vs dedicated page

Covered in §2. **Safe now?** Diagnosis only.

---

### HIGH — Desktop navigation omits `/oxford-to-heathrow-taxi`

**Affected:** `includes/header.html` and the inlined `SITE-HEADER` on each page (chrome is copied, not SSI).

**Current:** Desktop `.site-nav`: Home, Airport transfers, Rates, Reviews, About, Contact. Heathrow is in the **mobile** drawer and **footer** only. CSS hides `.site-nav` below 900px; it does not remove Heathrow from the HTML on desktop — Heathrow was never in the desktop list.

**Evidence:** Source of `includes/header.html` vs `site-menu__links`.

**Problem:** Weakest sitewide internal link to the money page on the default desktop crawl path.

**Why it matters:** Internal links are an importance signal. Desktop users cannot reach Heathrow from the primary nav.

**Recommended solution (approval):** Add “Heathrow” → `/oxford-to-heathrow-taxi`. Do not use exact-match “Oxford to Heathrow taxi” in the nav. Test wrapping at 1024px and 1280px. If it wraps, swap Reviews to footer-only.

**Expected benefit:** Stronger internal authority to the URL Google should rank.

**Risk:** Medium (sitewide chrome).

**Safe now?** **No** — layout change.

---

### HIGH — `/heathrow-to-oxford-taxi` title and H1 still “from £87”

**Affected:** `/heathrow-to-oxford-taxi`

**Current:** Title `Heathrow to Oxford Taxi from £87 | Spires Taxis`. H1 `Heathrow to Oxford — from £87 return booking`. Body does explain return-booking vs one-way.

**Problem:** SERP can be read as a one-way £87 fare. Overlaps outbound Heathrow queries.

**Recommended solution (approval):** Align with outbound pattern: arrivals, flight tracking, return-booking — without “from £87” as the headline. Keep unique arrivals content.

**Risk:** Medium (indexed title).

**Safe now?** **No**.

---

### HIGH — No analytics on the marketing site

**Affected:** All `spires-website` HTML.

**Current:** No GA4, GTM, or gtag. Call/WhatsApp/book are plain links. GSC is used externally (not a meta tag in HTML).

**Problem:** Cannot measure Heathrow visits vs tel vs WhatsApp vs booking starts.

**Recommended solution (approval):** GA4 or GTM with events for `tel:`, WhatsApp, and `customer.spires-taxis.com`. Needs a measurement ID and a cookie/privacy decision.

**Risk:** Medium (third-party script, INP, privacy).

**Safe now?** **No**.

---

### HIGH — Waiting-time copy still disagrees (fact, not SEO copy)

**Affected:** `/airport-transfers` still states **60 minutes** after landing in the meta description and body. Heathrow page, rates, and pickup guide say **“standard allowance”**. Terms still mention **5–10 minutes** at pickup locations.

**Problem:** Conflicting claims harm trust and can confuse rich results. This audit will **not** pick a number.

**Recommended solution (approval):** One published rule, then align meta, body, FAQs, and terms.

**Risk:** Medium (customer-facing policy).

**Safe now?** **No**.

---

### MEDIUM — `/offer-terms` remains indexable

**Affected:** `/offer-terms` — 200, in sitemap, `index,follow`.

**Problem:** If the £5 portal offer is finished, this wastes crawl and can look stale.

**Recommended solution (approval):** Confirm whether the offer is live. If not: `noindex` and drop from sitemap. Do not 404 if customers still use the link.

**Safe now?** **No**.

---

### MEDIUM — Google review link is a Maps search, not a GBP short URL

**Affected:** `/reviews`

**Current:** `https://www.google.com/maps/search/?api=1&query=Spires+Taxis+Oxford`. Trustpilot and Facebook also linked. No star count hardcoded. No AggregateRating.

**Problem:** Weaker entity `sameAs` than a stable GBP/review URL.

**Recommended solution (approval):** Official Google Business Profile review URL when you have it. Homepage Organization `sameAs` currently lists Trustpilot and Facebook only.

**Safe now?** **No** (needs the real URL).

---

### MEDIUM — `/services.html` redirect chain

See §4. Optional Vercel 301 skip-hop. **Not implemented.**

---

### MEDIUM — Sitemap `lastmod` dates

**Current:** Many sitemap lastmods are `2026-08-23` even though Heathrow HTML was edited later. `scripts/generate-sitemap.mjs` uses file mtime at **build** time on Vercel, so production lastmod should refresh on deploy. The committed `sitemap.xml` in git can lag.

**Recommended:** Rely on Vercel `npm run build`; optionally regenerate locally before commit. Not a ranking lever.

**Safe now?** Optional; not required for this audit.

---

### LOW — `/nav-snippet` was a public 200 fragment

**Was:** Live 200, no noindex.  
**Implemented:** robots Disallow + 301 to `/`.  
**Risk:** Low.

---

### LOW — Missing `twitter:description` on some pages; OG image 512×512

Twitter tags do not affect Google ranking. Leave unless touching social cards anyway.

---

### LOW — Visible breadcrumbs missing on some local pages

JSON-LD BreadcrumbList exists on several local/route pages without a visible `<nav class="breadcrumbs">`. Not a ranking emergency. Optional consistency.

---

### LOW — `thank-you.html` legacy nav + `navigation.js`

Page is noindex. `js/navigation.js` still contains old `/pages/` and `/destinations/` links **if** it injects (it only injects when a header has no `<nav>`). Thank-you already has a `<nav>`, so injection should not run. Cleanup later; do not treat as a ranking issue.

---

### NO ACTION REQUIRED

| Item | Why |
| --- | --- |
| Unique titles / H1s / canonicals on indexable pages | Already unique and www HTTPS |
| Apex → www 301 | Working |
| `/rates.html` 308 | Working; historical GSC only |
| `/services` 301 to hub | Working; do not restore |
| robots.txt sitemap + Allow CSS/JS | Adequate |
| No OX1–OX4 generator | Correct — do not add |
| Heathrow one-way as Quote | Correct — do not invent a fare |
| No fake reviews / AggregateRating | Correct |
| `/about`, `/our-vehicles` | Relatively strong GSC positions — do not rewrite |
| Mobile vs desktop HTML split | Nav CSS hide only; same main content |
| Creating another Oxford→Heathrow URL | Would worsen cannibalisation |

---

## 7. Structured data

**Current:** Homepage defines Organization + WebSite + TaxiService (`#taxiservice`, `#organization`). Route pages reference TaxiService by `@id` and add Service + FAQPage + BreadcrumbList where FAQs exist. Offers on Heathrow use £87 / £110 with explicit “per vehicle, per leg, return booking” descriptions.

**Problem:** None critical. Do not add Review/AggregateRating. Do not invent a street address (schema uses Oxford / Oxfordshire / GB only).

**Optional (approval):** Add GBP URL to `sameAs` when known; TaxiService `legalName` “Spires Taxis Ltd” if you confirm public use.

**Safe now?** Leave schema architecture.

---

## 8. Internal linking

**To `/oxford-to-heathrow-taxi`:** Footer (every chrome page), mobile menu, homepage card, rates table + footer, airport-transfers card, student/corporate/oxford/abingdon/bicester cards, vehicles, pickup guide, arrivals page, reviews useful-links, 404. **Not** in desktop main nav.

**Anchors:** Mix of “Oxford to Heathrow”, “Oxford to Heathrow taxi”, “Heathrow”. Not stuffed on every paragraph.

**Gap:** Desktop nav (HIGH, approval).

**Do not:** Add dozens of exact-match footer clones.

**Best external link target:** `/oxford-to-heathrow-taxi` for airport partners; `/` or `/about` for general Oxford mentions.

---

## 9. Rates page opportunity

**Affected:** `/rates` — title `Taxi Prices Oxford | Fixed Rates | Spires Taxis`, H1 `Taxi prices from Oxford`. ~364 impressions, position ~25.

**Current:** Airport table including Heathrow From £87 / £110 with return-booking explanation; link to `/oxford-to-heathrow-taxi`. Local and extras. FAQPage. One-way not invented.

**Problem:** Strong impressions, 0 clicks — consistent with average position ~25, not a broken snippet. Some Heathrow *price* queries may land here instead of the route page (medium overlap, acceptable).

**Recommended:** Do not rewrite for keywords. Optional later: clearer “per vehicle / return booking” line in the table caption (copy already nearby). Do not put a fake one-way column.

**Protect this page.** It is the best-performing commercial URL in the GSC page set.

---

## 10. Mobile vs desktop

**CSS:** `.site-nav` and header phone hide below 900px; Book online hides below 480px. **Main content, prices, and FAQs stay in the HTML.** WhatsApp float is sitewide.

**No evidence** of desktop-only hidden SEO text or different JSON-LD.

**Verdict:** Query mix is the more likely explanation for pos 11.4 mobile vs 34.66 desktop. **NO ACTION REQUIRED** as a technical desktop bug.

---

## 11. Core Web Vitals

Not measured from CrUX in this pass (no GA4). Static HTML is light. Risks: Google Fonts (two families, `display=swap`), WhatsApp float, `airport-prices.js` on Heathrow/rates. No huge hero photographs (no fleet photos in repo).

**Do not** chase a Lighthouse 100. Optional later: subset fonts. **Approval** before adding analytics (INP).

---

## 12. Conversion

Heathrow already has WhatsApp, Call, Book online in the hero and again under prices. Sticky WhatsApp float sitewide. Primary action is visible. Do not add a fourth competing CTA.

Desktop: phone in header + Book online. Mobile: hamburger + float WhatsApp.

**Gap:** No event tracking (see analytics HIGH).

---

## 13. Analytics

None in `spires-website`. GSC exists (you supplied data). Recommend GA4 events after you provide a measurement ID and privacy stance. Do not commit secrets.

---

## 14. Local entity signals

Consistent: Spires Taxis, 07776 897772, bookings@spires-taxis.com, Oxford licensed private hire, www.spires-taxis.com.

**Not on site (need from you):** legal display of **Spires Taxis Ltd**, operator licence number, registered office if you want it public, official GBP review URL.

Do not invent those.

---

## 15. Content opportunities (do not auto-build)

| Page | Status | Overlap risk |
| --- | --- | --- |
| Oxford → Heathrow | EXISTS — protect and support | — |
| Heathrow → Oxford | EXISTS — fix £87 title with approval | Medium with outbound |
| Oxford → Gatwick | EXISTS | Low |
| Oxford → Luton | EXISTS | Low |
| Gatwick/Luton/Stansted/Birmingham inbound | MISSING | Only if distinct arrivals content |
| Oxford Airport Transfers | EXISTS as `/airport-transfers` | — |
| Student | EXISTS | Low |
| Corporate | EXISTS | Low |
| OX1/Headington/Cowley to Heathrow | MUST NOT CREATE | Doorway risk |

---

## 16. Things that should NOT be changed

- `/about` and `/our-vehicles` (relatively strong positions)
- `/rates` pricing logic and published Heathrow return-booking figures
- Heathrow title/H1 **unless** a planned SERP test (already well targeted)
- One-way as quote
- Canonical hostname
- Working 301/308 map
- Booking portal and Firebase
- Invented reviews, awards, journey stats, one-way fares
- Mass new location pages
- Recreating `/services` as a fat article to “keep” GSC position 8

---

## Sitemap classification (relevant URLs)

| URL | Class |
| --- | --- |
| All INDEX rows in §6 | INDEX (canonical www, in sitemap) |
| `/offer-terms` | REVIEW (confirm offer still live) |
| Stubs, `/booking`, `/email`, `/thank-you`, `/nav-snippet` | NOINDEX / redirect — keep out of sitemap |
| `.html` variants, apex host | Not in sitemap — correct |

---

## robots.txt

Allows `/`, `/css/`, `/js/`, `/images/`. Disallows admin/booking/email/includes/scripts/services/destinations/index.html. **This pass added** `Disallow: /nav-snippet`. Sitemap declared. Does not block CSS/JS needed to render.

---

## Oxford to Heathrow — nine customer questions

| Question | Answered quickly? |
| --- | --- |
| Can Spires take me? | Yes — hero + terminals |
| How much? | Yes — glance + cards (£87/£110 per leg return booking; £174/£220 both legs) |
| Per person or vehicle? | Yes — stated per vehicle |
| What vehicle? | RAV4 / Vito |
| Luggage? | Body + FAQ (not the first line of the glance) |
| How long? | 60–90 minutes, not guaranteed |
| Terminals? | T2–T5 |
| Legitimate Oxford operator? | Trust strip + about/reviews links |
| How to book? | WhatsApp / call / book online |

Do not inflate word count. Optional later: one luggage line in the glance (approval if it crowds the grid).
