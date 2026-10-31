# Admin booking workflow cleanup

These changes are implemented locally against repository commit 733ae6c. They have not been deployed or tested against production Firestore, SMTP or Shift4.

## Booking list and quote editor

- Search by customer, reference, contact details or journey; searching remains applied when selecting a month.
- One main booking action; driver reminders, documents, duplication, returns and deletion are grouped under More actions.
- Readable payment badges, deposit received and remaining balance, and an Awaiting payment label after acceptance.
- Quote and payment summary; optional journey fields and additional actions are collapsed.
- Quote/payment email state and send times; failed-email retries use the booking rather than an internal job ID.
- Live booking subscription refreshes payment and email results while the quote panel is open.
- Quote expiry/date inputs convert between stored ISO timestamps and local browser time correctly.

## Workflow integrity

- Primary status takes precedence over stale legacy status copies. Historical confirmed/admin-allocated records remain supported.
- Advance payment can be recorded before or after acceptance. Acceptance uses the issued quote's requested amount.
- Manual payment totals and their audit record are committed together. Repeating a total does not add the money twice; paidAt is reserved for full payment.
- Deposit fields and outstanding balances are updated when a quote is issued.
- Saving an old modal no longer rewrites function-owned quote, payment, confirmation or terms fields. Issued-quote payment fields are protected again inside a transaction at save time.
- Staff cannot use the ordinary confirmation dropdown to bypass the issued quote's acceptance/payment requirements.
- Quote issuance and its token creation are atomic and reject concurrent booking changes.
- Email enqueue operations use transactions to prevent racing duplicate queue writes.
- Queued obsolete quote/acceptance messages and cancelled-booking messages are skipped before sending. This is a pre-send check, not a claim of exactly-once SMTP delivery.
- A first confirmation can be queued when an email address is added to an already confirmed booking.
- Verified Shift4 host pay.shift4.com is accepted alongside existing Stripe hosts; similar-looking hosts remain rejected.
- Payment-link saves no longer rewrite paymentStatus from an old snapshot.
- New admin bookings have independent Firestore document IDs and longer randomised display references; historical IDs are unchanged.
- Quote sends preserve existing flight numbers and airport-collection flags when those fields were not edited.
- Customer dashboard prefers the same primary workflow status.
- Partial receipts are included when calculating received/outstanding accounting totals.

## Local validation

- Admin production build: passes, with an existing html2pdf dependency source-map warning.
- Admin tests: 66 passed across 10 suites, including search/month and deposit-action UI regressions.
- Functions TypeScript build: passes.
- Quote/payment tests: 19 passed, including deposit-before-acceptance, stale status, late email and Shift4 host validation.
- Customer app production build: passes. No customer-app tests currently exist.
- Full backend suite: 248 of 250 passed at the audit run. The confirmed replacement-seat expiry and public Share sitemap assertions also fail in the untouched baseline; baseline additionally exhibited a waitlist timing failure. No Spires Share implementation was changed.
- Checks ran on the available Node 24 runtime; production declares Node 22. Repeat deployment checks on Node 22.

## Before release

Use a non-production Firebase environment and a controlled test mailbox to verify actual emails, quote acceptance links, deposits recorded in both action orders, quote replacement, missing email added later, and booking edits after payment. The automated checks do not establish production email delivery or verify money arriving at Shift4.

Existing architecture still has direct client booking writes, legacy aliases, customer grouping/linking, and once-only payment receipts. Those remain follow-up work; this patch does not claim to finish every process in the wider system. No production data migration is included.

Deploy Cloud Functions with the admin build so booking-based email retry and the updated payment rules are available together. Deploy the customer app through its existing hosting setup. Do not deploy the marketing site as the Firebase admin hosting build.
