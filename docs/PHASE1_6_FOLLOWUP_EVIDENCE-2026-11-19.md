# Phases 1–6 follow-up evidence — 19 Nov 2026

**Git baseline before this work:** `60ae311`  
**Production deploy:** **pending** — separate release decision required. Do not treat this document as a production smoke report.

## Phase 1 — Version integrity and drift

| Change | Evidence | Status |
| --- | --- | --- |
| Guest audit uses `CURRENT_BOOKING_TERMS` | `functions/src/bookings/guestHandlers.ts` | Done |
| Firestore customer create terms gate → `2026-11-19` | `firestore.rules` | Done |
| Event / quote / twickenham / main.js terms → `2026-11-19` | `spires-website/js/*`, event HTML pages | Done |
| Historic terms preserved | `terms/2026-10-25`, `2026-11-15`, `previous-public` untouched | Done |
| EN £10/30 leftovers aligned to current £5/15 | `about.html` (removed duplicate legacy bullet); Oxfordshire FAQ schema | Done |
| Locale £10/30 leftovers (de/pl/zh/hi/ur samples) | Replaced with £5/15 (+ fixed-time note where German pattern matched) | Done (spot-check remaining locales before release) |
| Permanent overage / fixed-time policy change | Not reinvented | **Needs Hashim’s approval** if changing P4/P5 beyond published stamp |

## Phase 2 — Journeys, labels, money

| Change | Evidence | Status |
| --- | --- | --- |
| Primary **Book online** → **Request a quote** `/contact#booking` | ~154 HTML pages; portal “My account” links kept | Done |
| Portal glossary labels | `customer-app/src/Dashboard.jsx` — Request received, Confirmed, Deposit paid, Balance due | Done |
| Payment request outstanding uses `effectiveReceivedPence` | `functions/src/quotes/callables.ts` `sendPaymentRequest` | Done |
| Driver collect / payment outstanding uses effective received | `driverTripLogic.ts`, `driverTrips.ts` | Done |
| £235/£35→£200 unit examples | Existing `paymentAmount.test.ts` / `bookingMoney.test.ts` | Keep |
| Return schedule P7 wording | Unchanged | **Needs Hashim’s approval** to change |
| Cancellation / payment-channel terms | Unchanged | **Needs Hashim’s approval** |

## Phase 3 — Family Jobs and Driver Portal

| Change | Evidence | Status |
| --- | --- | --- |
| Family Jobs left on admin path | No removal of `FamilyJobs.tsx` / family push | Preserved |
| Driver Hub Job Started action | `driverTrips.ts` `job_started` → `{leg}JobStartedAt`, leg `in_progress` | Done |
| Driver Hub UI + WhatsApp open-only | `driver-hub-private.js` Job Started button + preview; no auto-send | Done |
| Enrolment codes | New resets issue **six digit** one-use codes; unlock accepts **4 or 6** digits for legacy in-flight codes | Done |
| Auto WhatsApp dispatch | Not enabled | **Needs Hashim’s approval** |
| Separate PWA shell beyond existing `office-jobs.html` | Existing Driver Hub retained as extension point | Partial — full greenfield portal UI not duplicated |

## Phase 4 — Flight, waiting, parking, collection

| Change | Evidence | Status |
| --- | --- | --- |
| Flight provider | Still manual `verifiedLandingAt` + source (driver/admin). No public API keys added | Documented; automated provider **Verification needed** / outside public repo |
| Waiting calculator | Shared `airportWaitingPolicy` / `SpiresCollection.policyFor`; hub fallback default now £5/15 not £10/30 | Done |
| Parking tariff / evidence procedure | Not invented. Driver Hub notes office approval before parking affects Balance due | **Needs Hashim’s approval** |
| Amount to collect | Server `AmountToCollectPence` from effective received | Done |

## Phase 5 — Notifications

| Change | Evidence | Status |
| --- | --- | --- |
| Existing Family / Driver Hub push + SW | Left in place (`familyPush*`, `office-jobs-sw.js`) | Preserved |
| Reminder schedule | Not enabled with invented times | **Needs Hashim’s approval** |
| Auto-dispatch messaging | Not enabled | **Needs Hashim’s approval** |

## Phase 6 — Safeguards

| Check | Result |
| --- | --- |
| `npm run policy:check` (spires-website) | Run after edits — see command log in release notes |
| Functions `tsc` | Required before any functions deploy |
| Focused unit tests | paymentAmount / bookingMoney / driverTripLogic as available |
| Production deploy | **Not run** |
| Secrets / PINs in repo | Not committed |

## Hashim decision list (still open)

1. Confirm permanent overage narrative vs leftover locale edge cases after spot-check.
2. Fixed-time copy completeness on remaining FAQ/meta snippets.
3. Parking evidence, approval actor, and how extras reach customer balance.
4. Push reminder timing schedule.
5. Whether WhatsApp may ever auto-send (today: open only).
6. Authorise production deploy + Firestore rules publish for this follow-up.
7. Confirm six digit enrolment codes for new driver resets (legacy 4 digit still unlock).

## Manual smoke checklist (pre-deploy)

- [ ] Guest contact form submit stamps terms/waiting `2026-11-19`; audit event matches
- [ ] Event venue form still accepts (terms hidden `2026-11-19`)
- [ ] Portal pending shows Request received; paid deposit shows Deposit paid + Balance due
- [ ] £235 + £35 paid → £200 Balance due in portal + payment request + PDF
- [ ] Driver Hub: Job Started → preview WhatsApp; double tap does not duplicate
- [ ] Driver Hub: amount to collect matches admin for deposit-paid-without-ledger fixture
- [ ] about.html and Oxfordshire FAQ no longer show £10/30
- [ ] Historic terms URLs still serve old wording

## Rollback

- Revert git commit(s) on `main` / redeploy previous Vercel + Firebase Functions + Hosting + rules.
- Do not rewrite historic terms pages during rollback.
- Irreversible: customer WhatsApp opens and any sent emails already delivered — handle operationally.
