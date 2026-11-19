# Phase 0 audit ledger — post 19 Nov 2026 follow-up

**Repo revision (local/main):** `c84ae0b` — *Fix admin waiting-policy helper null check so the production build compiles.*  
**Prior release merge:** `3f45234` / PR #12.  
**Working tree note:** uncommitted `docs/CHAT_GPT_RELEASE_REVIEW-2026-11-19.md`, `docs/README.md` link, and local `functions/lib/*` CRLF/format noise from deploy `tsc` (not treated as product changes).  
**Deployment:** separate release decision required for any further production deploy. Reported shipped hosts were independently spot-checked for website policy JS (`2026-11-19`, flight 50, charge 5). Vercel `html` production Ready ~46m after admin fix push. Full end-to-end production behaviour remains **Verification needed**.

**Labels used:** **Approved** · **Published historical** · **Reported shipped** · **Verification needed** · **Needs Hashim’s approval**

**Tests run this Phase 0:**
| Command | Result |
| --- | --- |
| `npm run policy:check` in `spires-website/` | **PASS** (2 non-blocking WARNs: about.html + oxfordshire FAQ £10/30) |
| Live `GET /js/service-policy.js` | **PASS** version `2026-11-19`, `flightFreeMinutes: 50`, `chargePounds: 5` |
| Live homepage/contact/terms (prior deploy smoke) | **Reported shipped** earlier; not re-run exhaustively this phase |

**Assumptions:** Admin SDK bypasses Firestore client rules for callables. Historic terms HTML must remain readable for stamped bookings. Prompt’s “six digit PIN” for Driver Portal differs from today’s **four digit one-use** driver codes — do not change without approval.

---

## Journey map (intake → closeout)

| Stage | Interfaces | Server entry points | Evidence |
| --- | --- | --- | --- |
| Enquiry | Website `contact.html` + `guest-booking.js`; event/twickenham forms; portal `BookingForm.jsx` | `submitWebsiteQuote` → `handleGuestBookingHttp`; `createCustomerBooking` | Guest `depositRequired: false`; portal create via Admin SDK |
| Quote | Admin `QuoteEditor` / `BookingModal` | `saveQuoteDraft`, `issueQuote` | `issuedQuote.serviceTerms` can carry waiting fields |
| Acceptance | Portal `QuotePage`; public `quotePublic`; office `recordManualAcceptance`; terms links | `acceptQuote`, `applyAcceptance`, `recordStaffTermsAcceptance`, `acceptTermsPublic` | Must not silently rewrite stamped waiting/terms |
| Deposit / money | Admin deposit fields; `recordManualPayment`; Stripe callables; portal Dashboard; PDFs/emails | `paymentAmount.ts`, `bookingMoney.ts`, `createPaymentIntent`, `sendPaymentRequest` | £235/£35→£200 tested in unit tests |
| Confirmation docs | Email worker + PDF generators | `processEmailJob`, `pdfGenerator.ts` | Balance due row uses `effectiveReceivedPence` |
| Assignment | Admin drivers/vehicles; Family Jobs; Driver Hub | Booking `driverId` / `returnDriverId`; `assignedLegs` | Leg-scoped |
| Collection | Driver Hub / Family ops | `driverTripAction` (landing, ready, passenger_ready, onboard, complete, finalise, payment); `recordFlightVerification` | Manual landing source required; no automated flight provider found in functions |
| Closeout | Complete + payment record + charges | `driverTripAction` finalise/payment; admin corrections | Idempotent `driverActions/{requestId}` |

Office-created jobs: admin Firestore writes with revision; Family Jobs payloads in `familyJobs.ts`. Legacy: missing `waitingPolicyVersion` → legacy 50/£10/30 path in `airportWaitingPolicy.ts`.

---

## Audit table

| ID | Requirement | Source | Surfaces / entry points | Existing behaviour | Evidence | Tests | Proposed change | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Current flight waiting 50 from verified landing | Policy P3; `service-policy.json` | Website, guest, portal, PDFs, terms `2026-11-19` | CURRENT stamp 50/15/£5/15 | `service-policy.json`; `airportWaitingPolicy.ts` PUBLISHED map; live JS | policy:check PASS | Keep; sync only | **Approved** |
| A2 | Version map legacy / 11-15 / 11-19 | Prompt + register | Calculator + docs | Implemented in waiting engine | `airportWaitingPolicy.ts` | driverTripLogic / waiting tests exist | Preserve stamps on all edits | **Approved** |
| A3 | Historic terms immutable | AGENTS + prompt | `terms/2026-11-15`, `2026-10-25`, `previous-public` | Files present; live pointer `2026-11-19` | `spires-website/terms/*`, `terms-and-conditions.html` | — | Do not rewrite | **Published historical** |
| A4 | Guest booking stamps current terms/waiting | P15/P16 | `guest-booking.js`, `guestRequest.ts` | Booking record uses `CURRENT_*` | `prepareGuestBooking` / `collectionTerms` | guestRequest tests | Keep | **Approved** / **Reported shipped** |
| A5 | Guest audit event terms version matches booking | Prompt Phase 1 | `guestHandlers.ts` audit write | Audit hard-codes **`2026-10-25`** while booking is current | `guestHandlers.ts` ~L109 | — | Write `CURRENT_BOOKING_TERMS.version` (and URL if stored) | **Verification needed** → safe code fix once Phase 1 starts |
| A6 | Firestore customer create terms gate | firestore.rules | Direct client create (callable bypasses) | Still requires `termsVersion == '2026-10-25'` | `firestore.rules` ~L182 | — | Align to `2026-11-19` for any residual client path | **Verification needed** |
| A7 | Event / quote-form / twickenham stale terms | Website JS | `event-quote.js`, `quote-form.js`, event HTML hiddens | Still send `2026-10-25` → accept will reject vs current | rg hits | — | Point to current terms or retire unused forms | **Verification needed** |
| A8 | Public £10/30 leftovers | P5 conflicts | `about.html`, Oxfordshire FAQ JSON; de/pl/zh/hi/ur pages | EN check WARNs 2; more locales still legacy | check-waiting WARN; explore audit | policy:check WARN | Page-by-page cleanup proposal; apply £5/15 to current stamp copy | **Needs Hashim’s approval** for permanent rule; cleanup of current-stamp pages can be proposed as alignment to **Approved** published stamp |
| A9 | Fixed-time 15 omissions | P4 | EN index bullet; many translated pages; some FAQ JSON | Flight 50 stated without fixed 15 | explore audit | WARN only for wrong fixed numbers | Add fixed-time wording where claiming full collection policy | **Needs Hashim’s approval** before changing P4 itself; copy alignment to current published text is proposal |
| A10 | CTA Request a quote vs Book online | P17 | EN + ar/es/fr/it/pt/de + towns/guides | EN mixed; six locales **Book online only** for primary buttons | explore counts | — | Align primary CTAs to contact; keep Manage my booking → portal | **Approved** glossary; rollout scope **Verification needed** |
| A11 | Portal label glossary | P17 | `Dashboard.jsx` | “Deposit: Paid”, “Remaining balance”, “Awaiting confirmation” | Dashboard.jsx | — | Map to Deposit paid / Balance due / Request received where meanings match | **Approved** meanings; UI apply **Verification needed** |
| A12 | £235/£35→£200 same maths | P17 / AGENTS | paymentAmount, bookingMoney, PDF, portal | Unit tests pass; PDF uses effectiveReceived | `paymentAmount.test.ts`, `bookingMoney.test.ts` | PASS unit | Keep single effective-received rule | **Approved** |
| A13 | sendPaymentRequest / driver collect use raw amountReceived | Prompt Phase 2 | `sendPaymentRequest`, `driverTripLogic` amount-to-collect | May diverge when deposit paid but not in ledger | callables / driverTripLogic | — | Use `effectiveReceivedPence` where balance shown/charged | **Verification needed** |
| A14 | Dual paymentAmount vs bookingMoney | Register | backend + admin | Same overlap rules today | both modules + tests | unit PASS | Prefer shared module or parity test in CI | **Verification needed** |
| A15 | Return payment schedule | P7 | terms wording; dueOnOutbound/Return; leg AmountToCollectPence | Operational fields exist; terms describe first leg + half second | pdfGenerator, BookingModal, driverBooking | — | Preserve explicit ops; ask Hashim if conflicts | **Needs Hashim’s approval** to change published schedule |
| A16 | Cotswolds prices | P13 | service-policy, forms, terms | 4/6/8 and rates + £10/20 | service-policy.json | — | Preserve | **Approved** |
| A17 | Share gates | P14 | Share defaults/terms | Pilot gated | defaults.ts | — | No expansion this work | **Needs Hashim’s approval** for publish |
| A18 | Family Jobs mounted for staff | Prompt Phase 3 | Admin `FamilyJobs.tsx`, `familyJobs.ts`, family push | Family device PIN 4–8 digits hashed compare; TTL; throttle | `familyJobsAuthLogic.ts`, `familyPush.ts`, `office-jobs` SW | familyJobs.test / familyPushLogic.test | Keep Hashim/dad on this path | **Reported shipped** / **Verification needed** how users enter in production UI routing |
| A19 | External Driver Hub | Prompt Phase 3 | `office-jobs.html`, `driver-hub-private.js`, `unlockDriverJobs` | **4-digit one-use** codes, SHA-256, 24h activate, persistent session, revoke via generation, IP throttle 8/15m | `driverAccess.ts` | emulator tools exist | Prompt asks **6-digit** unique PIN — conflict with live 4-digit one-use design | **Needs Hashim’s approval** (4 vs 6; enrol model) |
| A20 | Driver scoped trips + idempotent actions | Phase 3 | `listDriverTrips`, `driverTripAction` | Assignment check; `driverActions/{requestId}` duplicate protection; revision guard | `driverTrips.ts` | driverTripLogic.test | Extend actions carefully; Job Started may be new | **Verification needed** (no Job Started symbol found — map to existing or add) |
| A21 | WhatsApp handoff | Phase 3 | driver-hub WhatsApp preview | Opens `wa.me` with encoded text; does not auto-send | `driver-hub-private.js` | — | Keep reviewable open-only unless approved auto-dispatch | **Reported shipped** open-only; auto-send **Needs Hashim’s approval** |
| A22 | Waiting calculator shared | Phase 4 | collection-policy.js, airportWaitingPolicy, driver hub | Hub uses `SpiresCollection.policyFor` with £10/30 only if Collection missing | collection-policy.js PUBLISHED+CURRENT; hub fallback | — | Audit fallback separately from legacy missing stamp | **Approved** calculator; fallback path **Verification needed** |
| A23 | Flight provider | Phase 4 | recordFlightVerification; driver landing action | Manual verified landing + source string; no Aviationstack/etc. found in functions | callables + driverTrips | — | Do not invent provider; document manual-only | **Verification needed** (credentials/config outside public repo?) |
| A24 | Parking extras | Phase 4 | admin expenses type parking; advertising costs | Expense type exists; no approved driver parking tariff/evidence procedure in register | types.ts expenses; Bookings CSV | — | Proposal only until Hashim decides evidence/approval path | **Needs Hashim’s approval** |
| A25 | Family/driver push | Phase 5 | familyPush*, office-jobs-sw.js | Family push exists; Driver Hub SW titles “Spires Driver Hub”; reminder schedule incomplete in docs | familyPush.ts, office-jobs-sw.js | familyPushLogic.test | Confirm reminder timing before enabling schedule | **Needs Hashim’s approval** (schedule); infrastructure **Reported shipped** |
| A26 | Design navy/gold + no hyphen compounds | AGENTS / labels | customer screens | Website CSS vars; portal partial hard-codes | style.css, labels.json | — | Reuse; apply glossary | **Approved** |
| A27 | Production deploy of this follow-up | Prompt | all hosts | Not authorised in this prompt | — | — | Stage evidence first | **Needs Hashim’s approval** / separate release decision |

---

## Extension points (smallest safe changes)

1. **Version integrity:** `guestHandlers` audit stamp; `firestore.rules` termsVersion; event/quote JS terms — no customer-facing number change.
2. **Money parity:** route `sendPaymentRequest` / driver collect through `effectiveReceivedPence`; add CI parity test paymentAmount ↔ bookingMoney.
3. **Copy drift:** EN leftovers + CTA pass; translated pages as a second batch behind approval list.
4. **Driver Portal:** reuse `driverAccess` / `driverTrips` / `driverTripLogic` / waiting calculator; do not rebuild Family Jobs for external drivers.
5. **Flight/parking/notifications:** audit-complete proposals; no tariff invention.

---

## Baseline failures / risks (ranked by customer harm)

| Rank | Finding | Harm |
| --- | --- | --- |
| High | Public £10/30 on about + Oxfordshire FAQ (+ several locales) vs current £5/15 | Wrong charge promise |
| High | Guest audit / rules / some forms still on `2026-10-25` while booking accepts `2026-11-19` | Evidence mismatch; some forms may fail accept |
| Medium | CTA Book online still dominant on translated/town pages | Wrong journey (portal vs quote) |
| Medium | Portal/email wording not glossary-aligned; payment request may ignore effective deposit | Confused balance |
| Medium | Prompt 6-digit PIN vs live 4-digit one-use codes | Spec conflict before Phase 3 build |
| Low | Fixed-time omitted in some FAQs/index | Incomplete policy |
| Low | Dual money modules | Future drift |
| Info | No automated flight API in repo | Manual verification only |

---

## Hashim decision list (blocking vs non-blocking)

**Blocking for disputed public cleanup / Phase 4–5 product rules:**
1. Permanent overage rule (£5/15 vs £10/30) — current stamp uses £5/15; cleanup of leftover pages proposed as alignment.
2. Fixed-time policy changes (if any beyond published 15).
3. Driver Portal credential model: keep 4-digit one-use vs move to unique 6-digit PIN.
4. Parking: evidence, approval, how it reaches customer balance.
5. Notification reminder schedule.
6. Auto WhatsApp dispatch vs open-only.
7. Return payment schedule wording changes (P7).
8. Authorise production deploy of follow-up work.

**Non-blocking (can proceed in Phase 1 with Approved sources):**
- Fix guest audit to current terms version.
- Align firestore.rules / stale event forms to current terms (or retire).
- Money effectiveReceived parity in payment-request/driver collect.
- Glossary labels on portal (wording only).
- CTA alignment to Request a quote where glossary Approved.
- Preserve historic terms; keep Cotswolds/Share gates.

---

## Phase gate

Phase 0 complete for planning. **No product code edited in Phase 0.**  
Next: Phase 1 (version integrity + drift inventory + approval-gated copy proposals) after you accept this ledger or mark decisions.
