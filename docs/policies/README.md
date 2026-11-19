# Spires Taxis policy register

Internal register of customer-facing rules and the booking behaviour that implements them.  
**Not published** by the website. Keep this folder outside `spires-website/` (and any other Vercel publish root).

Documentation map: [`../README.md`](../README.md). Agent workflow: [`../../AGENTS.md`](../../AGENTS.md).

**Purpose:** one place for coding agents and staff to check approved wording, version stamps, and which surfaces must stay in sync.

**How to use**

1. Read the relevant entries here before changing customer-facing wording, pricing, booking behaviour, payments or documents.
2. Prefer shared configuration (`service-policy.json`, `functions/src/airportWaitingPolicy.ts`, `functions/src/terms/bookingTerms.ts`, `functions/src/cotswoldsPolicy.ts`, Share defaults) over hard-coded copy.
3. For an **approved** policy change: update this register and all affected customer surfaces in the same change set.
4. If implementation and this register disagree, **surface the mismatch** before changing the rule.
5. Preserve the policy version already agreed for existing bookings (`waitingPolicyVersion`, `termsVersion`, `acceptedServiceTerms`, Cotswolds `timedHire` snapshots, Share `termsVersion`).

**Status key**

| Status | Meaning |
| --- | --- |
| Approved | Confirmed decision; implement and keep surfaces aligned |
| Needs Hashim’s approval | Conflicting or incomplete; do not invent a resolution |
| Operational | Used in booking/ops; not a fixed published percentage or fee table |

---

## Shared configuration

| Config | Path | What it holds |
| --- | --- | --- |
| Service policy | `service-policy.json` (synced to `functions/src/servicePolicy.json`, customer/admin copies, `spires-website/js/service-policy.js`) | Version stamp, airport waiting numbers, Cotswolds prices and overtime |
| Customer labels | `customer-facing-labels.json` (synced to app copies + `spires-website/js/customer-facing-labels.js`) | Request a quote, Request received, Confirmed, Deposit paid, Balance due + design tokens |
| Waiting engine | `functions/src/airportWaitingPolicy.ts` (+ synced customer/admin copies) | Flight vs fixed, published version map, legacy 50/£10/30, confirmation text |
| Booking terms | `functions/src/terms/bookingTerms.ts` | Current terms version/URL; online acceptance rules |
| Cotswolds / timed hire | `functions/src/cotswoldsPolicy.ts`, `functions/src/timedHire.ts` | Hire durations, rates, overtime, snapshots |
| Payment / deposit maths | `functions/src/paymentAmount.ts`, admin `bookingMoney.ts` | Fare, deposit, received, balance, payable |
| Airport fare tables | `spires-website/js/airport-prices.js` | Published Oxford/Oxfordshire airport fares |
| Share defaults | `functions/src/spiresShare/defaults.ts`, `SHARE_TERMS_VERSION` | Pilot fares, capacity, luggage caps, gating |

Sync: `node tools/sync-service-policy.cjs`. Drift gate: `npm run policy:check` in `spires-website/` → `tools/check-customer-consistency.cjs`.

Public HTML terms (versioned): `spires-website/terms/`. Live pointer: `spires-website/terms-and-conditions.html`.

---

## Customer-facing labels and design

### P17 — Status and CTA labels

| Field | Value |
| --- | --- |
| **Status** | Approved glossary (apply consistently; some portal strings still use variants — see Conflicts) |
| **Source** | `customer-facing-labels.json` |
| **Labels** | **Request a quote** — ask for price/availability; no confirmation and no payment from the request alone. **Request received** — office has the enquiry; not yet a confirmed journey. **Confirmed** — journey accepted under agreed fare and terms. **Deposit paid** — required deposit recorded as received; counts toward fare once. **Balance due** — amount still owed after effective payments (paid deposit counted once). |
| **Payment example** | £235 fare + £35 deposit paid → £35 received, £200 balance due (portal, confirmation, payment request; same payment record) |
| **Design** | Navy `#002147`, gold `#b8956a`; reuse existing spacing, buttons and form feedback |

### P18 — Cross-system sync

| Field | Value |
| --- | --- |
| **Status** | Approved process |
| **Decision** | Website, portal and backend that build separately must generate or sync values from the same source. Published copies of `service-policy.json` / labels must not drift. |
| **Implements** | `tools/sync-service-policy.cjs`; `tools/check-shared-policy-drift.cjs`; `tools/check-waiting-policy.cjs`; `tools/check-customer-consistency.cjs` |
| **Release** | List touchpoints and verify before release ([`../RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md); [`../../AGENTS.md`](../../AGENTS.md)) |

---

## 1. Fares and coverage

### P1 — Published airport transfer fares (Oxford)

| Field | Value |
| --- | --- |
| **Status** | Approved (published rate card; treat as live until a fare change is approved) |
| **Applies to** | Customers booking published Oxford airport routes; Standard Car and 8 Seater unless Executive is offered |
| **Effective** | Ongoing published rates (not a single service-policy version stamp) |
| **Approved decision** | Fixed published fares per vehicle and route; price confirmed at booking is the price charged for that booking. Airport pickup/drop-off charges are included in the advertised fare where stated. |
| **Implements** | `spires-website/js/airport-prices.js`; `rates.html`; route pages; homepage fare cards; Executive Oxford Heathrow **£150 / £290** in `functions/src/quotes/executiveService.ts` (Abingdon 165/320; Didcot/Bicester/Witney 170/330) |
| **Surfaces** | Website rates and airport pages; guest quote form (request only); portal/admin fare fields; confirmation PDFs/emails |

### P2 — Coverage and quoting outside published fares

| Field | Value |
| --- | --- |
| **Status** | Approved (public practice) |
| **Applies to** | Towns with published airport fares vs other places |
| **Decision** | Oxford published fares apply to Oxford. Abingdon, Didcot, Bicester and Witney each have their own published airport fares. Elsewhere: individual quote. Local town guide ranges on the homepage/rates are not airport fares. |
| **Implements** | Homepage / contact “Areas we cover”; rates regional notes; guest and portal quote flow |

---

## 2. Airport pickups and waiting

### P3 — Flight-monitored waiting allowance

| Field | Value |
| --- | --- |
| **Status** | **Approved** (Hashim confirmed 2026-11-19) |
| **Applies to** | Flight-monitored airport terminal collections for new acceptances on the current waiting version |
| **Effective** | Current service policy version `2026-11-19` |
| **Approved decision** | Flight-monitored airport pickups include **50 minutes** of waiting from **actual landing** (verified actual landing). Delays before landing do not use the allowance. |
| **Does not apply to** | Fixed-time collections; outbound drop-offs to the airport; bookings stamped with an older waiting version |
| **Implements** | `service-policy.json` → `airport.flightFreeMinutes: 50`; `CURRENT_WAITING` / `publicWaitingParagraph()` / `airportWaitingTextForBooking()`; guest form stamps `waitingPolicyVersion` from `SpiresServicePolicy.version`; portal/admin collection fields; terms `2026-11-19` |
| **Surfaces** | Most EN rates/airport/pickup-guide/contact copy; translated pages largely aligned; confirmation PDFs/emails for current-version bookings |
| **Existing bookings** | Keep stamped version: `2026-11-15` → 60 minutes; missing version → legacy path (see P5 conflicts) |

### P4 — Fixed-time pickup arrangement

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval for any change; **current published** numbers recorded below |
| **Applies to** | Fixed-time airport collections (including hotel collections by default) |
| **Current published** | **15 minutes** from the **booked collection time**. No flight monitoring and no automatic adjustment for early/late flights. Earlier collection or reschedule subject to availability. Flight number (if given) is reference only. |
| **Effective (current stamp)** | `2026-11-15` and `2026-11-19` both use 15 minutes fixed |
| **Implements** | `service-policy.json` → `fixedFreeMinutes: 15`; arrangement `fixed_time` / hotel → fixed in `waitingPolicyForBooking`; guest/portal acknowledgements; terms fixed-time bullets |
| **Conflicts / notes** | Some FAQ/meta copy still describes “50 minutes after landing” only and omits fixed-time. Do not collapse fixed-time into the flight-monitored rule. |

### P5 — Airport waiting overage charge

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval to choose a single long-term rule; **current published** vs **legacy** both recorded |
| **Applies to** | Waiting after the included allowance on airport collections |
| **Current published (2026-11-19 and 2026-11-15)** | **£5 per started 15 minutes** after the included allowance. Waiting caused by our driver is not charged. Timer stops when the customer calls or messages that the whole group and luggage are ready at the agreed collection point (contact time, not later driver entry). |
| **Legacy / older terms** | **£10 per additional 30 minutes or part thereof** (legacy constant `AIRPORT_WAITING_POLICY`, terms `2026-10-25`, `previous-public`, unversioned bookings) |
| **Implements (current)** | `service-policy.json` → `blockMinutes: 15`, `chargePounds: 5`; `proposeWaitingCharge`; PDF/email waiting text for published versions |
| **Conflicting surfaces (do not “fix” without approval)** | See [Conflicts](#conflicts-customers-may-see) |

### Version map (waiting)

| `waitingPolicyVersion` | Flight free | Fixed free | Overage |
| --- | --- | --- | --- |
| *(missing / legacy)* | 50 | *(flight-style legacy)* | £10 / 30 |
| `2026-11-15` | 60 | 15 | £5 / 15 |
| `2026-11-19` (current) | 50 | 15 | £5 / 15 |

---

## 3. Deposits and balances

### P6 — Deposits

| Field | Value |
| --- | --- |
| **Status** | Operational |
| **Applies to** | Bookings where staff or a quote request a deposit |
| **Decision** | No fixed deposit percentage in terms or `service-policy.json`. Amount is per booking (`depositRequired`, `depositAmount`, `depositStatus`). Guest website requests start with `depositRequired: false`. |
| **Implements** | `paymentAmount.ts`; admin deposit fields; quote callables; PDF/email “pay a deposit of £X” |
| **Balance rule** | Outstanding ≈ agreed fare (+ additional charges) − effective amount received (paid deposit counted once; pending deposit does not count as received) |

### P7 — Return journey payment split (terms)

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval if changing; present in published terms |
| **Applies to** | Return bookings under current terms wording |
| **Published wording** | Terms describe payment schedule for returns (first leg + half of second upfront style language in terms pages) — distinct from an ops deposit % |
| **Implements** | Versioned terms HTML; not encoded as a single deposit field |

---

## 4. Payment methods

### P8 — Private hire payment methods

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval to reconcile short terms vs ops channels |
| **Published terms** | Cash, card or contactless in the vehicle; overdue amounts may go to debt recovery |
| **Also used in product** | Bank transfer (portal option + bank details on PDFs/emails); remote card / payment-request links (Stripe/Shift4 style payable amounts) |
| **Bank details (customer-facing)** | Published company bank details live in the shared `bankDetails` modules used on PDFs/emails — do not duplicate account numbers in internal notes |
| **Implements** | Terms payment section; `BookingForm.jsx` payment options; admin payment methods; `sendBookingReceipt` / PDF bank block |

---

## 5. Cancellations and refunds

### P9 — Private hire cancellation

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval for any fee schedule; published principle recorded |
| **Applies to** | Standard private hire bookings |
| **Published wording** | Notify as soon as possible; cancellations less than **24 hours** before scheduled pickup may incur a cancellation fee; no-show charges may apply; significant changes may incur fees. **No automatic refund table** in main terms. |
| **Implements** | Versioned terms HTML; booking status handling (no coded fee matrix found) |

### P10 — Spires Share cancellation and refunds

| Field | Value |
| --- | --- |
| **Status** | Pilot rules in code + `share-terms.html`; treat as Share-specific |
| **Applies to** | Share reservations |
| **Decision (as coded)** | Unpaid/eligible cancel **>24h** free seat release; **≤24h** late cancellation. Refunds during pilot are **manual** (statuses such as pending/refunded/retained/partial). Confirmed journey can remain confirmed if another passenger leaves. Emails must not claim an automatic refund was issued. |
| **Implements** | `spires-website/share-terms.html`; `functions/src/spiresShare/*`; Share emails |

---

## 6. Vehicle capacity and luggage

### P11 — Private hire vehicles

| Field | Value |
| --- | --- |
| **Status** | Approved as published practice |
| **Decision** | Standard Car up to **4** passengers (Toyota RAV4/Corolla or similar). 8 Seater up to **8** (Mercedes Vito or similar). Executive: Mercedes E Class or equivalent (partner may provide); suitability confirmed before acceptance. Models may vary; luggage space depends on passenger numbers and bag sizes — customers must say if luggage is large or extra. |
| **Implements** | `functions/src/vehicleTypes.ts`; rates/airport copy; guest and portal vehicle + passenger/luggage fields |
| **Terms** | Luggage assistance as standard; no bag-count SLA for private hire |

### P12 — Share luggage and capacity

| Field | Value |
| --- | --- |
| **Status** | Needs Hashim’s approval to publish fully on Share terms |
| **Coded defaults** | Capacity **5**; **1 large + 1 cabin** per passenger; vehicle max **5 large / 5 cabin**; Heathrow T3 pilot fare **£35**/passenger (optional 4-pax pricing exists in product config) |
| **Implements** | `functions/src/spiresShare/defaults.ts`; Share UI |
| **Gap** | Luggage caps are stronger in code than in `share-terms.html` |

---

## 7. Cotswolds hire

### P13 — Cotswolds timed hire prices and overtime

| Field | Value |
| --- | --- |
| **Status** | Approved in November service update; aligned with current `service-policy.json` |
| **Applies to** | Cotswolds trip / private tour timed hire |
| **Effective** | Service policy versions `2026-11-15` and `2026-11-19` (same Cotswolds numbers) |
| **Approved numbers** | Durations **4 / 6 / 8** hours. Standard **£180 / £260 / £340**. Executive **£240 / £350 / £460**. 8 Seater **£220 / £320 / £420**. Extra time **£10 per started 20 minutes** for all categories. |
| **Customer rules** | Total hire includes collection, all driving/stops and final drop-off; driver travel to collect excluded. Customer lateness uses hire time; driver lateness shifts finish. Four hours is not four hours sightseeing. No guided commentary; tickets/meals excluded; parking as quoted. Exceptional disruption (unexpected accident, unplanned closure, emergency diversion, severe weather) reviewed separately; passenger delays remain chargeable. |
| **Implements** | `service-policy.json`; `cotswoldsPolicy.ts`; `timedHire.ts`; Cotswolds website page; rates; contact/`cotswolds-booking.js`; portal/admin Cotswolds fields; terms Cotswolds section |
| **Existing bookings** | Keep agreed `timedHire` / accepted rates and policy snapshot |

---

## 8. Spires Share

### P14 — Share product promises

| Field | Value |
| --- | --- |
| **Status** | Pilot; public gating may keep Share off general launch |
| **Terms version** | `SHARE_TERMS_VERSION` (e.g. `spires-share-pilot-2026-10`); prior versions rejected for new accepts |
| **Decision (as published/coded)** | Interest ≠ confirmation. Payment by one passenger ≠ confirmation. Confirmed only when required payments are received and verified (`PAYMENT_GUARANTEE_NOTICE`). Meeting point Thornhill Park & Ride for Heathrow pilot. Waitlist offer window **60 minutes**. |
| **Config notes** | `publicEnabled: false`, `requiresRegulatoryApproval: true` in defaults — regulatory/public switch is internal |
| **Implements** | `share-terms.html`; Share pages; portal Share UI; Share notifications; admin Share tools |
| **Existing bookings** | Keep reservation `termsVersion`, fare and refund/cancellation fields |

---

## 9. Internal booking rules that affect customers

### P15 — Terms acceptance and version stamps

| Field | Value |
| --- | --- |
| **Status** | Approved mechanism; current version `2026-11-19` |
| **Applies to** | New online accepts (website, customer portal); staff-reported accepts |
| **Decision** | New acceptances must match `CURRENT_BOOKING_TERMS.version`. Existing agreements keep their `termsVersion`. Confirmations include acceptance summary + terms URL for that version. |
| **Implements** | `bookingTerms.ts`; guest form hidden `termsVersion`; portal `BookingForm`; admin staff acceptance; PDF/email confirmation paragraph |
| **Drift to fix under open work** | `functions/src/bookings/guestHandlers.ts` audit path hard-codes `termsVersion: "2026-10-25"` in at least one place — mismatch with current accept path |

### P16 — Waiting / service snapshots on bookings

| Field | Value |
| --- | --- |
| **Status** | Approved mechanism |
| **Decision** | Airport collections stamp `waitingPolicyVersion` at acceptance. Quotes may copy service terms into `acceptedServiceTerms`. Edits to older bookings must not silently replace agreed waiting terms. PDFs/emails use the booking’s stamped version. |
| **Implements** | `guestRequest.ts` collection terms; portal/admin; `airportWaitingTextForBooking`; quote callables |

---

## Conflicts customers may see

Do **not** silently pick a side except where Hashim has already confirmed (P3 = 50 minutes flight-monitored).

| Topic | Version A | Where | Version B | Where | Decision |
| --- | --- | --- | --- | --- | --- |
| Flight-monitored allowance | **50 minutes** from actual landing | Current `service-policy.json`, terms `2026-11-19`, most public pages, Hashim confirmed | **60 minutes** | Terms `2026-11-15` (historic for those bookings); archived [`NOVEMBER_SERVICE_UPDATE-2026-11-15.md`](../archive/NOVEMBER_SERVICE_UPDATE-2026-11-15.md) | **Approved: 50 for new current-version bookings.** Keep 60 only for stamped `2026-11-15` bookings. `collection-policy.js` now follows shared policy for current stamp. |
| Overage charge | **£5 / started 15** | Current policy, terms 2026-11-15 and 2026-11-19, most EN + translated pages | **£10 / 30** | Legacy constant; older terms; `about.html` still has an extra £10/30 bullet beside a £5/15 paragraph; Oxfordshire Heathrow FAQ schema; `driver-hub-private.js` falls back to £10/30 when the published map misses a version; older wording formerly in [`offers-and-messages.md`](../offers-and-messages.md); some international wording | **Needs Hashim’s approval** to declare the permanent overage rule and clean leftovers. Current published stamp uses £5/15. |
| Fixed-time | **15 minutes** from booked time | Current policy + terms | Omitted / flight-only FAQs | Some meta/FAQ | **Needs Hashim’s approval** before changing; keep distinct from P3 |
| Payment channels | In-vehicle cash/card in short terms | Terms | Bank transfer + remote payment requests | Portal, PDFs, emails | **Needs Hashim’s approval** to unify wording |
| Share luggage | Caps in code | Share defaults | Thin/missing in Share terms HTML | `share-terms.html` | **Needs Hashim’s approval** to publish |
| Primary CTA | **Request a quote** → contact guest form | EN homepage / airport pages (in-progress fix) | **Book online** → portal | Many translated + older EN town pages | Align CTAs to glossary; portal remains for Manage my booking |
| Deposit label | **Deposit paid** / **Balance due** | Glossary + PDFs (`Balance due`) | “Deposit: Paid”, “Payments received, including deposit” | Customer portal `Dashboard.jsx` | Apply glossary strings when polishing portal copy |
| Guest audit terms | Current accept `2026-11-19` | Guest accept path | Hard-coded `2026-10-25` | `functions/src/bookings/guestHandlers.ts` audit path | Fix under open work; do not rewrite historic accepts |

---

## Change history (approved policy changes)

| Effective | Change | Existing bookings |
| --- | --- | --- |
| Pre-dated / `previous-public`, `2026-10-25` | Flight waiting **50** minutes; overage **£10 per 30 minutes** | Keep those agreements |
| **2026-11-15** | Flight waiting **60** minutes; fixed **15**; overage **£5 per started 15**; Cotswolds prices and **£10 / 20** overtime published | Keep `waitingPolicyVersion` / terms `2026-11-15` and Cotswolds snapshots |
| **2026-11-19** | Flight-monitored allowance set to **50** minutes from actual landing (Hashim confirmed). Fixed-time **15** and overage **£5 / 15** remain as published on this stamp unless later approved otherwise. Terms version bumped to `2026-11-19`. | `2026-11-15` and earlier stamps unchanged |

Add a row here whenever an approved policy change ships.

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`../offers-and-messages.md`](../offers-and-messages.md) | Email/offer release checks only |
| [`../archive/NOVEMBER_SERVICE_UPDATE-2026-11-15.md`](../archive/NOVEMBER_SERVICE_UPDATE-2026-11-15.md) | Historical 15 Nov 2026 brief (60-minute flight allowance conflict noted) |
| [`../share/SPEC.md`](../share/SPEC.md) | Share development specification |
| [`../admin/BOOKINGS_SYSTEM.md`](../admin/BOOKINGS_SYSTEM.md) | How bookings are created and stamped |

## Agent checklist (short)

Before changing customer-facing policy material:

1. Find the register entry (or add an open question marked **Needs Hashim’s approval**).
2. Read shared config and the version map for existing bookings.
3. List surfaces: website (EN + translations), guest form, portal, admin, emails, PDFs, driver/office tools.
4. If approved: update register + config + surfaces together; sync shared sources; run `npm run policy:check`.
5. If mismatched: stop and report; do not invent a new rule.
6. Never rewrite historic terms pages that existing bookings still point to.
7. Use glossary labels and navy/gold design; verify waiting (50 minutes) and payment (£235/£35→£200) examples when those areas change.
