# Spires Taxis SEO implementation plan

Companion to `SEO_AUDIT.md` and `KEYWORD_TO_URL_MAP.md`.  
**Date:** 4 September 2026  
**Rule:** ship only low-risk, clearly correct, reversible changes without a further go-ahead. Everything else waits.

Primary goal: help Google **commit** to `/oxford-to-heathrow-taxi` for Oxford → Heathrow queries already showing impressions at positions ~21–70. Do not add another Heathrow page. Do not keyword-stuff. Do not rewrite pages that already rank (About, Vehicles, Rates).

---

## PHASE 1 — Critical technical corrections

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unique titles, canonicals, robots, 404, IndexNow, cache headers | — | already in place | — | — | — | — | **No** |
| Redirect stubs `noindex` + Vercel 301 | — | already in place | — | — | — | — | **No** |
| Stop `/nav-snippet` returning 200 | High hygiene | `robots.txt`, `vercel.json` | Tiny (orphan URL) | Easy | Low | Revert those two files | **Done this pass** |
| Fake reviews / AggregateRating | — | none present | — | — | — | — | **No** |

There is **no CRITICAL live defect** (no duplicate 200 `/rates` or `/services`, no sitewide noindex, hostname policy already www).

---

## PHASE 2 — Canonical / legacy URL corrections if required

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/rates.html` 308 → `/rates` | — | Vercel `cleanUrls` | Already correct | — | — | — | **NO ACTION REQUIRED** |
| `/services` 301 → `/airport-transfers` | — | `vercel.json` + stub | Already correct | — | — | — | **NO ACTION REQUIRED** |
| Skip-hop: `/services.html` → `/airport-transfers` in one 301 | Low | `vercel.json` | Removes 308+301 chain | Easy | Low–medium (historical URL) | Remove redirect | **Approval** |
| Apex HTTPS 301 → www | — | `vercel.json` | Already correct | — | — | — | **NO ACTION REQUIRED** |
| HTTP apex two-hop (http apex → https apex → www) | Low | Vercel platform | Cosmetic | Hard | Low | N/A | **Leave** |
| `/offer-terms` noindex if offer dead | Medium | `offer-terms.html`, sitemap skip | Less stale index | Easy | Medium | Restore index | **Approval** (confirm offer) |

---

## PHASE 3 — Oxford to Heathrow improvements

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Route at a glance | — | `oxford-to-heathrow-taxi.html` | Already shipped 1 Sep 2026 | — | — | — | **No** (do not redo) |
| Keep one-way as quote | — | same | Prevents fare confusion | — | — | — | **No change** |
| Change title/H1 | Low unless SERP test | same | Unlikely to fix pos 68 vs query 21–43 | Easy | Medium | Git revert | **Approval** |
| Extra keyword paragraphs / second Heathrow URL | — | — | Harmful | — | High | — | **Do not do** |
| Luggage line in glance grid | Low | same | Minor UX | Easy | Low | Revert block | Optional, approval if layout tight |
| Real vehicle photos | Medium trust | `images/`, page | Trust, not rankings by itself | Medium | Low if real photos | Remove `<img>` | **Needs assets** |

Do not: 2,000-word article, OX1–OX4 pages, invented one-way price.

---

## PHASE 4 — Internal authority improvements

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop nav “Heathrow” → `/oxford-to-heathrow-taxi` | **Highest on-site lever** | `includes/header.html` **and** inlined header on every public HTML (chrome is copied) | Stronger crawl path to money URL | Easy + layout QA | Medium | Git revert; restore Reviews if swapped | **Approval** + test 1024/1280px |
| Footer / mobile / homepage / rates links | — | already present | Adequate | — | — | — | **No** |
| Exact-match “Oxford to Heathrow taxi” on every page | — | — | Spam | — | High | — | **Do not do** |
| Reviews useful link | — | `reviews.html` | Already added | — | — | — | **No** |

**External:** Ask Oxford organisations to link to `/oxford-to-heathrow-taxi` (or `/about` for general mentions). Cannot be done in code.

---

## PHASE 5 — Rates / pricing search opportunity

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Protect `/rates` (pos ~25, 364 imp) | High | `rates.html` | Keep best commercial page | — | High if rewritten | — | **Do not rewrite** |
| Keep Heathrow row linking to route page | — | already | Helps assignment | — | — | — | **No** |
| Invent one-way column | — | — | False advertising | — | High | — | **Do not do** |
| Keyword-stuff “oxford to heathrow taxi price” | — | — | Overlap with route page | — | Medium | — | **Do not do** |

---

## PHASE 6 — Local entity and trust

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GBP review URL on `/reviews` + Organization `sameAs` | Medium | `reviews.html`, `index.html` JSON-LD | Entity | Easy | Low if URL is official | Revert links | **Needs URL from you** |
| Display **Spires Taxis Ltd** / licence number | Medium | `/about` | Entity | Easy | Medium if wrong | Revert | **Needs facts** |
| Align waiting time (60 min vs allowance vs 5–10 min) | High trust | `airport-transfers.html`, terms, rates, pickup, Heathrow FAQ | Trust / consistency | Easy once policy chosen | Medium | Git | **Approval** |
| Trustpilot widget on Heathrow | Low | Heathrow HTML | Mixed (JS cost) | Easy | Medium | Remove script | **Approval** |
| Remove “photos coming soon” | — | already removed | — | — | — | — | **No** |
| Fake star ratings | — | — | Policy violation | — | Critical | — | **Do not do** |

---

## PHASE 7 — Conversion tracking

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GA4 or GTM | High for learning | shared head / chrome script | Measure Heathrow, tel, WhatsApp, book | Easy | Medium (privacy, INP) | Remove snippet | **Approval** + measurement ID |
| Events: `tel:`, `wa.me`, `customer.spires-taxis.com` | High | same | Attribution | Easy | Low | Disable events | With GA4 |
| GSC remains source of rank data | — | Search Console | — | — | — | — | Keep using |

Do not put private config or secrets in git. A public GA4 ID is normal.

---

## PHASE 8 — Performance

| Task | Priority | Files | Impact | Difficulty | SEO risk | Rollback | Do now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Measure CrUX after GA4 | Medium | — | Evidence | — | — | — | After Phase 7 |
| Font subsetting | Low | HTML head | LCP/INP | Medium | Low | Restore Google Fonts CSS | Optional later |
| Add heavy photo carousels | — | — | Can hurt LCP | — | Medium | — | Only with compressed real photos |
| Chase Lighthouse 100 | — | — | Vanity | — | — | — | **Do not** |

---

## PHASE 9 — Future content opportunities

Report only. **Do not create automatically.**

| Opportunity | Status | Potential value | Overlap risk |
| --- | --- | --- | --- |
| Oxford → Heathrow | EXISTS | Highest — support, don’t duplicate | — |
| Heathrow → Oxford | EXISTS | High if title de-£87’d | Medium with outbound |
| Oxford → Gatwick / Luton | EXISTS | Maintain | Low |
| Gatwick/Luton/Stansted/Birmingham **to Oxford** | MISSING | Medium if arrivals-specific | With pickup guide |
| Birmingham / Stansted / Bristol **from Oxford** | Hub + rates only | Medium | With `/airport-transfers` |
| Student / corporate | EXISTS | Maintain | Low |
| OX1–OX4 / Headington / Cowley to Heathrow | MUST NOT BUILD | Doorway | Critical overlap |

---

## Implementation this pass (no approval needed)

1. `spires-website/robots.txt` — `Disallow: /nav-snippet`
2. `spires-website/vercel.json` — 301 `/nav-snippet` → `/`

Heathrow glance, review links, and “photos coming soon” removal were already on `main` from 1 September 2026.

---

## Waiting on you (facts / approval)

- Desktop nav item “Heathrow”
- Heathrow→Oxford title/H1 without leading “from £87”
- GA4/GTM ID + cookie decision
- Whether `/offer-terms` should stay indexed
- Official Google review / GBP URL
- Legal name Ltd and operator licence number (if public)
- One waiting-time rule (60 minutes vs standard allowance vs terms 5–10 minutes)
- Genuine vehicle photographs (filenames, who is in shot, permission)
- Optional `/services.html` skip-hop 301

---

## Rollback method (general)

All marketing-site SEO is static files + `vercel.json`. Revert the git commit and redeploy. IndexNow (`npm run indexnow` in `spires-website`) after meaningful URL/content deploys if you want faster Bing notice. Google still recrawls on its own schedule.
