# Spires Taxis SEO implementation plan

Companion to `SEO_AUDIT.md`.  
**Rule:** ship only low-risk, clearly beneficial, reversible changes without a further go-ahead. Everything else waits.

Primary goal: make `/oxford-to-heathrow-taxi` the strongest **local** answer for “Oxford to Heathrow taxi” — clarity, trust, and conversion — not more word count.

---

## PHASE 1 — Technical problems

| Item | Do now? | Notes |
| --- | --- | --- |
| Unique titles, H1s, canonicals, sitemap, robots, 404, IndexNow, cache headers | **No** | Already correct |
| Redirect stubs `noindex` | **No** | Working |
| Missing `twitter:description` | **No** | Not a Google ranking issue |
| Rebuild JSON-LD architecture | **No** | Needs approval (schema architecture) |
| `/offer-terms` noindex | **No** | Confirm if the £5 portal offer is live |
| Analytics | **No** | Needs GA4/GTM ID and privacy decision |

**Later (after approval):** GSC property checks; Bing/Google live inspection of `/oxford-to-heathrow-taxi` and `/rates`; IndexNow after deploys that change those URLs.

---

## PHASE 2 — Oxford to Heathrow improvements

**Do now (low risk):**

1. Remove “vehicle photos are being added” copy.
2. Add a **Route at a glance** block under the trust strip using only facts already on the page:
   - Oxford → Heathrow (T2–T5)
   - 45–50 miles
   - typically 60–90 minutes (not guaranteed)
   - Toyota RAV4, up to 4, return booking £174 total / £87 each way, **per vehicle**
   - Mercedes Vito, up to 8, £220 / £110
   - One-way: get a fixed quote (do not publish a one-way fare)
3. Style the glance with existing colours/spacing. Do not delete price cards, FAQs, or booking sections.

**Needs approval:**

- Changing the page title or H1
- Making WhatsApp the only primary hero button
- Loading Trustpilot JS on this page
- Adding real vehicle photos (when files exist)
- Rewriting FAQs or adding keyword paragraphs about Heathrow history

**Do not do:** 2,000-word article, extra location pages, invented one-way prices.

---

## PHASE 3 — Internal linking

**Do now:**

- Add `/oxford-to-heathrow-taxi` to the short “useful pages” list on `/reviews` (natural anchor, not exact-match spam).

**Needs approval:**

- Desktop nav item “Heathrow” → `/oxford-to-heathrow-taxi` (test wrapping)
- Extra Luton card on the homepage popular-routes grid (optional, low SEO value for the Heathrow query)

**Already adequate (leave):** Footer airport column; homepage Heathrow card; rates table link; airport-transfers card; student/corporate/oxford/abingdon/bicester cards; pickup guide cross-links.

**Do not:** Exact-match “Oxford to Heathrow taxi” in every paragraph or nav.

---

## PHASE 4 — Local trust and entity

**Do now:**

- Remove “photos coming soon” on `/our-vehicles` so the fleet page does not look unfinished.

**Needs facts from you, then approval:**

- Public use of **Spires Taxis Ltd** vs **Spires Taxis**
- Operator licence number for `/about`
- Official Google Business Profile review URL (replace the Maps search link)
- Confirm 60-minute airport waiting vs £25/hour extra vs terms 5–10 minutes

**Do not:** Fake ratings, review counts, awards, years in business, or AggregateRating.

---

## PHASE 5 — Conversion tracking

**Needs approval + IDs:**

1. GA4 or GTM on `spires-website` only (not in customer-app unless you ask).
2. Events: `click_call`, `click_whatsapp`, `click_book_online`, plus page path (Heathrow vs rest).
3. Optional: Google Ads conversion tags later — separate from organic SEO.

**Do not implement** until you send a measurement ID and confirm cookie/privacy copy.

Booking completion lives on `customer.spires-taxis.com` and cannot be inferred from the marketing HTML alone.

---

## PHASE 6 — Performance

**Do now:** Nothing that changes look-and-feel.

**Later / approval:**

- Consider fewer Google Font weights
- Keep Trustpilot JS on `/reviews` only
- When vehicle photos arrive: compressed WebP/AVIF, explicit width/height, lazy below fold, LCP-safe hero (do not make a huge photo the LCP unless it is the actual hero)

Do not chase a Lighthouse score at the expense of the current layout.

---

## PHASE 7 — Future content opportunities

Only if they add **distinct customer value** (not templates):

- Early-morning Oxford pickup planning (still on the existing Heathrow URL, as a short section — approval)
- Student arrivals at Heathrow (link from `/student-taxis`, do not fork a new Heathrow URL)
- Real vehicle photo page updates
- **Not:** OX1/OX2/Headington/Cowley to Heathrow clones
- **Not:** a blog of Heathrow terminal history
- **Not:** extra domains for backlinks

---

## Heathrow → Oxford (separate workstream)

Keep the URL. After title/H1 approval, deepen arrivals value already started (terminals table, flight number, colleges/hotels) rather than cloning outbound copy.

---

## Rollback

Glance CSS lives in `css/style.css` under `.route-glance`. HTML is a single block in `oxford-to-heathrow-taxi.html`. Photo callouts can be restored from git if needed.
