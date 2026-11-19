# Spires release review brief — 19 Nov 2026

Copy this document into ChatGPT and ask it to review for customer-facing consistency, policy risk, and gaps before treating the release as settled.

## Ask ChatGPT to do

1. Check whether the **approved** customer rules below are stated clearly and consistently.
2. Flag anything that could confuse a customer about waiting time, deposits, balance due, or booking status.
3. Rank remaining conflicts by customer harm (high / medium / low).
4. Say what still needs Hashim’s approval before changing public copy.
5. Do **not** invent new fares, waiting charges, or cancellation rules.

## Business context

Spires Taxis is a private hire operator (Oxford / Oxfordshire airport transfers, Executive, Cotswolds timed hire, and a gated Share pilot). Customer surfaces that must stay aligned:

- Public website: https://www.spires-taxis.com
- Guest quote form: `/contact#booking`
- Customer portal: https://customer.spires-taxis.com
- Confirmation / payment-request emails and PDFs
- Admin tools where customers see the result (quotes, PDFs, WhatsApp previews)

This GitHub repo is **public**. Approved customer rules live here. Private ops stay outside the repo.

## What shipped on 19 Nov 2026

Merged PR: https://github.com/hashi0000/spires/pull/12  
Branch work: `fix/booking-terms-admin-deposits` → `main`  
Follow-up build fix: admin waiting-policy null check.

Deployed:

| Surface | Host | Status at release |
| --- | --- | --- |
| Website | Vercel project `html` → www.spires-taxis.com | Production Ready |
| Customer portal | Vercel project `spires-2` → customer.spires-taxis.com | Production Ready |
| Admin | Firebase Hosting → spires-taxis.web.app | Deployed |
| Backend | Firebase Functions project `spires-taxis` | Deployed |

### Product / policy changes in this release

1. **Flight-monitored airport waiting** for the **current** policy stamp is **50 minutes from verified actual landing** (Hashim confirmed).
2. Current service / terms stamp: **`2026-11-19`**.
3. Fixed-time collection remains **15 minutes** from booked collection time (unchanged on this stamp).
4. Current published overage on this stamp: **£5 per started 15 minutes** after the included allowance.
5. Primary website CTA moved toward **Request a quote** → contact guest form, with **Manage my booking** for the portal (EN homepage / key airport pages; not every translated/town page yet).
6. Homepage airport fares emphasised above events, with prefilled quote links.
7. Shared configuration + validation:
   - Source: `service-policy.json`, `customer-facing-labels.json`
   - Sync: `node tools/sync-service-policy.cjs`
   - Gate: `npm run policy:check` in `spires-website/` (waiting scan + drift + £235/£35→£200 payment example)
8. Docs: policy register (`docs/policies/README.md`), `AGENTS.md`, `docs/RELEASE_CHECKLIST.md`, docs tidy/archive.

### Explicit non-changes (do not “correct” without approval)

- Historic terms pages for older bookings (`terms/2026-11-15`, `2026-10-25`, `previous-public`) were **not** rewritten.
- Bookings keep stamped `waitingPolicyVersion` / `termsVersion`.
- Unresolved overage leftovers (£10/30 wording) and some fixed-time FAQ omissions were **flagged**, not silently rewritten.
- Share luggage caps / Share public gating were not settled in this release.

## Approved rules ChatGPT should treat as ground truth

### Airport waiting (current new bookings)

| Arrangement | Included waiting | After allowance (current stamp) |
| --- | --- | --- |
| Flight monitored | **50 minutes** from **verified actual landing** | **£5 / started 15 minutes** |
| Fixed time (incl. hotel by default) | **15 minutes** from **booked collection time** | Same £5 / 15; no flight monitoring / auto-adjust |

Timer stops when the customer calls or messages that the whole group and luggage are ready. Driver-caused delay is not charged.

### Version map (must preserve)

| `waitingPolicyVersion` | Flight free | Fixed free | Overage |
| --- | --- | --- | --- |
| missing / legacy | 50 | flight-style legacy | £10 / 30 |
| `2026-11-15` | 60 | 15 | £5 / 15 |
| `2026-11-19` (current) | 50 | 15 | £5 / 15 |

### Customer-facing labels (glossary)

| Label | Meaning |
| --- | --- |
| Request a quote | Ask for price/availability. No confirmation and no payment from sending the request alone. |
| Request received | Office has the enquiry. Not yet a confirmed journey. |
| Confirmed | Journey accepted under agreed fare and terms for that booking. |
| Deposit paid | Required deposit recorded as received; counts toward fare once only. |
| Balance due | Amount still owed after effective payments received (paid deposit counted once). |

Design tokens for customer screens: navy `#002147`, gold `#b8956a`.

### Payment release example (must stay true everywhere balance is shown)

| Field | Value |
| --- | --- |
| Agreed fare | £235 |
| Deposit paid / amount received | £35 |
| Balance due | **£200** |

All three (portal, confirmation, payment request) should read from the same payment maths (`effectiveReceivedPence` / outstanding). A paid deposit must not be double-counted.

### Cotswolds (unchanged numbers on this stamp)

Hire durations 4 / 6 / 8 hours. Standard £180 / £260 / £340. Executive £240 / £350 / £460. 8 Seater £220 / £320 / £420. Extra time **£10 per started 20 minutes**.

## Release checks that already passed locally

- Waiting scan: no conflicting **current** flight-monitored allowances at 60 vs 50 for live current copy.
- Shared policy copies match root `service-policy.json`.
- Labels copies match root `customer-facing-labels.json`.
- Payment example: £235 + £35 paid → £200 due via `paymentAmount`.
- Live spot-check after deploy: homepage/contact show **Request a quote** and **50 minutes**; terms pointer is **2026-11-19**.

## Known inconsistencies still open (review these)

Treat these as open. Prefer “Needs Hashim’s approval” over inventing a fix.

| Topic | What customers / staff may still see | Severity hint |
| --- | --- | --- |
| Overage leftovers | `about.html` still has a £10/30 bullet; Oxfordshire Heathrow FAQ schema still mentions £10/30 after 50 minutes | High if indexed/FAQ-visible |
| Primary CTA drift | Many translated pages and some EN town/guide pages still say **Book online** → portal instead of **Request a quote** → contact | Medium |
| Portal label wording | Portal still uses variants such as “Deposit: Paid”, “Payments received, including deposit”, “Awaiting confirmation” instead of glossary strings | Medium |
| Guest audit terms | `functions/src/bookings/guestHandlers.ts` still hard-codes audit `termsVersion: "2026-10-25"` on at least one path while accept path is current | Medium (audit/data integrity) |
| Fixed-time omissions | Some meta/FAQ copy describes flight monitoring only and omits fixed-time 15 minutes | Low–medium |
| Historic 60-minute terms | `terms/2026-11-15` still correctly says 60 for bookings stamped that day — must **keep** | Not a bug if labelled historic |
| Dual payment helpers | Backend `paymentAmount.ts` and admin `bookingMoney.ts` both implement received/outstanding logic | Low if kept in sync; risk if one drifts |

## Files / sources of truth

| Concern | Path |
| --- | --- |
| Policy register | `docs/policies/README.md` |
| Agent rules | `AGENTS.md` |
| Release checklist | `docs/RELEASE_CHECKLIST.md` |
| Shared waiting/Cotswolds numbers | `service-policy.json` |
| Label glossary | `customer-facing-labels.json` |
| Waiting engine | `functions/src/airportWaitingPolicy.ts` |
| Terms version | `functions/src/terms/bookingTerms.ts` + `spires-website/terms/2026-11-19.html` |
| Payment maths | `functions/src/paymentAmount.ts`, admin `bookingMoney.ts` |
| Consistency gate | `tools/check-customer-consistency.cjs` |

## Suggested ChatGPT review prompts (paste after this brief)

Use one or more of these:

1. “Based only on this brief, list every place a customer could still be told the wrong waiting allowance or wrong overage charge.”
2. “Draft a short release note for staff: what changed for new bookings vs what stays true for existing bookings.”
3. “Propose a prioritised cleanup list for the open inconsistencies. Mark each item Needs Hashim’s approval or Safe to align to glossary/policy.”
4. “Check the label glossary against the portal wording described here. Which status strings should map to Request received, Confirmed, Deposit paid, and Balance due?”
5. “Stress-test the £235 / £35 / £200 example. What edge cases (pending deposit, double deposit entry, extras) should the release checklist mention?”

## Constraints for ChatGPT

- Do not rewrite historic terms that existing bookings still reference.
- Do not merge fixed-time into the flight-monitored rule.
- Do not choose £5/15 vs £10/30 as the permanent long-term overage rule without marking it Needs Hashim’s approval.
- Prefer shared config and the policy register over one-off page edits.
- Visible customer language must avoid hyphenated compounds (write “8 seater”, “pre booked”, “balance due”, not “8-seater”, “pre-booked”).
