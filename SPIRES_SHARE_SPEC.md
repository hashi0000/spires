# Spires Share — development specification

Spires Share is a **proposed, unlaunched** prebooked shared airport transfer product. It is built behind a feature flag and is **not publicly available**.

This document describes the development architecture. Values that look like prices, times, capacities or routes are **proposed defaults requiring approval**. They are stored in configuration, not hard-coded into customer-facing copy on the public website.

## Feature flag

- Environment: `SPIRES_SHARE_ENABLED=false` (default if unset).
- Config document also stores `publicEnabled: false` and `requiresRegulatoryApproval: true`.
- Saving configuration from admin **cannot** turn `publicEnabled` on.
- Public callable `spiresSharePublicAccess` always returns `not-found`.
- All other Share callables require a signed-in admin (`spirestaxis24@gmail.com` or `hashim@spires.com`).
- Public site: no nav, homepage, sitemap, SEO or booking links.
- Direct `/share` and `/spires-share` URLs on the marketing site return HTTP 404.
- Firestore client rules deny all read/write on Share collections. Only Cloud Functions (Admin SDK) can access them.

Authorised testing is done in the **admin dashboard after Firebase login**, not via a hidden public URL.

## Architecture

Existing stack (unchanged for private hire):

- Marketing site: `spires-website` (static HTML, Vercel)
- Customer private-hire app: `customer-app`
- Admin: `spires-admin-fresh` (React / TypeScript)
- Backend: Firebase Cloud Functions v1 + Firestore

Share lives in:

- `functions/src/spiresShare/` — types, config defaults, matching/occupancy/payment logic, HTTPS callables, scheduled tick
- `spires-admin-fresh/src/components/SpiresShareAdmin.tsx` — hidden admin / customer preview / driver / config UI
- Firestore collections listed below
- `SPIRES_SHARE_PRELAUNCH_CHECKLIST.md` — launch blockers

Private-hire booking, Stripe-in-codebase (unused in Share), invoices and customer app flows are not used by Share.

## Database schema

All Share collections are **deny-all** in `firestore.rules`.

### `spiresShareConfig/current`

Single config document. Proposed defaults:

| Field | Proposed default | Notes |
| --- | --- | --- |
| `publicEnabled` | `false` | Forced off on save |
| `requiresRegulatoryApproval` | `true` | Forced on |
| `passengerCapacity` | `5` | Commercial max, not legal vehicle max |
| `earlyDepartureThreshold` | `4` | Launch: only offer at 4/5 |
| `maxHomeCollectionsPerJourney` | `2` | Requires approval |
| `confirmationDeadlineHoursBeforeDeparture` | `24` | Requires approval |
| `checkInHoursBeforeDeparture` | `24` | Requires approval |
| `arriveBeforeDepartureMinutes` | `15` | Requires approval |
| `boardingClosesMinutesBeforeDeparture` | `5` | Requires approval |
| `homeCollectionSurchargePence` | `0` | Pricing rules not final |
| `waitlistEnabled` | `true` | |
| `luggage` | 1 large + 1 cabin per passenger; 5/5 vehicle caps | Requires physical Vito test |
| `meetingPoint.publicName` | Thornhill Park & Ride | Collection permission not confirmed |
| `airports` | Heathrow T2/T3 £35 / £175 target; Gatwick £45 / £225 target | Fares in **pence** |

No private vehicle origin is stored in this document.

### `spiresShareJourneys/{id}`

Journey record: public number, airport, date, departure, status, capacity, occupied seats (passenger count), fares, early-departure flags, home-collection count, waitlist count, confirmation deadline.

Statuses:

`PROPOSED` · `FILLING` · `ALMOST_FULL` · `AWAITING_EARLY_DEPARTURE_DECISION` · `CONFIRMED` · `FULL` · `EXPIRED` · `CANCELLED` · `COMPLETED`

- **PROPOSED / FILLING / ALMOST_FULL**: not guaranteed. UI warning must be shown.
- **FULL**: 5/5 secured (mock-authorised) seats. Treated as confirmed for display.
- **CONFIRMED**: Spires has committed (full vehicle or accepted 4/5 early departure).
- Occupancy is **passengers**, not booking count.

### `spiresShareBookings/{id}`

Customer booking: passenger count, contact, optional flight number, luggage, optional postcode, home-collection **eligibility** (never a private origin), mock payment id/status, board status, early-departure acceptance.

No customer account is required. Contact fields are stored so booking-management links / OTP can be added later.

### `spiresSharePayments/{id}`

Mock payment records only. Statuses:

`PAYMENT_METHOD_PENDING` · `AUTHORISATION_PENDING` · `AUTHORISED` · `CAPTURE_PENDING` · `CAPTURED` · `AUTHORISATION_RELEASED` · `FAILED` · `REFUNDED`

### `spiresShareWaitlist/{id}`

`WAITLISTED` · `OFFERED` · `ACCEPTED` · `EXPIRED`

Only one `OFFERED` row per journey at a time (duplicate-offer guard).

### `spiresShareAudit/{id}`

Event type, actor email, related IDs, server timestamp.

## Customer flow (admin preview only)

1. Choose airport, date, preferred Thornhill time, flexibility, passengers, luggage, optional flight time/number, optional postcode, name, mobile, email.
2. Search existing proposed departures.
3. If a compatible journey exists, join it (mock authorisation required to secure seats).
4. If none exists, propose a new journey (`PROPOSED`, e.g. 1/5).
5. If 5/5, join the waitlist instead of overbooking.

Proposed journeys must never be described as guaranteed airport transport.

## Journey lifecycle

```
PROPOSED → FILLING → ALMOST_FULL → FULL (5/5)
                         ↓
            AWAITING_EARLY_DEPARTURE_DECISION (4/5 offer)
                         ↓
                    CONFIRMED
                         ↓
                    COMPLETED

Unconfirmed past deadline → EXPIRED (mock authorisations released)
Admin / operational cancel → CANCELLED (mock authorisations released)
```

Scheduled function `scheduledSpiresShareTick` (every 15 minutes, Europe/London) and manual admin “Run deadline tick” call `runShareDeadlineTick()`. Notification sending is **not** implemented (no real customer messages).

## Payment lifecycle

Intended future flow (not live):

Customer joins → amount authorised → seat secured → confirmation threshold reached → capture.

If the journey does not operate → release authorisation rather than capture-and-refund.

**Current implementation:** `MockPaymentProvider` only. Failed authorisation does not write a secured seat (transaction aborts). Confirm / 5/5 full sets mock `CAPTURED`. Cancel / expire sets mock `AUTHORISATION_RELEASED`. Duplicate capture of an already-captured payment is a no-op.

There is **no Stripe integration for Share**. There is **no Shift4 API integration**. A `PaymentProvider` interface is the adapter point for a future provider.

A seat counts as secured only when payment status is `AUTHORISED`, `CAPTURE_PENDING` or `CAPTURED`.

## Matching logic

`matchJourneys()` is a pure function so it can grow without rewriting the UI.

Current checks:

- Same airport and date
- Enough remaining seats for the party
- Preferred time within requested flexibility (exact / ±15 / ±30 / ±60)
- Flight safety buffer vs estimated duration (if flight time provided)
- Vehicle luggage caps

It does **not** yet model terminals beyond configured drop-off labels, luggage shape beyond counts, or home-collection time. Occupancy is never increased by moving a journey later if that would break an existing passenger’s configured buffer (`change-time` and `move-booking` both re-check).

Never guarantee that a passenger will catch their flight.

## Early departure (4/5)

Offered only when occupied === configured threshold === capacity − 1 (launch default 4/5).

New fare = `round(targetRevenuePence / travellingPassengers)`.

Heathrow example with proposed defaults: £175.00 / 4 = £43.75. Gatwick: £225.00 / 4 = £56.25. These figures are **not** hard-coded.

All travelling passengers must accept (`acceptedPassengerCount === occupiedSeats`). Fares never increase automatically.

3/4 accepted → not confirmed. 4/4 accepted → eligible for confirmation.

## Home collection

Optional. Customers enter a postcode/address only.

Backend currently returns:

- `HOME_COLLECTION_ELIGIBLE`
- `HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE`
- `HOME_COLLECTION_UNAVAILABLE`

Public messages only: “Home collection available +£X” or “Home collection is unavailable… Please board at Thornhill Park & Ride.”

**The vehicle’s private starting location must never appear** in public APIs, client JS, page source, maps, or public journey DTOs. The development eligibility stub uses postcode presence + max collections only. Real eligibility should later use extra route time/mileage, not a simple radius. Max collections default 2.

## Privacy

Public journey DTO (`toPublicJourney` / `stripPrivateFields`) exposes only:

Airport, date, departure, approximate arrival, seats occupied/remaining, fare, status, unconfirmed warning.

Never: other passengers’ names, phones, emails, home/pickup addresses, flight numbers, private notes, or private origin.

Admin inspect can see operational PII. Driver view shows first name, passenger count and boarding status only.

## Admin functionality

Signed-in admin tab **Spires Share (dev)**:

- Board: journeys, occupancy, mock secured/captured revenue, status, home collections, waitlist
- Inspect bookings, move a booking between compatible journeys, cancel, confirm, offer 4/5, waitlist offer
- Customer preview (not a public page)
- Driver view and boarding actions
- Configuration (cannot enable public launch)
- Audit list
- Manual deadline tick

## Configuration

Business rules belong in `spiresShareConfig` / `DEFAULT_SHARE_CONFIG`, not scattered through React components. Airports, meeting point, capacity, fares, revenue targets, early-departure threshold, home collections, luggage, confirmation/check-in/boarding timings, flight buffers, matching flexibility and waitlist are configurable.

## Concurrency

Join and move use Firestore transactions that re-read occupancy before writing. Frontend seat counts are display-only. Overbooking (6/5), duplicate confirmation, duplicate waitlist offers and duplicate mock capture are guarded in logic + transactions.

## Unresolved decisions / regulatory dependencies

- Oxford City Council confirmation and Thornhill collection permission
- Insurance, terms, cancellation/refund policy
- Whether Shift4’s existing merchant setup supports online authorise/capture, and authorisation duration
- Payment provider selection (not Stripe for this product unless later decided)
- Flight timing rules and Heathrow drop-off model (currently T2/T3)
- Luggage limits in the Vito
- Home-collection pricing and routing
- Passenger notification channel (email/SMS) — none live
- Customer booking-management OTP links — architecture only
- Public launch of `SPIRES_SHARE_ENABLED`

See `SPIRES_SHARE_PRELAUNCH_CHECKLIST.md`.

## Future Shift4 integration requirements

A future adapter must implement `PaymentProvider`:

1. Create a payment method / session without charging.
2. Authorise (hold) `fare × passengers` (+ home-collection surcharge if any).
3. Confirm hold succeeded **before** committing the seat in the same backend transaction or compensating if the hold fails.
4. Capture only when the journey is `CONFIRMED` or `FULL`.
5. Release the hold if `EXPIRED` or `CANCELLED` before capture.
6. Record provider IDs, amounts in pence, and audit events.
7. Never send private origin, other passengers’ PII, or unconfirmed-guarantee language to the customer.

Until ecommerce/API eligibility is confirmed with Shift4, keep using mock states only.
