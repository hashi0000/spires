# Keyword-to-URL map

**Site:** https://www.spires-taxis.com  
**Date:** 4 September 2026  
**Evidence:** Google Search Console query and page data supplied for this audit, plus live HTTP checks and the `spires-website/` codebase.

Rule: one primary URL per commercial intent. Supporting URLs may mention the topic. Do not merge, redirect, or noindex supporting URLs unless a later review proves they are still competing as equal 200 pages.

GSC query positions and page positions will not always match. That mismatch is itself evidence that Google is still splitting rankings across URLs.

---

## How to read cannibalisation risk

| Risk | Meaning |
| --- | --- |
| **Low** | Clear primary URL; other pages only support it |
| **Medium** | Google may still rank a supporting URL for the query |
| **High** | Query-level average position is materially better than the dedicated page’s average position — Google has not committed to the intended URL |

---

## Oxford → Heathrow taxi

| Field | Value |
| --- | --- |
| **Search intent** | Book a pre-booked private hire car from Oxford to Heathrow (price, vehicle, terminals, time) |
| **Primary URL** | `/oxford-to-heathrow-taxi` |
| **Supporting URLs** | `/` (popular-routes card), `/airport-transfers` (hub), `/rates` (fare table), `/heathrow-to-oxford-taxi` (return direction), `/how-airport-pickup-works` (arrivals process), `/our-vehicles`, `/student-taxis`, `/corporate-taxis` |
| **GSC queries (approx.)** | “oxford to heathrow taxi” 138 imp, pos 43.26, 0 clicks; “taxi oxford to heathrow” 94 / 25.89; “oxford taxi to heathrow” 33 / 25.55; “airport taxi oxford to heathrow” 29 / 36.69; “taxis oxford to heathrow” 24 / 21.00; “oxford to heathrow taxi price” 25 / 41.76; “oxford to heathrow airport taxi” 25 / 77.92 |
| **GSC page** | `/oxford-to-heathrow-taxi` ~175 imp, 0 clicks, **average position 68.09** |
| **Current overlap** | Query averages of ~21–43 for several Heathrow phrases vs dedicated-page average **68**. Google is ranking *some other Spires URL(s)* for those queries more often than the dedicated page. Likely mix: homepage, `/rates`, `/airport-transfers`, `/heathrow-to-oxford-taxi`, and historical `/heathrow-airport-taxis` (now 301). |
| **Cannibalisation risk** | **High** (mixed ranking, not duplicate 200 content) |
| **Recommended action** | Keep `/oxford-to-heathrow-taxi` as the only money URL. Strengthen internal links (desktop nav — approval). Do **not** create another Heathrow landing page. Do **not** keyword-stuff. Do **not** redirect `/rates` or `/airport-transfers` into it. Use Search Console Pages + Queries (page filter = Heathrow URL vs site) to confirm which other URLs appear for each query. |

---

## Heathrow → Oxford taxi

| Field | Value |
| --- | --- |
| **Search intent** | Arrival collection at Heathrow, flight monitoring, waiting, drop-off in Oxford |
| **Primary URL** | `/heathrow-to-oxford-taxi` |
| **Supporting URLs** | `/how-airport-pickup-works`, `/oxford-to-heathrow-taxi` (outbound cross-link), `/airport-transfers` |
| **GSC** | No dedicated query row was supplied for “heathrow to oxford taxi”. Outbound Heathrow queries may still surface this page because of shared £87 language. |
| **Current overlap** | Title/H1 still lead with “from £87”, which overlaps outbound pricing SERPs. |
| **Cannibalisation risk** | **Medium** |
| **Recommended action** | Keep as a separate arrivals page. Do not duplicate the outbound page with swapped words. Change title/H1 away from “from £87” **after approval**. |

---

## Oxford airport transfers (all airports)

| Field | Value |
| --- | --- |
| **Search intent** | Which airports Spires covers from Oxford; how pickup works; hub to route pages |
| **Primary URL** | `/airport-transfers` |
| **Supporting URLs** | `/how-airport-pickup-works`, `/rates`, `/`, `/oxford-to-heathrow-taxi`, `/oxford-to-gatwick-taxi`, `/oxford-to-luton-taxi` |
| **GSC queries** | “airport transfers oxford to heathrow” 4 imp, 1 click, pos ~17.75; “airport taxis oxford” 34 imp, 0 clicks |
| **Historical URL** | `/services` and `/airport-taxis-oxford` now **301** to `/airport-transfers` (noindex stubs). GSC page `/services` (~153 imp, pos 8.12) is **historical or redirect attribution**, not a live competing document. |
| **Cannibalisation risk** | **Medium** for Heathrow-specific queries if Google prefers the hub over the route page |
| **Recommended action** | Keep as hub. Point Heathrow-specific copy to `/oxford-to-heathrow-taxi`. Do not restore `/services` as an indexable page. |

---

## Oxford airport taxi (generic)

| Field | Value |
| --- | --- |
| **Search intent** | Generic “airport taxi Oxford” — not a single airport |
| **Primary URL** | `/airport-transfers` |
| **Supporting URLs** | `/`, `/rates` |
| **GSC** | “airport taxis oxford” 34 impressions, 0 clicks |
| **Cannibalisation risk** | **Low–medium** |
| **Recommended action** | Do not create `/airport-taxis-oxford` again (stub already 301s here). |

---

## Oxford taxi prices / Heathrow price

| Field | Value |
| --- | --- |
| **Search intent** | See fares; compare vehicles; understand per-vehicle vs per-person |
| **Primary URL** | `/rates` for generic “taxi Oxford prices”; `/oxford-to-heathrow-taxi` for “Oxford to Heathrow taxi price” |
| **Supporting URLs** | Each route page (Gatwick, Luton, Heathrow arrivals) |
| **GSC page** | `/rates` ~364 imp, 0 clicks, **average position 25.43** — strongest commercial *page* in the dataset after brand/entity pages |
| **GSC queries** | “taxi oxford prices” 26 imp; “oxford to heathrow taxi price” 25 imp, pos ~41.76 |
| **Historical URL** | `/rates.html` live **308 → `/rates`**. Not a duplicate 200 page. |
| **Cannibalisation risk** | **Medium** on Heathrow *price* queries (rates table vs dedicated page) |
| **Recommended action** | Keep `/rates` as the full card. Keep Heathrow row linking to `/oxford-to-heathrow-taxi`. Do not stuff “Oxford to Heathrow taxi price” into `/rates`. Do not invent one-way fares. |

---

## Oxford taxis (local / brand)

| Field | Value |
| --- | --- |
| **Search intent** | Local Oxford private hire, stations, colleges, hospitals — not specifically Heathrow |
| **Primary URL** | `/` for brand + “oxford taxis”; `/oxford-taxis` for local journeys |
| **Supporting URLs** | `/about`, `/contact`, `/our-vehicles` |
| **GSC queries** | “spire taxis” 89 imp, 4 clicks; “taxi companies in oxford” 5 imp, 2 clicks; “taxi in oxford england” 25 imp |
| **GSC pages** | `/about` ~197 / pos 11.55; `/our-vehicles` ~22 / pos 5.59; www homepage historically ~75 clicks |
| **Cannibalisation risk** | **Low** if local pages stay local and Heathrow stays on the route URL |
| **Recommended action** | Do **not** rewrite `/`, `/about`, `/oxford-taxis`, or `/our-vehicles` to chase Heathrow. Homepage already has a Heathrow card — enough. |

---

## Student airport transfers

| Field | Value |
| --- | --- |
| **Search intent** | Term start/end, luggage, parents, student airport runs |
| **Primary URL** | `/student-taxis` |
| **Supporting URLs** | `/oxford-to-heathrow-taxi`, `/airport-transfers`, `/rates` |
| **Cannibalisation risk** | **Low** |
| **Recommended action** | Keep. Natural link to Heathrow already exists. No new student-Heathrow URL. |

---

## Airport pickup / meet & greet

| Field | Value |
| --- | --- |
| **Search intent** | How collection works after landing |
| **Primary URL** | `/how-airport-pickup-works` |
| **Supporting URLs** | `/heathrow-to-oxford-taxi`, `/airport-transfers` |
| **Cannibalisation risk** | **Low** |
| **Recommended action** | Keep. This is process content, not a second Heathrow fare page. |

---

## Other airports (inventory only — do not auto-create)

| Intent | Primary URL | Status |
| --- | --- | --- |
| Oxford → Gatwick | `/oxford-to-gatwick-taxi` | EXISTS |
| Oxford → Luton | `/oxford-to-luton-taxi` | EXISTS |
| Gatwick → Oxford | — | MISSING (pickup guide + Gatwick outbound cover some intent) |
| Luton → Oxford | — | MISSING |
| Oxford → Stansted | — | MISSING (mentioned on hub/rates only) |
| Oxford → Birmingham | `/airport-transfers` + `/rates` | MISSING dedicated page; old `/birmingham-airport-taxis` 301s to hub |
| Oxford → Bristol | `/rates` / hub | MISSING dedicated page |

**Do not generate these automatically.** Each needs distinct customer value (terminals, waiting, verified fares) before creation.

---

## URL Google should rank — summary

| Query family | Rank this URL |
| --- | --- |
| Oxford to Heathrow taxi (all wording variants) | `/oxford-to-heathrow-taxi` |
| Heathrow to Oxford / airport pickup | `/heathrow-to-oxford-taxi` then `/how-airport-pickup-works` |
| Airport transfers Oxford (generic) | `/airport-transfers` |
| Taxi prices Oxford | `/rates` |
| Oxford taxis / company | `/` and `/about` |
| Student airport | `/student-taxis` |

If Search Console later shows `/rates` or `/` still outranking `/oxford-to-heathrow-taxi` for “oxford to heathrow taxi” after desktop-nav and crawl, treat that as **authority and competition**, not a missing keyword. Do not add a second Heathrow URL.
