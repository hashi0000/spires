# Spires Share admin UI audit

**Date:** 2 October 2026  
**Audience:** ChatGPT / another implementer asked to redesign the Spires Share **admin** UI  
**Scope:** Admin dashboard only. Customer portal, public board, hosted payment, and backend confirmation rules stay as they are.  
**Status:** Local payment guarantee / countdown / email work exists in the repo. This audit is for a **UI rewrite of the admin tab**, not a backend rewrite and not a deploy.

Give this file to ChatGPT as the brief. The current admin screen is one overloaded React file. It needs a simpler operator console, not more buttons.

---

## 1. What this product is

Spires Share is a **demand led shared private hire** product for Spires Taxis.

Current live customer flow:

1. Customer registers interest (login required). Interest is **not** a booking and **not** a payment.
2. When enough people register, the group becomes **ready for review**. Threshold does **not** auto confirm and does **not** auto open payment.
3. Admin proposes an exact departure from that interest group. Passengers must **accept** that exact time and place.
4. Admin pastes a **hosted payment link**, then separately clicks **Open payment window**. Saving a link does **not** email passengers. Opening the window does.
5. Customers pay on the hosted page. Admin clicks **Mark passenger paid** after Spires Taxis verifies the money.
6. The journey **confirms only when** required seats are paid **and** those same seats are verified. Backend already enforces this. Admin must not fake confirmation.
7. If payment deadline passes unpaid, existing waitlist / admin release logic runs. There are **no silent fake refunds**. Refunds are recorded by admin.

Heathrow pilot: Oxford / Thornhill Park and Ride → Heathrow **Terminal 3**. Customer flight terminal can be T2 / T3 / T4 / T5 / UNSURE. That is private operational data, not the Share drop off.

City matching exists in admin code but **must stay unpublished**. London must **not** inherit Heathrow pricing. Fares are set per journey.

---

## 2. Hard constraints (do not break)

Do **not**:

- Rewrite the Heathrow MVP, hosted payment, or state machines.
- Auto enable production flags.
- Auto deploy.
- Auto confirm a journey when seats fill.
- Auto open the payment window when the threshold is reached.
- Take card details inside Spires apps. Payment remains hosted link + admin Mark Paid.
- Hardcode all fares to £35. Heathrow default can stay £35. City / other journeys must type their own fare.
- Show customer identities, emails, phones, payment URLs, or another passenger’s details on public or customer screens.
- Weaken Firestore deny-all client access on `spiresShare*` collections.
- Invent Stripe webhooks or in-app card capture.
- Use hyphenated compounds in **visible** admin copy. Write `8 seater`, `payment method`, `no show`, `four passenger`, `pre booked`. Code IDs, URLs, CSS, and Firestore fields may keep hyphens.

Do:

- Keep using existing Firebase callables.
- Keep admin as the only place that sees PII, payment URLs, destinations, and flight terminals.
- Keep **Open payment window** as an explicit operator action after a link exists.
- Keep confirmation behind backend `confirmationGuard` (`paidRequiredSeats === requiredSeats` AND `verifiedRequiredSeats === requiredSeats`).
- Keep emails DRY_RUN unless both config `notificationsSend` and env `SHARE_NOTIFICATIONS_SEND=true`.

---

## 3. Where the admin lives today

| Item | Value |
| --- | --- |
| App | `spires-admin-fresh` (Firebase Hosting, typically `spires-taxis.web.app`) |
| Nav | `spires-admin-fresh/src/utils/constants.ts` — tab id `spires-share`, label `Spires Share` |
| Mount | `spires-admin-fresh/src/App.tsx` when `activeTab === 'spires-share'` |
| **The problem file** | `spires-admin-fresh/src/components/SpiresShareAdmin.tsx` (~1100 lines, **one component**, nine views) |
| State load | callable `spiresShareGetState` |
| Almost every mutation | callable `spiresShareAdminAction` with an `action` string |
| Config save | callable `spiresShareSaveConfig` |
| Manual deadline job | callable `spiresShareRunTick` |
| Leftover customer impersonation | callables `spiresShareSearch` + `spiresShareProposeOrJoin` from the **Customer preview** tab |

There is **no** live Firestore listener. Every action reloads the entire Share state. There is **no** search, sort, or “needs action” inbox.

The older file `SPIRES_SHARE_CODEBASE_AUDIT.md` (28 Sep 2026) is **outdated**. It describes a hidden prototype with no public customer product. Do not use it as the current product truth. This admin audit is the current admin truth.

---

## 4. Current nine tabs (what the operator actually sees)

Top of the page: nine view buttons plus **Run deadline tick**.

| Tab | What it does | Verdict |
| --- | --- | --- |
| **Board** | Three create forms (pilot journey, city journey, hubs) **then** every journey | Cluttered home. Create tools sit above live work. |
| **Interest groups** | Live demand, propose journey, merge groups | Closest to the real product. Still a dump of enums, ISO deadlines, pence, and two forms sharing one group id. |
| **Proposed journeys** | Filtered journey list | Same create forms as Board. Filter uses raw statuses. |
| **Active journeys** | Filtered journey list | Same create forms again. |
| **Waitlists** | Flat list of waitlist rows | Read only. Offer next place is buried inside an expanded journey. |
| **Completed journeys** | Filtered journey list | Same create forms again. |
| **Customer preview** | Admin fills a Heathrow booking form and can **create real bookings** | Dangerous leftover. Customers now book in `customer-app`. Remove from daily ops. |
| **Driver view** | Boarding / departed / arrived / completed | Legitimate, but mixed with “early fare” language. Park under Advanced. |
| **Configuration** | Four numeric fields, last 20 audit rows, last 20 notifications | Incomplete. Luggage, airports, notification flags, quiet hours, interest hours are not editable here. Audit/notifications are tiny dumps. |

`showJourneyBoard` is true for Board, Proposed, Active, and Completed. That is why **Create a pilot journey**, **Create a city matching journey**, and **Shared drop off hubs** appear on four tabs.

---

## 5. Why it feels cluttered and complex

### 5.1 One screen trying to be every tool

The same page is:

- work queue
- journey creator
- city matching toolbox (unpublished)
- hub manager
- payment ops desk
- waitlist desk
- refund desk
- driver boarding
- config
- fake customer booking form

An operator trying to process today’s Heathrow interest has to scroll past create forms, unused city tools, and hub CRUD.

### 5.2 Journey cards dump everything at once

Collapsed cards already show:

- route in caps
- date / time
- several occupancy / payment lines that overlap
- raw `STATUS: GATHERING INTEREST`
- fare, collected vs target
- payment deadline ISO **and** a live countdown
- hardcoded warning `4 passengers reached — create payment link` even when capacity is not 4

Expanded details then dump:

- destination matching + hub picker
- payment URL input (placeholder still says `https hosted £35 payment link`)
- Open payment window
- payment deadline as **raw ISO string**
- supplement URL (`£8.75`)
- admin note
- every passenger: name, email, mobile, seats, status, paid amount, four person flag, supplement, refund, cancellation, intended destination, flight number, terminals
- five action buttons per passenger
- waitlist with ISO timestamps
- refund form in pence with raw enum statuses

There is no primary CTA. Every journey looks like an engineering panel.

### 5.3 Shared form state is a bug factory

These inputs are **global**, not per journey / group:

- `paymentLink`
- `supplementLink`
- `deadlineValue`
- `interestDeadlineValue`
- `journeyNote`
- `selectedHubId`
- `refundDraft`
- `proposeForm.interestGroupId` (shared by **Propose** and **Merge**)

Open journey B and the payment URL typed for journey A is still in the box. Change an interest deadline and the same ISO field is reused for every group. Merge can silently overwrite the group you just selected for propose.

### 5.4 Language is backend, not operations

Operators see:

- `GATHERING_INTEREST`, `READY_FOR_PAYMENT_SETUP`, `PAYMENT_WINDOW_OPEN`, `FOUR_PASSENGER_OPTION`
- `PROVISIONAL`, `PAYMENT_PENDING`, `PAID`
- `DRY_RUN`
- fares in **pence** (`3500`)
- deadlines as ISO (`2026-10-03T12:00:00.000Z`)
- `early departure` mixed with `four passenger`

Customer UI already has friendlier stages. Admin should match that, with extra private ops detail.

### 5.5 No “what should I do next”

The live product needs a queue. The current UI has none.

Missing inbox items:

| Situation | Operator should do |
| --- | --- |
| Interest at or above threshold, still gathering / ready for review | Propose exact departure |
| Proposed journey, not all passengers accepted | Chase / close / wait |
| Enough acceptances, payment not open, no link | Paste hosted link |
| Link saved, window not open | **Open payment window** |
| Payment window open, unpaid seats | Mark paid as money lands; watch countdown |
| All required seats paid and verified | Confirm (or show “ready to confirm”; backend still guards) |
| Payment expired unpaid | Waitlist offer / release / cancel |
| Outstanding waitlist offer | Watch 60 minute offer |
| City group with spread destinations | Choose hub (advanced, unpublished) |
| Emails in DRY_RUN | Know notifications did not actually send |

None of this is a first-class list. Counters exist only inside each card.

### 5.6 Leftover Customer preview is a footgun

The preview tab calls `spiresShareProposeOrJoin` with `termsAccepted: true` and can create **real** provisional reservations under whatever name / email the admin types. There is also **Propose anyway (dev)**.

Customers already use `customer-app/src/components/ShareHeathrow.jsx`. Admin should not impersonate that flow on the ops desk. If a sandbox is needed, hide it behind Advanced and label it clearly as **creates live records**.

### 5.7 Create-first, interest-second

The real pipeline starts with **interest groups**. The default tab is **Board**, which is create-journey-first. That is the old prototype shape. Live Share is demand first, departure second.

### 5.8 Config and comms are afterthoughts

Config only edits four numbers and says “Public enabled stays false until council and payment decisions are made” even though the customer product is already live.

Audit is `type · email`. Notifications are `type · DRY_RUN · to`. There is no journey link, no subject, no send/fail reason, no filter.

### 5.9 Layout / CSS

Uses `school-invoice-grid` (wrong domain). Heavy inline styles. One `busy` boolean disables the whole page. No empty-state coaching. No desktop vs phone ops layout.

---

## 6. Live operator pipeline (design around this)

Use these stages in the admin UI. Map to backend statuses; do not show raw enums as the main label.

### A. Interest

Backend group: `GATHERING_INTEREST`  
Customer: registering interest, live registration countdown from stored `interestDeadlineAt`.

Admin job: watch count vs threshold. Do **not** take payment.

### B. Ready to propose

Backend group: `READY_FOR_REVIEW` (threshold reached, still not a journey)  
Admin job: pick exact departure location, exact time, fare **in pounds**, capacity. Call `propose-from-interest`.

Do not open payment here.

### C. Waiting for acceptances

Backend journey after propose. Passengers must accept the exact departure.  
Admin job: see who accepted. Optional close / cancel.

### D. Ready for payment setup

Enough acceptances. Payment **must not** be open yet.  
Admin job:

1. Paste hosted payment URL (`set-payment-link`). This must **not** email.
2. Click **Open payment window** (`open-payment-window`). This emails eligible passengers and starts `paymentDeadlineAt`.

### E. Collecting payment

Backend: `PAYMENT_WINDOW_OPEN` / similar.  
Admin job: Mark Paid / Undo. Show `paid / required` and `verified / required`. Show live countdown from stored `paymentDeadlineAt`. Allow deadline edit with a datetime picker, not ISO.

### F. Ready to confirm / confirmed

Confirm only if backend guard passes. Show a clear **Ready to confirm** vs **Not ready** reason (`3 of 4 paid`, `2 of 4 verified`).

### G. Did not fill / expired / cancelled / completed

Archive. Refunds stay admin recorded. Waitlist offers stay FIFO.

Four passenger fallback is an **exception** on a specific journey, not a default control on every card.

---

## 7. Recommended information architecture

Rebuild as a **small ops console**, not a 9-tab laboratory.

### Primary nav (daily)

1. **Needs action** (default home)
2. **Interest**
3. **Journeys**
4. **People and payments** (or open as a drawer from a journey)

### Secondary / Advanced (collapsed)

- Waitlists
- Driver boarding
- Hubs
- City matching (unpublished)
- Create unpublished journey (escape hatch)
- Configuration
- Audit and emails
- Developer sandbox (old customer preview, clearly dangerous)

Board / Proposed / Active / Completed should become **filters on Journeys**, not separate pages that reprint create forms.

### Needs action home

A short list of cards, newest / soonest deadline first. Each card has **one** primary button.

Examples:

- `Oxford to Heathrow T3 · 12 Oct · 4 of 4 interested · Propose departure`
- `SPIRE-104 · link saved · Open payment window`
- `SPIRE-104 · payment 2 of 4 verified · 02:14:08 remaining · Open journey`
- `SPIRE-110 · payment closed unpaid · Offer waitlist`
- `Interest group expired · Close or extend deadline`

Badge counts on the tab: `Needs action (3)`.

### Interest list

Table or compact cards:

- Route
- Date and window
- `3 / 4 interested` plus occupancy dots
- Live countdown
- Human status (`Collecting interest` / `Ready to propose` / `Closed`)
- Private destination spread and flight terminals in a **review drawer**, not on the list
- Primary: **Review and propose**
- Secondary: Change deadline, Close group

**Merge groups** belongs in Advanced. Do not share its selected id with Propose.

Propose form should:

- be a drawer for **one** group
- take fare in **pounds** (send pence to the callable)
- default Thornhill / Heathrow T3 for Heathrow groups
- block submit if fare is 0
- remind: passengers must accept; payment is not taken

### Journey list

Filters: Needs payment, Collecting interest, Confirmed, Hidden, Completed.

Each row:

- Public number
- Route (plain language, not all caps)
- Date / time
- Stage chip
- Seats `occupied / capacity`
- Payments `verified / required` when payment is in play
- Countdown if a deadline exists
- Visible / hidden
- **Open**

Do **not** put Create pilot / Create city / Hubs above this list.

### Journey drawer (the real workspace)

Use sections. Do not print one wall of text.

1. **Summary** — stage, counts, countdown, collected vs target in pounds, visible/hidden, lock.
2. **Primary action** — exactly one, based on stage (Propose already done / Add payment link / Open payment window / Confirm / Offer waitlist).
3. **Passengers** — table: name, seats, reservation, paid, verified, flight/terminal. Actions behind a row menu except **Mark paid** which stays one click during payment collection.
4. **Payment** — current URL (masked except last path segment), paste new URL, open window, datetime deadline, supplement only if four passenger is actually active.
5. **Waitlist** — FIFO list + Offer next.
6. **Notes and refunds** — collapsed by default.
7. **City drop off** — only if `destinationMatchingEnabled`.

Publish / hide and Cancel stay available but not in the primary row of every card.

### Waitlists

Keep a dedicated Advanced view, but the offer button must also live on the journey that has a spare seat.

### Driver

Keep. Rename “early fare” to **four passenger acceptance** where that is what the backend means. First names only is fine for boarding.

### Config

Split:

- Vehicle / capacity / threshold / confirmation hours
- Notification send flag reminder (read only if env still required)
- Quiet hours / interest registration hours if already in config
- Audit log with journey id
- Notification log with type, to, status, dry run, time

Do not claim the product is still waiting on council if it is live.

---

## 8. Copy and display rules

Visible admin English, no hyphenated compounds:

| Bad | Good |
| --- | --- |
| 8-seater | 8 seater |
| four-passenger | four passenger |
| payment-method | payment method |
| no-show | no show |
| pre-booked | pre booked |
| drop-off | drop off |
| customer-facing | customer facing |

Other rules:

- Money: `£35.00`, never `3500` in the UI. Convert to pence at the callable boundary.
- Deadlines: London local datetime picker. Send ISO to `set-payment-deadline` / `set-interest-deadline`.
- Status chips: `Collecting interest`, `Ready to propose`, `Waiting for acceptances`, `Add payment link`, `Ready to open payment`, `Collecting payment`, `Ready to confirm`, `Confirmed`, `Did not fill`, `Cancelled`.
- Keep the existing guarantee line in ops language: a journey runs only after required places, required acceptances, all required fares paid, and Spires Taxis verified those payments.
- Do not show `£35` as a universal placeholder. Heathrow may default to 3500 pence. City fare starts empty.

---

## 9. Backend actions to keep using

Admin mutations go through `spiresShareAdminAction`. Prefer these. Do not invent parallel write paths from the client.

| Action | When the new UI should call it |
| --- | --- |
| `propose-from-interest` | Primary path: interest → exact departure |
| `close-interest` | Close a group |
| `set-interest-deadline` | Extend / shorten registration |
| `merge-interest` | Advanced only |
| `set-payment-link` | Save hosted URL. Must not email. |
| `open-payment-window` | Explicit. Emails eligible passengers. |
| `set-payment-deadline` | After window is open |
| `mark-paid` | After money is verified |
| `undo-payment` | Correction |
| `set-supplement-link` | Four passenger exception |
| `mark-supplement-paid` | Same |
| `confirm` | Only when UI shows ready; backend still guards |
| `cancel` | Journey cancel. Refunds remain admin. |
| `offer-four-passenger` | Exception, not every card |
| `offer-waitlist` | Spare seat |
| `waitlist` | Rare admin add |
| `release-booking` | Free a seat |
| `release-failed-payment` | If still used |
| `record-refund` | Pounds in UI, pence in payload |
| `add-admin-note` | Notes |
| `publish-journey` / `unpublish-journey` | Visibility |
| `create-journey` | Escape hatch unpublished Heathrow / pilot |
| `create-city-journey` | Advanced, unpublished |
| `create-dropoff-hub` / `update-dropoff-hub` | Advanced |
| `set-proposed-dropoff` / `notify-dropoff-passengers` | City only |
| `driver` | Boarding / trip progress |
| `accept-early-departure` | Only if four passenger / early fare still required |

Also:

- `spiresShareGetState` — keep as the data load until a later live listener is approved
- `spiresShareSaveConfig` — config tab
- `spiresShareRunTick` — keep as a manual “run deadline job now” in Advanced

**Stop using on the daily admin desk:**

- `spiresShareSearch`
- `spiresShareProposeOrJoin`

Those belong to customer / leftover preview.

---

## 10. Data already returned by `spiresShareGetState`

The admin already receives enough to build the new console. Use it. Do not add client Firestore reads.

**Config:** capacity, early departure threshold, home collection max, confirmation hours, luggage, meeting point, airports (id, name, dropoff, fare pence, target revenue pence).

**Journeys:** id, public number, route labels, date/time, status, capacity, occupied seats, fare pence, target revenue, waitlist count, payment link, payment stage, payment deadline, window opened at, supplement link, locked, confirmed at, customer visible, min threshold, notes, journey type, cities, four passenger flag, destination matching, proposed hub, waitlist offer outstanding, interest group id.

**Bookings (PII, admin only):** name, email, mobile, passengers, payment/reservation/hosted status, paid amount, paid at, four passenger accepted, supplement, refund fields, board status, intended destination, flight number, flight time, departure terminal, dropoff terminal, drop off accept/decline.

**Interest groups:** public number, origin, destination region, date, window, interested seats, min threshold, interest deadline, status, matching uncertain, destination spread, entries (name, email, seats, destination, flight, terminal).

**Waitlist, hubs, audit, notifications:** already loaded.

**Gaps to compute in the UI (no backend change required for v1):**

- Needs-action classification from status + counts + missing `paymentLinkUrl` + open/closed deadlines
- Pounds from pence
- Human stage labels
- Confirmation readiness: count bookings with `reservationStatus === "PAID"` or `hostedPaymentStatus === "PAID"` vs required seats. Backend remains source of truth on confirm.

**Nice later backend additions (only if asked):** dedicated `needsAction` array on `getState`, confirmationGuard summary per journey, notification metadata already stored by recent work. Do not block the UI rewrite on this.

---

## 11. Suggested file split (admin only)

Replace the monolith. Keep the same tab mount in `App.tsx`.

Suggested:

```
spires-admin-fresh/src/components/spiresShare/
  SpiresShareAdmin.tsx          # shell, nav, load state, run()
  NeedsActionQueue.tsx
  InterestList.tsx
  InterestProposeDrawer.tsx
  JourneyList.tsx
  JourneyDrawer.tsx
  PassengerTable.tsx
  PaymentPanel.tsx
  WaitlistPanel.tsx
  DriverBoard.tsx
  ShareConfig.tsx
  shareLabels.ts                # human stages, pounds, countdown
  shareActions.ts               # thin wrappers around spiresShareAdminAction
```

Do not copy admin styles into the customer app. Do not reuse `school-invoice-grid`.

---

## 12. Implementation order for ChatGPT

Do this in order. Ship a usable ops desk before Advanced.

1. **Shell + Needs action + Interest list + Propose drawer.** This is the live product.
2. **Journey list + Journey drawer** with payment link, open window, mark paid, countdown, datetime deadline.
3. **Waitlist on the journey** + Offer next.
4. Hide Customer preview. Hide city / hubs / create forms behind Advanced.
5. Clean Driver + Config + audit/notification lists.
6. Only then: merge groups, refunds polish, four passenger, city drop off.

Do not start by restyling the current 1100-line file in place. That is how it became cluttered.

---

## 13. Tests and verification

Backend tests already cover confirmation, deadlines, and expiry. Admin rewrite should not change those.

After UI work:

- Propose from an interest group with fare in pounds; confirm callable received pence.
- Save payment link does not claim that emails were sent.
- Open payment window is a separate click.
- Mark paid / undo still work.
- Deadline picker writes ISO and live countdown reads the stored field.
- Hidden vs visible still works.
- City create stays unpublished.
- Customer preview is gone from the default nav (or clearly Advanced).
- No hyphenated compounds in buttons or labels.
- Verify in the browser: interest → propose → payment link → open window → mark paid. Check that Board no longer shows three create forms as the first thing an operator sees.

---

## 14. One-page brief you can paste to ChatGPT

> Redesign the Spires Share admin UI in `spires-admin-fresh/src/components/SpiresShareAdmin.tsx`. It is one 1100-line component with nine tabs. It is too cluttered for daily operations.
>
> Build an operator console around the live pipeline: interest → admin proposes exact departure → passengers accept → admin pastes hosted payment link → admin opens payment window → admin marks paid after verification → journey confirms only when required seats are paid and verified.
>
> Default home is a Needs action queue. Interest and Journeys are the other primary tabs. Move city matching, hubs, create-journey forms, driver, config, waitlist dump, and the old Customer preview behind Advanced. Customer preview currently creates real bookings and should not be on the daily desk.
>
> Do not rewrite backend, hosted payment, or state machines. Use existing callables, especially `spiresShareGetState` and `spiresShareAdminAction`. Do not auto open payment. Do not auto confirm. Show money in pounds and deadlines with a datetime picker. No hyphenated compounds in visible copy. Keep PII and payment URLs on admin only.
>
> Follow `SPIRES_SHARE_ADMIN_AUDIT.md` in the repo root for the full inventory, action map, and screen design.

---

## 15. Current vs target (summary)

| Current | Target |
| --- | --- |
| 9 equal tabs | 3 daily tabs + Advanced |
| Create forms on every journey view | Create only as escape hatch |
| Interest buried | Interest is a primary tab |
| No work queue | Needs action is home |
| Raw enums, pence, ISO | Human stages, pounds, datetime |
| Shared inputs across journeys | Per journey / per group drafts |
| Expand dumps every tool | Staged drawer with one primary CTA |
| Admin impersonates customer booking | Removed from daily nav |
| Config still talks like a prelaunch prototype | Ops config + audit + emails |
| One 1100-line file | Small folder of focused components |

The backend can already run the product. The admin UI is the bottleneck.
