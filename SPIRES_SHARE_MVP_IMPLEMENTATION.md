# Spires Share — hosted payment link MVP

**Date:** 28 September 2026  
**Constraint:** Production remains gated. Real card APIs are not enabled. `/share` stays 404 on Vercel. This is operational code behind the existing gate, not a public launch.

---

## 1. What changed in this pass

The previous mock authorise/capture path is isolated. The live reservation path is:

**register interest → gathering → 4 places → admin pastes one hosted £35 link → admin opens payment window → passengers pay on the hosted page → admin marks paid → 5/5 paid confirms once**

or

**4 paid → unanimous four passenger accept → supplement link → admin marks £8.75 supplements → £175 total → confirms once**

---

## 2. Files changed

### New
- `.cursor/rules/no-hyphenated-compounds.mdc`
- `functions/src/spiresShare/paymentDeadline.ts`
- `functions/src/spiresShare/paymentDeadline.test.ts`
- `functions/src/spiresShare/hostedPayment.ts`
- `functions/src/spiresShare/hostedMvp.test.ts`

### Backend
- `functions/src/spiresShare/types.ts`
- `functions/src/spiresShare/defaults.ts`
- `functions/src/spiresShare/logic.ts`
- `functions/src/spiresShare/bookingFlow.ts`
- `functions/src/spiresShare/bookingFlow.test.ts`
- `functions/src/spiresShare/callables.ts`
- `functions/src/spiresShare/notifications.ts`
- `functions/src/spiresShare/paymentProvider.ts`
- `functions/src/index.ts`

### Admin / customer / site
- `spires-admin-fresh/src/components/SpiresShareAdmin.tsx`
- `customer-app/src/components/ShareHeathrow.jsx`
- `customer-app/src/styles.css`
- `spires-website/share.html`
- `spires-website/includes/footer.html`
- `SPIRES_SHARE_TERMS_DRAFT.md`
- `SPIRES_SHARE_MVP_IMPLEMENTATION.md`

Firestore rules remain deny-all on every `spiresShare*` path. Public launch flags were not turned on.

---

## 3. Firestore / data model

### Journey (added / used)
`paymentLinkUrl`, `paymentLinkAddedAt`, `paymentWindowOpenedAt`, `paymentDeadlineAt`, `paymentStageStatus` (`NOT_CREATED` | `LINK_SAVED` | `OPEN` | `CLOSED`), `supplementPaymentLinkUrl`, `supplementLinkAddedAt`, `confirmedAt`, `confirmationEmailSentAt`, `locked`

Payment URLs are never included in public DTOs or customer dashboard JSON.

### Booking (added / used)
`reservationStatus`, `hostedPaymentStatus`, `paidAmountPence`, `paidAt`, `paymentDeadlineAt`, `paymentSubmittedAt`, `supplementAmountDuePence`, `supplementPaidPence`, `supplementPaidAt`, `fourPassengerAccepted`, `fourPassengerAcceptedAt`, `termsAcceptedAt`, `termsVersion`, `cancelledAt`, `hoursBeforeDeparture`, `cancellationCategory`, `seatResold`, `replacementBookingId`, `refundStatus`, `amountRefundedPence`, `amountRetainedPence`, `adminNotes`, reminder timestamps

`uid` is required for customer ownership. Terms store `termsAcceptedAt` plus `termsVersion` (`share-heathrow-mvp-2026-09-28`), not a boolean alone.

---

## 4. Journey state machine

```
GATHERING_INTEREST
  → READY_FOR_PAYMENT_SETUP          (occupied ≥ 4, window not open)
  → PAYMENT_WINDOW_OPEN              (admin opened window)
  → AWAITING_FINAL_PASSENGER         (window open and 4/5)
  → FOUR_PASSENGER_OPTION            (admin offers; never automatic)
  → SUPPLEMENT_PAYMENT               (all four accepted)
  → CONFIRMED / LOCKED
  → COMPLETED
  → EXPIRED                          (1–3 places past confirmation deadline)
  → CANCELLED                        (operator cancel)
```

Legacy names (`PROPOSED`, `FILLING`, `ALMOST_FULL`, `FULL`, `PAYMENT_ACTION_REQUIRED`) remain in the type for old documents. New writes use the states above.

`CONFIRMED` does not revert because a later passenger cancels or is marked no show.

---

## 5. Reservation state machine

```
PROVISIONAL
  → PAYMENT_PENDING     (payment window open, or fifth passenger joining an open window)
  → PAID                (admin mark paid only)
  → PAYMENT_EXPIRED     (deadline passed, seat released transactionally)
  → CANCELLED           (>24 hours before departure)
  → LATE_CANCELLED      (within 24 hours)
  → NO_SHOW             (admin / driver)
```

Seats that count toward occupancy: `PROVISIONAL`, `PAYMENT_PENDING`, `PAID` only.

---

## 6. Authentication model

- Customer Share APIs still require admin email or `previewTesterEmails` while public launch is off.
- Registering interest, dashboard, payment link, cancel, and four passenger accept also require a signed in Firebase `uid`.
- A booking is readable/manageable only when `booking.uid === auth.uid` (admins excepted).
- Unrelated customers receive `not-found` (no existence leak).
- Customers cannot set `paymentStatus`, `paidAmountPence`, journey confirmation, another booking, capacity, or payment URLs.
- `payment-submitted` only records that they returned from the hosted page. It does **not** mark PAID.

---

## 7. Payment link workflow

1. Occupancy reaches 4 → `READY_FOR_PAYMENT_SETUP`. Admin sees “4 passengers reached, create payment link”.
2. Admin pastes one https URL. Saved as `LINK_SAVED`. **No emails.**
3. Admin presses **Open payment window**. URL is validated, deadline computed, eligible reservations become `PAYMENT_PENDING`, payment emails send, Pay button appears for assigned passengers only.
4. One link is reused for all five £35 payments. A fifth passenger during an open window enters `PAYMENT_PENDING` immediately and gets the same URL and an appropriate deadline.
5. Admin checks the provider separately and uses **Mark paid** / **Undo / correct payment**.
6. Returning from the hosted page never auto-marks paid.

---

## 8. Payment deadline behaviour (Europe/London)

Config: `paymentWindowHours` default **2**, quiet hours **22:00–07:00**.

- If the window is opened during quiet hours, the 2 hour clock starts at the next **07:00**.
- If the raw deadline would fall inside quiet hours, it is pushed to the next **07:00 plus the configured window**.
- Example: a 01:00 request does **not** expire at 03:00; it expires at **09:00**.
- Example: open 21:00 with a 2 hour window does **not** expire at 23:00; it expires at **09:00** the next morning.
- A fifth passenger keeps the remaining journey deadline when at least 30 minutes remain and that instant is not in quiet hours; otherwise a new quiet-hours-safe deadline is computed.

Admin can override with `set-payment-deadline`.

---

## 9. Four passenger fallback

Never imposed automatically.

Admin offers the option. Each travelling passenger must accept. Only then does the journey enter `SUPPLEMENT_PAYMENT`. Admin pastes a supplement link (journey specific field; reusable URLs still fit). Admin marks each £8.75 supplement.

Confirm when:

- 4 holding seats
- all £35 paid
- all accepted
- all supplements paid
- total £175 (`4 × £43.75`)

If anyone declines or a supplement is missing, the journey is not shown as confirmed.

---

## 10. Cancellation and no show

- More than 24 hours before departure: `CANCELLED` / free cancellation category. Seat released for resale.
- Within 24 hours: `LATE_CANCELLED`. No invented punitive fee. `refundStatus` starts `PENDING` if money was recorded; admin sets refunded / retained / partial and amounts.
- After a 5/5 confirm: journey stays `CONFIRMED` / locked. Occupancy can drop so the empty place can be resold.
- No show: driver/admin action. Journey stays committed.

Tracked: `cancelledAt`, `hoursBeforeDeparture`, `cancellationCategory`, `seatResold`, `replacementBookingId`, `refundStatus`, `amountRefundedPence`, `amountRetainedPence`, `adminNotes`.

---

## 11. Departure / no show copy

Customer dashboard, confirmation email, and reminders use **Departure time**, not pickup time.

Recommended arrival = departure minus 15 minutes. Maximum possible grace = departure plus 5 minutes, described as not guaranteed.

---

## 12. Email notifications

Reuse nodemailer / `getTransporter`. Default remains **DRY_RUN** unless `notificationsSend` and `SHARE_NOTIFICATIONS_SEND=true`.

Implemented templates:

- interest registered (provisional)
- filling
- payment required (includes amount, deadline, pay button, four passenger reminder)
- payment deadline approaching
- reservation expired for non payment
- journey confirmed (strict departure notice)
- four passenger option
- supplement payment required
- 24 hour reminder
- departure reminder
- cancellation confirmation
- journey cancelled by Spires
- waitlist / time change / did not fill

Duplicates are avoided with booking timestamps (`paymentRequiredNotifiedAt`, `paymentReminderNotifiedAt`, `confirmationEmailSentAt`, `reminder24hNotifiedAt`, `departureReminderNotifiedAt`). Confirmation writes `locked` + `confirmationEmailSentAt` inside a Firestore transaction so two admin mark-paid actions cannot confirm twice.

Payment emails may include the hosted URL for that passenger only. The URL is not stored on the notification document.

---

## 13. Authentication, privacy, security

- Customer dashboard shows own payment state plus aggregates (“4 of 5 places reserved”, “3 of 4 required passengers paid”). No other names, emails, mobiles, booking ids, or individual payment states.
- Admin board shows identities and per booking payment/supplement/cancel/no show state.
- `spiresShareGetPaymentLink` returns the URL only to the owning signed in passenger (or admin).
- Public DTO strips `paymentLinkUrl`.
- Occupancy uses transactions + in-memory mutex. Concurrent last-seat joins cannot create 6/5.
- Unpaid expiry runs in a transaction and only releases `PAYMENT_PENDING` rows that still have that status.

---

## 14. Mock / Shift4 isolation

`MockPaymentProvider` and `Shift4OnlinePaymentProvider` remain in `paymentProvider.ts` for a future API. The live propose/join/confirm path does **not** call them.

Retained for later: `PaymentProvider` interface, mock tests, Shift4 constructor that refuses invented credentials.

Still required for real card charging: Shift4 (or other) online API spec, secret, hosted-fields/token flow, webhooks to replace manual mark paid.

---

## 15. Tests

Command: `npm test` in `functions/`  
**59 passed, 0 failed** (28 September 2026).

Hosted MVP coverage:

- 1 passenger registers as provisional, no payment
- 4 passengers → `READY_FOR_PAYMENT_SETUP`
- payment link saved without payment emails
- open payment window emails and sets `PAYMENT_PENDING` without marking paid
- https URL validation
- assigned customer can see payment link **flag**; unrelated uid cannot access the booking
- customer view has no other passenger PII; public DTO has no payment URL
- admin mark paid; customer sees own PAID; aggregate paid count updates
- unpaid deadline expiry releases the seat
- fifth passenger during open window shares the same URL
- 5/5 paid confirms once; second confirm is idempotent
- four passenger option needs unanimous accept; supplements total £175
- late cancellation does not unconfirm a locked journey; seat count can reopen
- concurrent joins cannot exceed 5
- customer helpers cannot pretend a self-mark paid succeeded
- GMT/BST quiet hours; overnight 01:00 does not expire at 03:00

Existing occupancy, luggage, privacy, waitlist, isolated mock provider, and timezone tests still pass.

**Not executed:** live Firebase emulator with two HTTPS clients, live SMTP, live hosted-provider checkout, production `/share` 200 (must stay 404), visual pass of the React dashboard at 360–1280.

---

## 16. Remaining manual steps

1. Create the hosted £35 link (up to five payments) in the payment provider dashboard.
2. Paste it into Spires Share admin and press **Open payment window**.
3. Check the provider separately and **Mark paid** / **Mark supplement paid**.
4. Set refunded or retained amounts after late cancel / no show.
5. Enable `SHARE_NOTIFICATIONS_SEND` only in a controlled project when emails should actually send.

---

## 17. Remaining production blockers

1. Explicit instruction to launch (this work must not be treated as launch)
2. Vercel `/share` 404, robots Disallow, sitemap skip, `noindex`, no nav/homepage promotion
3. `SPIRES_SHARE_ENABLED` and `publicEnabled` stay false
4. Ordinary signed in customers still get `session.available: false`
5. No payment provider API/webhook; manual verification only
6. Legal sign-off of terms (`SPIRES_SHARE_TERMS_DRAFT.md` is still a draft)
7. Council / insurance / operational approval
8. Live email template review
9. Firestore emulator pairing of the new callables
10. Mobile QA of the authenticated dashboard in a running customer-app build

---

## 18. What still needs payment-provider API access

- Automatic paid confirmation
- Return-URL webhook that is trusted
- Card authorise/capture/refund APIs
- Shift4 online product (credentials must not be invented)

Until that exists, keep hosted links plus admin verification.

---

## Honesty note

Spires Share is **not publicly launched**. Production `/share` is still blocked. Payments are **not** live card APIs. Notifications default to dry run. Do not describe this as a public product.
