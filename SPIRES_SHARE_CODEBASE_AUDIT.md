# Spires Share — codebase audit

**Date:** 28 September 2026  
**Scope:** Read-only audit of the existing hidden shared airport transfer product.  
**Constraint:** This document does not enable, publish, index, or take live payments. No product code was changed for this audit.

Values below are **what the code actually does today**, not what an earlier specification may have intended.

**Git origin:** Feature landed in commit `d2a19b6` (21 September 2026), message *Add a hidden Spires Share workspace behind a feature flag.* Terminology in that commit and current code is **Spires Share**, not “rideshare”. Public marketing HTML does not mention the product.

---

## Verdict

Spires Share is a **backend-plus-admin prototype**. Matching, occupancy, mock authorise/capture/release, waitlist stubs, and an admin “customer preview” exist. There is **no public customer product**. Real card payments, customer notifications, return journeys, real home-collection routing, and terminal selection are **not implemented**.

**It is not production-ready and is not publicly bookable.**

---

## 1. Files and components

### Backend (source of truth)

| Path | Role |
| --- | --- |
| `functions/src/spiresShare/defaults.ts` | Proposed config defaults, `SPIRES_SHARE_ENABLED` flag reader |
| `functions/src/spiresShare/types.ts` | Journey/booking/payment/waitlist/audit types |
| `functions/src/spiresShare/logic.ts` | Matching, occupancy, luggage, mock payment, home-collection stub |
| `functions/src/spiresShare/callables.ts` | HTTPS callables + 15-minute scheduled deadline tick |
| `functions/src/spiresShare/logic.test.ts` | Unit tests for pure logic (not callable/Firestore integration) |
| `functions/src/index.ts` | Re-exports Share functions |
| `functions/lib/spiresShare/*` | Compiled copies of the above |

### Admin UI

| Path | Role |
| --- | --- |
| `spires-admin-fresh/src/components/SpiresShareAdmin.tsx` | Board, customer preview, driver, config |
| `spires-admin-fresh/src/App.tsx` | Renders the tab when `activeTab === 'spires-share'` |
| `spires-admin-fresh/src/utils/constants.ts` | Nav item `Spires Share (dev)` |
| `spires-admin-fresh/share-preview.html` | **Untracked** static mock of the admin UI. `noindex, nofollow`. Not wired into Firebase hosting (`public` is `spires-admin-fresh/build`). Local-only unless someone hosts it separately. |

### Rules, indexes, blocking

| Path | Role |
| --- | --- |
| `firestore.rules` | Deny-all client access on all `spiresShare*` collections |
| `firestore.indexes.json` | Composite index `spiresShareJourneys`: `airportId` + `travelDate` |
| `spires-website/vercel.json` | `/share`, `/share/:path*`, `/spires-share`, `/spires-share/:path*` → `404.html` |
| `spires-website/robots.txt` | `Disallow: /share` and `/spires-share` |
| `spires-website/scripts/generate-sitemap.mjs` | Explicitly skips `/share` and `spires-share` |
| `customer-app/public/robots.txt` | Same disallow paths (no Share routes exist in the customer app) |

### Docs (not executable product)

| Path | Role |
| --- | --- |
| `SPIRES_SHARE_SPEC.md` | Development specification (proposed defaults, architecture) |
| `SPIRES_SHARE_PRELAUNCH_CHECKLIST.md` | Launch blockers; **none ticked** |

Compiled JS under `functions/lib/` mirrors source. Stripe in `functions/src/payment.ts` is **not** used by Share.

### Terminology search

| Term | Found in Share product code? |
| --- | --- |
| rideshare / ride share | No |
| shared transfer / shared airport / shared ride | No (product name is **Spires Share**) |
| Heathrow shared / Gatwick shared | No |
| seat / seats | Yes — occupancy fields and admin copy (“seats remaining”). No seat map. |
| Thornhill | Yes — meeting point `thornhill_pr` / “Thornhill Park & Ride” |
| `/share` | Marketing 404 + robots disallow only |

Unrelated hits: Google review URLs (`share.google/...`) on the public site.

---

## 2. Hidden routes or pages

**Public marketing site (`spires-website`):** no Share HTML page, no nav link, no header/footer mention.

**Intended public URLs (blocked):**

- `https://www.spires-taxis.com/share`
- `https://www.spires-taxis.com/share/*`
- `https://www.spires-taxis.com/spires-share`
- `https://www.spires-taxis.com/spires-share/*`

**Actual working UI:** admin dashboard tab **Spires Share (dev)** after Firebase login. Not a public URL. Admin hosting (`firebase.json` → `spires-admin-fresh/build`) is an SPA that rewrites `**` to `index.html`; that is the private-hire admin app, not a customer Share booking page.

**Customer app:** no Share routes or components. Only robots disallows.

**Callable named as if public:** `spiresSharePublicAccess` always throws `not-found` (“Spires Share is not available.”).

---

## 3. Are those URLs accessible if someone knows them?

**Marketing site:** no. Vercel returns **HTTP 404** via `404.html` (`noindex, follow` on that 404 page).

**Knowing a Firebase callable name:** `spiresSharePublicAccess` is deployed as a callable but always fails. Search / propose / join / admin actions require a signed-in user whose email is exactly `spirestaxis24@gmail.com` or `hashim@spires.com`.

**Knowing the admin URL:** anyone who can log into the admin app sees the Share tab in navigation. Callables still reject non-allowlisted emails. Admin login is not further restricted in `App.tsx` beyond Firebase Auth.

**Firestore from a browser:** Share collections are `allow read, write: if false`. Only Cloud Functions (Admin SDK) can read/write them.

---

## 4. Indexed, noindex, blocked, or absent from sitemap?

| Control | Status |
| --- | --- |
| `sitemap.xml` | **Absent** — no `/share` or Share URLs |
| Sitemap generator | Extra skip for `/share` and `spires-share` |
| `robots.txt` | **Disallow** `/share` and `/spires-share` |
| Share landing `noindex` | **N/A** — there is no Share HTML page to tag |
| Direct URL | **404**, not a soft-hidden indexable page |
| Untracked `share-preview.html` | Has `noindex, nofollow`; not part of the live marketing site |

---

## 5. Current Oxford → Heathrow shared fare

From `DEFAULT_SHARE_CONFIG` in `functions/src/spiresShare/defaults.ts` (overridable in Firestore `spiresShareConfig/current` if an admin saved config):

- **£35.00 per passenger** (`farePence: 3500`)
- Target revenue **£175.00** (`targetRevenuePence: 17500`)
- Early 4/5 equal split (if offered and accepted): **£43.75** (`17500 / 4`)

These are **proposed defaults in code**, not published website prices. They are not shown on `oxford-to-heathrow-taxi.html` (that page is private-hire £92 Standard Car).

---

## 6. Current Oxford → Gatwick shared fare

- **£45.00 per passenger** (`farePence: 4500`)
- Target revenue **£225.00** (`targetRevenuePence: 22500`)
- Early 4/5 equal split: **£56.25** (`22500 / 4`)

Same caveat: config defaults only, not on the public Gatwick page.

---

## 7. Vehicle capacity assumptions

| Setting | Default | Used? |
| --- | --- | --- |
| `passengerCapacity` | **5** | Yes — journey `capacity`, join oversell check |
| Luggage per passenger | 1 large + 1 cabin | **Stored only** — not enforced on book |
| Luggage per vehicle | 5 large + 5 cabin | Yes — `luggageFits()` on search/join/propose |
| Commercial vs legal max | Spec says commercial max 5 | Not distinguished in code |

Occupancy is **passenger count**, not number of booking records (a party of 2 occupies 2).

Admin config can change capacity; save still forces `publicEnabled: false`.

---

## 8. Minimum passenger / minimum departure rules

| Rule | In code? |
| --- | --- |
| At least **1 passenger** to propose/join | Yes |
| Party must fit remaining seats | Join: yes. Propose: **no capacity check** (a 6-passenger propose can write `occupiedSeats: 6` on a capacity-5 journey) |
| Minimum to **operate / confirm** | **5/5** (full) **or** **4/5** with every travelling passenger accepting early departure |
| Minimum to **create a departure** | **1** — a lone customer can propose `PROPOSED` 1/5 |
| Confirm blocked if occupancy is 1–3 (and not the early-departure path) | Yes — admin `confirm` throws “Journey is not eligible to confirm.” |

There is no “minimum X bookings before the departure exists”. Times are created by the first proposer.

---

## 9. How available departure times are created

**Not a published timetable.**

1. Admin (simulating a customer) enters a preferred Thornhill time (`HH:MM`) and date.
2. Search looks for existing journeys same airport + date, time within flexibility, seats, luggage, optional flight buffer.
3. If matches exist, propose returns `needsChoice` unless `forcePropose` (“Propose anyway (dev)”).
4. If none (or forced), a **new journey** is created with that requested time as `departureTime`.
5. Public number format: `SS-YYYYMMDD-HHMM`.

Flexibility options: exact, ±15, ±30, ±60 minutes.

Admin can later `change-time` if every booking’s flight buffer still holds.

**Timezone gap:** `confirmationDeadlineAt` is built with `new Date(\`${travelDate}T${departureTime}:00\`)` then `setHours` minus 24. That is the Cloud Function host timezone (typically UTC), not explicitly Europe/London, even though the tick runs on a London schedule.

---

## 10. How customers select seats

**They do not pick a seat.** There is no seat map, no aisle/window, no named seat numbers.

The form field is **Passengers** (integer). “Join this journey” / “Propose new journey” books that many occupied seats if payment mock-authorises.

When remaining seats are 0, the preview shows **Join waitlist** instead.

---

## 11. How passenger numbers are tracked

- Journey field `occupiedSeats` is incremented in a **Firestore transaction** on join.
- Propose sets `occupiedSeats` to the proposing party size.
- Admin inspect/board display `occupiedSeats/capacity`.
- Move-booking decrements source and increments target in one transaction.
- Status derived from occupancy: `PROPOSED` (0–1), `FILLING`, `ALMOST_FULL` (capacity−1), `FULL` (at capacity), unless already `CONFIRMED` / `CANCELLED` / `EXPIRED` / `COMPLETED` / `AWAITING_EARLY_DEPARTURE_DECISION`.

Search matching **excludes** full journeys via `canAddPassengers` (they will not appear as joinable matches). Waitlist is a separate collection.

`getState` also loads all bookings (limit 500) so admin can sum passengers per journey; the live constraint is the journey document’s `occupiedSeats`.

---

## 12. What happens when the required passenger number is not reached

Scheduled `scheduledSpiresShareTick` (every 15 minutes, `Europe/London`) and admin **Run deadline tick** call `runShareDeadlineTick()`:

- Loads journeys in `PROPOSED`, `FILLING`, `ALMOST_FULL`, `AWAITING_EARLY_DEPARTURE_DECISION`.
- If `confirmationDeadlineAt` has passed **and** `occupiedSeats < capacity`, status → **`EXPIRED`**.
- Mock payments on those bookings: open authorisations → **`AUTHORISATION_RELEASED`**.
- **Already `CAPTURED` payments are not released or refunded.**
- Audit event `JOURNEY_EXPIRED`.
- **No email, SMS, or WhatsApp.**

Admin can also **Cancel** at any time: status `CANCELLED`, same mock release (not a captured refund).

4/5 does **not** auto-confirm. Someone must offer early departure and all parties must accept, then admin Confirm — or the journey expires at the deadline like any unfilled trip.

---

## 13. Can customers currently make payment?

**No public customer payment.**

The only booking path is the **admin customer preview**, which calls `spiresShareProposeOrJoin`. That always uses `MockPaymentProvider`. There is no card form, Stripe PaymentIntent, or Shift4 call in Share.

Private-hire Stripe (`createPaymentIntent` / `confirmPayment`) is a different product and is not referenced from `spiresShare/`.

---

## 14. Payment captured immediately, authorised/held, or simulated?

**Simulated authorise → later simulated capture or release.**

Intended state machine (mock only):

1. Join/propose: in-memory `authorise()` → Firestore `spiresSharePayments` + booking `AUTHORISED`. Amount = `farePence × passengers`. Home-collection surcharge is **not** added to the amount.
2. Seat is treated as secured if status is `AUTHORISED`, `CAPTURE_PENDING`, or `CAPTURED`.
3. When join takes occupancy to **FULL**, backend **mock-captures** all bookings on that journey.
4. Admin **Confirm** (full or accepted 4/5) also mock-captures.
5. Cancel / expire mock-releases open auths.

`MockPaymentProvider` is a new in-memory map **per request**. Capture/release on later requests use Firestore status strings (`mockCaptureIfAuthorised` / `mockReleaseIfOpen`), not a real acquirer hold.

**No money moves.** `REFUNDED` exists as a type and is never written.

Propose authorises **before** the transaction. If the transaction failed after a real provider auth, compensation would be required; that path is untested because payment is fake.

---

## 15. Cancellation / refund logic

| Situation | Code behaviour |
| --- | --- |
| Admin cancel journey | `CANCELLED` + mock release of non-captured payments |
| Deadline miss (not full) | `EXPIRED` + same mock release |
| Customer self-cancel one booking | **Not implemented** |
| Refund after capture | **Not implemented** (`mockReleaseIfOpen` leaves `CAPTURED` unchanged) |
| Policy / T&Cs | Checklist item unticked; no Share-specific legal copy on the public site |
| Waitlist | Seat “not secured”; no payment row on waitlist add |

---

## 16. Customer confirmation process

**No customer-facing confirmation.**

What exists:

- Unconfirmed journeys carry `UNCONFIRMED_WARNING` on public DTOs (admin preview lists).
- `FULL` or admin `CONFIRMED` is treated as confirmed **for display** in `toPublicJourney`.
- Private-hire email triggers (`onBookingWrite` on `bookings/{id}`) **do not** listen to `spiresShareBookings`.
- No OTP, no booking-management link, no PDF for Share.
- Check-in / arrive-15-min / boarding-closes-5-min are **config defaults only**. Driver buttons set `boardStatus` / `driverStage` without enforcing those times.

---

## 17. Admin controls

Tab **Spires Share (dev)** (any signed-in admin UI user can open it; APIs require allowlisted emails):

**Board**

- List journeys, occupancy, mock secured/captured totals, home collections, waitlist counts
- Inspect bookings (full name, email, payment/board status)
- Move booking between same airport + date journeys (transaction, seat + flight-buffer checks)
- Offer 4/5 early departure
- Confirm / cancel
- Add waitlist test entry / offer next waitlist seat
- Run deadline tick

**Customer preview** (labelled not public)

- Search, propose, join, waitlist, “Propose anyway (dev)”

**Driver view**

- First name only, passenger count, board status
- Check-in / boarded / no-show
- Accept early fare (admin acting as passenger)
- Departed / arrived / completed

**Config**

- Capacity, early-departure threshold, max home collections, confirmation hours
- Save **cannot** set `publicEnabled: true` (forced false; regulatory flag forced true)
- Last 20 audit events

Missing vs a real ops tool: no driver app, no assignment of vehicle/driver to a Share journey, no live map, no customer message send.

---

## 18. Database collections / tables

Firestore only (no SQL). Deny-all from clients.

| Collection / doc | Purpose |
| --- | --- |
| `spiresShareConfig/current` | Runtime config (merged over defaults) |
| `spiresShareJourneys/{id}` | Departure, occupancy, status, fares, deadline |
| `spiresShareBookings/{id}` | Party, contact, luggage, mock payment, board, home eligibility |
| `spiresSharePayments/{id}` | Mock payment amount + status |
| `spiresShareWaitlist/{id}` | Waitlist rows |
| `spiresShareAudit/{id}` | Event type, actor email, refs, server timestamp |

Indexes: one composite on journeys `airportId` + `travelDate`. The tick query is `status in [...]` (single-field; Autopilot/single-field indexes usually suffice). No `journeyId` composite on bookings (equality queries still work).

---

## 19. Can unrelated customers safely book the same departure?

**Designed for that, only via admin-authenticated callables today.**

Join re-reads occupancy inside a transaction and rejects if `occupied + adding > capacity`. Multiple bookings can share one `journeyId`.

**Gaps:**

- There is no public multi-user client, so this is untested under real concurrent customers.
- Two admins proposing the same slot at once can create **two journeys** (match check is outside the create transaction).
- Propose does not cap party size at vehicle capacity.
- Search from the admin form passes the preview object **without nesting `luggage`**, so search matching may **ignore luggage** even though join/propose send luggage correctly.

---

## 20. Overselling seats

**Join path:** transactional occupancy check — **prevents 6/5** for that path, covered by unit tests on `canAddPassengers`.

**Not fully safe:**

- Propose can write occupancy above capacity.
- Frontend remaining-seat counts are display-only (correct; server is source of truth on join).
- Waitlist cannot convert an offer into a paid booking in code (`ACCEPTED` status unused).
- Luggage vehicle caps can block a join even when a seat number remains.

---

## 21. Home pickup functionality

**Stub only.** Comment in code: *Dev stub: never uses a private origin. Postcode presence only.*

- Empty postcode → unavailable (board at Thornhill).
- Non-empty postcode and `homeCollectionCount < max` (default 2) → eligible, surcharge from config (default **£0**).
- No geocoding, no extra time, no address, no route, no private yard/origin in public DTO (`stripPrivateFields`).
- Search always evaluates home collection as if `currentHomeCollections === 0` (does not use the matched journey’s count).
- Eligible collections increment `homeCollectionCount` on the journey; surcharge is **not** added to mock payment amount.

---

## 22. Current pickup / drop-off locations

| Role | Coded default |
| --- | --- |
| Pickup / meeting point | **Thornhill Park & Ride** (`id: thornhill_pr`) |
| Heathrow drop-off label | **Heathrow Terminals 2 & 3** |
| Gatwick drop-off label | **Gatwick Airport** |
| Home | Optional postcode field only |

No other airports in defaults. No Oxford city-centre stop. No station list.

Checklist still has **Thornhill collection permission** unticked.

---

## 23. Heathrow terminal handling

**Label only.** No terminal picker, no T4/T5, no T2 vs T3 split, no airline/terminal lookup. Flight number is optional free text stored on the booking, not used to choose a terminal.

Flight **time** (if provided) is checked against estimated duration (75 min) + **180 min** safety buffer. Missing flight time skips that check. Code never guarantees the passenger will catch the flight.

---

## 24. Gatwick handling

Same as Heathrow with different fare, 110 min estimated duration, same 180 min buffer, drop-off label **Gatwick Airport** (no North/South).

---

## 25. Return journey functionality

**Not implemented.** One-way Thornhill → chosen airport only. No inbound airport → Oxford Share, no linked return, no “book both ways”.

(Admin private-hire bookings have a separate duplicate/return helper; Share does not use it.)

---

## 26. Email / SMS / WhatsApp notifications

**None in Share code.** No nodemailer/Twilio/WhatsApp imports under `functions/src/spiresShare/`.

Existing private-hire emails (confirmation PDF, reminders, admin new-request) hook `bookings` / `customers`, not Share collections.

Early-departure “all must accept” has **no customer notification**; acceptance is an admin/driver button.

---

## 27. Incomplete TODOs, placeholders, test data, unfinished work

- Home collection **explicitly a stub**
- `PaymentProvider` comment: future Shift4; **no adapter**
- `SPIRES_SHARE_ENABLED` is reported on admin state (`envFlag`) but **public callable always 404s** even if the env var were true; launch is not a one-flag flip in current callables
- Config fields unused in runtime: `checkInHoursBeforeDeparture`, `arriveBeforeDepartureMinutes`, `boardingClosesMinutesBeforeDeparture`, per-passenger luggage caps
- Waitlist: `OFFERED` can be set; **no accept/book/pay/expire-offer flow**
- Payment statuses `PAYMENT_METHOD_PENDING`, `AUTHORISATION_PENDING`, `CAPTURE_PENDING`, `REFUNDED` largely unused
- Admin preview default time `10:15`; tests use journey `10:30` / date `2026-09-29` as fixtures
- Untracked `share-preview.html` (static dummy journeys, e.g. `SS-20260929-1030`)
- Pre-launch checklist: **every item still open**
- Unit tests cover logic helpers only — **no emulator tests** of transactions, tick, or callable auth
- `getState` returns **full booking PII** to the admin client (names, emails, mobiles)

---

## 28. Security and privacy concerns

**Done well for an unlaunched prototype**

- Client Firestore locked
- Public callable always not-found
- Marketing URLs 404 + robots + sitemap skip
- Public journey DTO omits names, phones, emails, postcodes, flight numbers, private origin
- Driver view uses first name only
- Config save cannot enable public launch

**Concerns before any public launch**

- Admin allowlist is **two hardcoded emails** in functions and rules (easy to drift; no role system)
- Any Firebase user who can open the admin app **sees the Share tab**; only the callable fails
- `getState` downloads up to 500 bookings of PII into the browser
- Waitlist stores name/email with no payment and no retention policy
- Mock payment IDs are guessable (`pay_{bookingId}`)
- No customer auth/OTP; contact fields are whatever the admin types
- Concurrent propose can duplicate departures
- Deadline datetime timezone is ambiguous
- `share-preview.html` must not be copied onto a public host
- Regulatory/insurance/T&Cs/privacy review are checklist items, not code

---

## 29. What prevents production readiness

1. No public booking page or customer account/OTP flow  
2. Payments are mock; no acquirer, no auth duration, no captured refunds  
3. No customer notifications when confirmed, expired, cancelled, or early-departure offered  
4. Thornhill / council / insurance / T&Cs / cancellation policy unsigned  
5. Home collection is not real routing  
6. Heathrow T2/T3-only label; no T4/T5 or Gatwick pier handling  
7. Propose oversell + search luggage wiring bugs  
8. Waitlist cannot complete a booking  
9. No returns  
10. Unused operational timings (check-in/boarding)  
11. Deadline timezone  
12. No load/concurrency test of join  
13. Feature flag does not actually open a public API  
14. Admin preview is the only “customer journey”

---

## Classification

| Area | Status |
| --- | --- |
| Feature hiding (404, robots, sitemap skip, deny-all rules, public callable 404) | **READY** (for staying hidden) |
| Firestore schema + Admin SDK write paths | **BUILT BUT NEEDS TESTING** |
| Occupancy / join oversell transaction | **BUILT BUT NEEDS TESTING** |
| Time matching + flight buffer helpers | **BUILT BUT NEEDS TESTING** |
| Luggage vehicle-cap check | **BUILT BUT NEEDS TESTING** |
| Admin board / inspect / move / cancel / confirm | **BUILT BUT NEEDS TESTING** |
| Admin customer preview (search / propose / join) | **BUILT BUT NEEDS TESTING** |
| Driver boarding buttons | **BUILT BUT NEEDS TESTING** |
| Config save (public launch forced off) | **BUILT BUT NEEDS TESTING** |
| Deadline tick (expire + mock release) | **BUILT BUT NEEDS TESTING** |
| Early departure offer/accept/fare maths | **BUILT BUT NEEDS TESTING** |
| Unit tests (`functions` `npm test`) | **BUILT BUT NEEDS TESTING** (logic only) |
| Public customer website / discovery | **NOT IMPLEMENTED** |
| Real payments (Stripe/Shift4/cards) | **NOT IMPLEMENTED** |
| Payment refunds after capture | **NOT IMPLEMENTED** |
| Customer confirmation messages | **NOT IMPLEMENTED** |
| Email / SMS / WhatsApp for Share | **NOT IMPLEMENTED** |
| Return journeys | **NOT IMPLEMENTED** |
| Seat map / named seats | **NOT IMPLEMENTED** |
| Published timetable of departures | **NOT IMPLEMENTED** |
| Home collection (real eligibility/routing/pricing) | **INCOMPLETE** |
| Heathrow terminals beyond T2&T3 label | **INCOMPLETE** |
| Gatwick North/South | **INCOMPLETE** |
| Waitlist offer → paid seat | **INCOMPLETE** |
| Customer cancel of one booking | **INCOMPLETE** |
| Per-passenger luggage enforcement | **INCOMPLETE** (config only) |
| Check-in / boarding time enforcement | **INCOMPLETE** (config only) |
| Propose party-size vs capacity | **INCOMPLETE** |
| Admin search luggage payload | **INCOMPLETE** (likely ignored) |
| Launch flag actually enabling public access | **INCOMPLETE** |
| Regulatory / Thornhill permission / insurance / T&Cs | **NOT IMPLEMENTED** (process, not code) |

**Overall product: INCOMPLETE — not production-ready, correctly kept hidden.**

---

## Customer journey as the software currently works

There is **no public customer journey**. What follows is the **admin preview simulation** plus backend rules that would apply if those callables were ever opened.

1. **Discover service**  
   Customer **cannot** discover it on spires-taxis.com, sitemap, or nav. Direct `/share` is a 404. The only UI is a signed-in admin opening **Spires Share (dev)**.

2. **Choose departure**  
   Admin fills airport (Heathrow or Gatwick), date, preferred Thornhill time, flexibility, optional flight time/number. **Search existing journeys**. If none, **Propose new journey** creates a departure at that time (`PROPOSED`, e.g. 1/5). If a close journey exists, admin must **Join this journey** (or force-propose in dev).

3. **Enter details**  
   Passengers (count), large suitcases, cabin bags, optional home postcode, name, mobile, email. No account, no OTP, no card details.

4. **Select / book seats**  
   Not a seat picker. Join/propose books N occupied seats if mock auth succeeds. If the vehicle is full, waitlist add (name/email/passengers) — **seat not secured**.

5. **Payment**  
   Immediate **mock authorisation** of `fare × passengers`. No card. No hold at a bank. Failure message: payment not authorised, seat not secured (join/propose abort).

6. **Minimum passenger threshold**  
   Journey stays unconfirmed with an on-screen warning until **5/5** (auto mock-capture on the joining request) or admin offers **4/5** and records every party’s acceptance, then admin Confirm (mock capture). Below that, at 24 hours before the coded deadline, tick sets **EXPIRED** and mock-releases auths.

7. **Confirmation**  
   No customer email/SMS. Status becomes `FULL` or `CONFIRMED` in Firestore. Admin sees it on the board. Customer would not be told by this software.

8. **Journey**  
   Driver view: check-in / boarded / no-show, then departed / arrived / completed. Meeting point assumed Thornhill; drop-off is the airport label. Home collection eligibility may be stored but is not routed.

9. **Cancellation / refund if threshold is not reached**  
   Tick or admin cancel → mock `AUTHORISATION_RELEASED`. No customer message. If a journey was already mock-captured (`FULL`/`CONFIRMED`), expire/cancel **does not** mock-refund.

---

## Admin journey as the software currently works

1. Sign into the Firebase admin app with an allowlisted email.  
2. Open **Spires Share (dev)**. Banner states launch is off and payments are mock.  
3. **Board:** see journeys and mock money; inspect PII; move passengers; confirm; cancel; offer 4/5; waitlist helpers; run deadline tick.  
4. **Customer preview:** impersonate a booker (search / join / propose / waitlist).  
5. **Driver:** mark boarding and trip stage.  
6. **Config:** edit capacity/threshold/home-collection max/deadline hours; save. Public launch stays false.  
7. Audit list shows recent event types and actor emails.

Admins cannot turn this into a public website from the config form. Launch still requires new public UI, real payments, notifications, legal/ops sign-off, and explicit product work — none of which this audit enabled.

---

## End of audit

No Share routes were added to navigation or `sitemap.xml`. `noindex` / 404 / feature-flag behaviour was not changed. Real payments were not enabled.
