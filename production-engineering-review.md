# Production engineering review

Date: 14 November 2026  
Project: Spires Taxis (`spires-taxis`)  
Scope: current working copy, compared with the deployed function list  
Local Node: v22.17.0  
Deployed functions runtime: nodejs22

Nothing in this review was deployed. No live booking was changed. No customer message was sent. No card was charged.

## What was already deployed

These payment routes are live, even though the customer screen does not use them:

- `createPaymentIntent`
- `confirmPayment`
- `stripeWebhook`

They stay in the codebase. The local copies no longer trust an amount sent by the browser, and a confirmed Stripe payment is bound to one booking. Removing them would remove a live route.

Also live, and affected by this working copy when deployed:

- `saveSchoolInvoiceVault` and `getSchoolInvoiceVault`
- `onCustomerCreate`
- `processEmailJob`
- Mail sent through the shared transporter, including reminders and quote mail

## Priority 1

### 1. Firestore rules

Cause: driver and vehicle reads used `isAuthenticated()`, so any signed-in account could read them. Family devices could read and write every booking field.

Fix:

- Customers cannot read drivers or vehicles.
- Staff and an enabled, unexpired family device can read them.
- Family devices can create a phone booking and update journey fields.
- Family devices cannot write the payment ledger, quote, ownership, or acceptance fields.
- Family devices can change the agreed fare only on a booking whose source is `family`.
- `stripePaymentClaims` is closed to client reads and writes.
- Booking audit entries stay closed.

Verified: `functions/scripts/firestore-rules.test.mjs` against the Firestore emulator. The script printed success. Permitted reads and writes passed. Rejected access included a customer reading drivers or vehicles, another customer reading a booking, a signed-out read, a family write of `amountReceivedPence`, `issuedQuote`, or `uid`, a family fare change on a website booking, and a family delete.

Java is not installed on this machine. The emulator ran with a temporary runtime. After the script exited successfully, the emulator received a shutdown signal, so the wrapper process was marked failed. The assertions had already passed.

Firestore cannot hide individual fields on a read. A family device that can read a booking can still see fare and payment fields.

### 2. Card payment amount and binding

Cause: `createPaymentIntent` charged the amount sent by the browser, stored that payment id on the booking before money arrived, and `confirmPayment` did not check that the Stripe payment belonged to that booking and account.

Fix in `functions/src/payment.ts` and `functions/src/paymentAmount.ts`:

- The payable amount comes from the agreed fare, the deposit still due, and the recorded balance.
- A cancelled booking, a missing fare, a zero balance, a Spires International booking, and a browser amount that does not match are rejected.
- A retry reuses the open payment when the amount is unchanged. Booking id plus amount is not the Stripe idempotency key, because two real payments can be the same amount. A new balance gets a new key, `spires_{bookingId}_{nonce}`.
- The booking stores `openStripePaymentIntentId` until the payment is verified. It does not treat that id as money received.
- Confirmation checks `metadata.bookingId` and `metadata.userId`.
- A provider payment is claimed on `stripePaymentClaims/{paymentIntentId}`. The same payment cannot be credited to a second booking.
- Stripe error detail is no longer returned to the browser.
- Stripe was not called.

Verified: `functions/src/paymentAmount.test.ts`. The claim check is a function test. The Firestore transaction was not executed.

### 3. Later card balance

Cause: `cardReceiptPatch` treated a stored Stripe id plus any received amount as proof that the new payment was already credited. A cash deposit, or an earlier card deposit, could swallow the later card balance. The visible entry list is also cut to the latest 50, so it cannot be the permanent memory.

Fix: credit is remembered in `appliedStripePaymentIntentIds`. That list is not cut. A stored intent id blocks a replay only when that same id was the credited payment and the booking is not sitting in `processing`.

Verified in `functions/src/marketing/payments.test.ts`:

- Cash deposit, then a card balance
- Card deposit, then a separate card balance
- Repeated webhook of the same payment id
- Same payment id after the visible entry list is empty
- Legacy replay of one already credited id

Webhook and browser confirmation arriving together are handled by the receipt transaction. That transaction was not run against Firestore.

### 4. Invoice storage

Cause: general and school saves sent `invoices.slice(0, 100)`, and the server cut the list again. A second tab could replace a newer vault. Invoice numbers were chosen only in the browser.

Fix:

- Both cuts are removed. Saving keeps the invoices the screen sends.
- The history screen shows 25 at a time, with a control for older invoices.
- Each save carries a revision. A stale session is rejected.
- Issued invoice paper already stored on the invoice is kept by the existing merge.
- Encryption stays. If the existing vault cannot be decrypted, the save is refused.
- The first save of an old vault that has no revision is accepted and becomes revision 1.

Verified: `functions/src/quotes/quotes.test.ts` checks a 120 invoice history, a stale revision, and that the three save paths no longer contain `slice(0, 100)`. Two browsers were not used. The server does not yet mint the invoice number itself.

### 5. Paid is not delivered

Cause: workflow status `paid` was read as `completed` in the office list, journey legs, reminders, family schedule, office board, and completed journey count.

Fix: a stored status of `paid` now reads as Needs review. Stored bookings were not rewritten. Payment status `paid` still means the money position. It does not by itself mark a leg delivered.

Verified: `quotes.test.ts`, `bookingWorkflow.test.ts`, `journeyLegs.test.ts`, `familyJobs.test.ts`, and `spires-website/scripts/office-jobs-view.test.mjs`.

### 6. Welcome email

Cause: signup sent two messages, SMTP certificate checks were turned off, and delivery was only written to logs.

Fix:

- One welcome message, HTML and plain text.
- The withdrawn £5 signup offer is not in the message.
- The customer name and email are escaped.
- The message says the password is not emailed. It does not contain a password.
- `welcomeEmailStatus` and `welcomeEmailAttempts` are stored on the customer document.
- A sent welcome is not sent again. Attempts stop at three.
- `rejectUnauthorized: false` is removed from welcome mail and from the shared transporter.

Verified: `functions/src/offers/messages.test.ts` for content, escaping, and the send or stop decision. No message was sent. The IONOS certificate was not checked against a live server.

Firebase Authentication templates were not opened. If a password reset or verification template still mentions the £5 offer, that text is in the Firebase console: project `spires-taxis`, Authentication, Templates.

## Priority 2: scenario matrix

These rows are the journeys requested for the review. “Actual” means what this working copy demonstrated. It does not mean the live system behaved that way.

| Scenario | Starting state | Action | Expected database change | Expected communication | Money | Actual | Evidence | Remaining limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest and registered request | No booking | Customer sends a request | Status stays pending | No confirmation that the journey is booked | None | Helper tests only | Existing quote and guest tests | Callable was not run in the emulator |
| Staff enters an existing customer | Customer profile exists | Staff copies contact onto a booking | Fare, status, and account id stay put | None from this action | None | Existing maintenance copy | Customer maintenance code | No two profile browser run |
| Duplicate click, refresh, back, slow connection | Booking has an outstanding balance | Pay the same amount twice | One Stripe intent for that booking and amount. One credit | Receipt only after a verified payment | One charge of the server amount | Idempotency key is in source. The same payment id is not credited twice | `payment.ts`, `payments.test.ts` | Stripe was not called |
| Quote, revised quote, expired quote, old link | A quote version is issued | Customer uses a link | Only the current issued version can be accepted | Quote mail is separate from acceptance | None until a payment is recorded | Helper result matches | `quotes.test.ts` | Old links were not opened |
| Acceptance before a deposit | Quote accepted, no money recorded | Staff or customer accepts | Booking can remain awaiting payment | Confirmation follows the existing confirmation rule | None | Helper result matches | `quotes.test.ts` | No live acceptance |
| Acceptance after a deposit | Deposit already recorded | Customer accepts the issued version | Accepted quote can move to confirmed | Confirmation can be queued | Deposit already recorded. No new charge from acceptance | Helper result matches | `quotes.test.ts` | No live acceptance |
| Pay later | Confirmed booking, nothing received | Leave it unpaid | No payment fields are invented | None | None | Payable helper rejects a missing fare and a stale amount | `paymentAmount.test.ts` | No pay later browser run |
| One way and return, different drivers | Return booking | Assign each leg | Each leg keeps its own driver. One booking total | None from the assignment itself | None | Helper result matches | `journeyLegs.test.ts` | No admin browser run |
| Open return, later time | Open return, no return time | Leave the time unset | No completed time is invented | None | None | Office board and journey leg tests | `office-jobs-view.test.mjs`, `journeyLegs.test.ts` | No later time was saved |
| Extra stops and agreed extras | Stops added | Save | Warning stays unless the fare includes the stops | None | None | Earlier booking ops tests | `bookingOps.test.ts` from the previous pass | Not re run in this pass |
| Airport departure or collection on each leg | Collection flag contradicts the route | View the booking | Stored flags stay. A note shows the contradiction | None | None | Earlier booking ops tests | `bookingOps.test.ts` from the previous pass | Not re run in this pass |
| Flight delay, waiting, terminal change | Confirmed booking | Change notes | Notes change. No new charge | None unless staff send a message | None | No new charge path in these edits | Code inspection | No booking was edited |
| Cancellation before payment | Unpaid booking | Cancel | Status cancelled | None from the rules change | None | Payable helper rejects a cancelled booking | `paymentAmount.test.ts` | Family cancel payload only |
| Cancellation after payment | Money already recorded | Cancel | Journey can be cancelled. The ledger remains | None from this review | No automatic refund | Payment measurement treats a reduced total as a refund | `payments.test.ts` | No refund was sent to a provider |
| Partial refund and overpayment | Received amount changes | Record the new balance | Ledger stores the delta, including an overpayment position | None unless a receipt job already exists | The recorded delta only | Measurement test | `payments.test.ts` | No provider refund |
| Driver replacement | Allocated booking | Change driver | Driver id changes. Payment does not | Family push can alert once | None | Family push test | `familyPushLogic.test.ts` | No rejected allocation was saved |
| Vehicle conflict | Two jobs overlap on the same vehicle class | View the family schedule | No automatic change | None | None | Conflict is flagged | `familyJobs.test.ts` | Live documents were not checked |
| Missing or expired document date | Stored date is in the past | Review the vehicle | The date is flagged. The vehicle is not taken off the fleet by the date alone | None | None | Earlier assignment review test | `assignmentReview.test.ts` | Not a live licence check |
| Amendment after confirmation or payment | Confirmed or paid booking | Save the booking | Save does not send a message | A message is a separate action | None from save | Drawer copy already says saving does not send a message | `BookingModal.tsx` | The close warning was not clicked |
| Failed email, retry, duplicate trigger | Welcome not sent, or already sent | Signup trigger runs again | Attempt count increases until three, then stops. A sent welcome stays sent | One welcome, then retries only while under the limit | None | Decision function | `messages.test.ts` | No SMTP failure was produced |
| Invoice create, correction, payment, redownload | Vault has history | Two sessions save | The second stale revision is rejected. Paid and email fields survive an email only update | None from the save | None | Revision and merge tests | `quotes.test.ts` | No second browser and no PDF download |
| Customer account linking | Two profiles | Staff uses the maintenance action | A shared name is not a match | None | None | Existing maintenance copy | `Customers.tsx` | No ambiguous records were resolved |
| London midnight, year boundary, daylight saving | Dates around those boundaries | Calculate the London day | The local calendar day is kept | None | None | Half term, journey stats, and family push tests | `quotes.test.ts`, `journeyStats.test.ts`, `familyPushLogic.test.ts` | No booking was saved across midnight |
| Logout while editing | Drawer has unsaved changes | Close it | The drawer asks before discarding | None | None | Confirm is in the drawer code | `BookingModal.tsx` | The prompt was not clicked |
| Two staff edit one booking | Same booking open twice | Both save | Invoice saves conflict on revision. Booking edits still use the last write | None | None | Invoice revision test | `quotes.test.ts` | Bookings have no revision |
| Backend succeeds, browser loses the response | Payment already credited | Browser retries confirmation | The same card id is not credited again | No second receipt from the duplicate credit | One credit | Receipt replay test | `payments.test.ts` | The lost response was not simulated |
| Database succeeds, provider fails | Welcome attempt stored, or card not verified | Provider returns an error | Welcome can retry. A card credit waits for a verified payment | Welcome retries while under three attempts | No credit without a succeeded payment | Welcome decision and receipt tests | `messages.test.ts`, `payments.test.ts` | No provider was failed |
| Recovery after a function crash | Payment id already stored | The event is delivered again | The repeated card event is ignored | None | No second credit | Receipt replay test | `payments.test.ts` | No process was killed |

Callable authorisation was not run in the functions emulator. The database rules were.

## Priority 3

The booking drawer already keeps the summary and save controls available, says that saving does not send a message, and warns before a dirty close. This pass did not add another dashboard panel.

Changes that affect everyday work:

- The booking list filter includes Needs review, so a legacy `paid` status can be found.
- Family phone entry no longer sets payment status. Payment stays on the office booking.
- Invoice history is paged. Older invoices remain in the saved vault.
- Record payment still opens the booking. A one click allocate action on the list was not added.

## Release checklist

Nothing in this list has been deployed. Stripe is not a release step. Welcome review stays hidden because `reviewWelcomeEmail` is not deployed. `REVIEW_WELCOME_EMAIL_RELEASED` stays false.

`saveSchoolInvoiceVault` rejects a payload that omits `expectedRevision`, including when the stored vault has no revision. The admin build reads a legacy vault without writing or cutting the invoice list, treats a missing revision as 0, and sends `expectedRevision`. The save is one transaction. Two first saves against that vault produce one success and one conflict, and the stored list keeps the full history from the save that won. An old payload with no `expectedRevision` is rejected and the vault is left as it was.

Recovery is this admin build together with the new `saveSchoolInvoiceVault` and `getSchoolInvoiceVault`. If the admin fails to load, deploy `spires-admin-fresh/build` again. Leave those two functions in place. The previous admin omits `expectedRevision`, so putting it back does not restore invoice saving.

1. Stop the local functions emulator so the functions compile can write `functions/lib`.
2. Keep a copy of the live Firestore rules from the Firebase console. This working copy is already the new rules.
3. Stage 1. The predeploy compiles the whole functions tree and publishes only these three:

```
npx firebase deploy --only functions:saveSchoolInvoiceVault,functions:getSchoolInvoiceVault,functions:recordManualPayment --project spires-taxis
npx firebase deploy --only hosting --project spires-taxis
```

4. Use this admin for the next invoice save and the next recorded payment. The live `recordManualPayment` accepts Save payment and Save correction, and it ignores `expectedRevision` on Record this payment. This stage publishes the tested function, which checks that field and writes the next booking revision.
5. Stage 2, after staff are on this admin:

```
npx firebase deploy --only firestore:rules --project spires-taxis
```

6. To restore the rules, put the console copy back over `firestore.rules` and run that same rules command. This Firebase CLI has no `hosting:rollback`. Do not restore the previous admin.

## Browser and release verification, 14 November 2026

Nothing below was deployed. The live project was not written. No live Stripe key was used. No SMTP connection was opened.

The local apps were pointed at Firebase emulators for project `demo-spires` only. Admin ran at `http://127.0.0.1:3010` and the customer portal at `http://127.0.0.1:3020`, both with `REACT_APP_FIREBASE_EMULATORS=1`. The website ran at `http://127.0.0.1:4173`. That flag forces the demo project, the demo API key, and the local Auth, Firestore, Functions, and Storage ports. A project id containing `spires-taxis`, or a hostname other than `127.0.0.1` or `localhost`, throws before a connection. With the flag unset, the apps keep their existing production configuration. The admin on port 3000 was left signed out.

Seed data was synthetic: staff `hashim@spires.com`, customer `synthetic.customer@example.com`, drivers Sam Test and Alex Test, vehicles TE57 OUT and TE57 RET, and bookings SYN-LATER, SYN-RETURN, and SYN-OPEN. No production documents were read. Emulator mail uses a local capture file, `functions/local-mail/captured.jsonl`.

### Journeys completed in the browser

Guest request. The contact form on `http://127.0.0.1:4173/contact.html` was submitted for Guest Synthetic, `guest.synthetic@example.com`, 21 November 2026 at 10:00, from 10 Guest Street, Oxford OX1 1ZZ to Oxford Station. The page said: "Your booking request has been received. Your reference is SPMWGXWUGJ5DBFC5E0. This is not a confirmed booking yet." Firestore stored that booking, status pending, fare unset, revision then 2. The office copy was captured locally to `bookings@spires-taxis.com` with subject "New booking request · Guest Synthetic".

Quote. Staff opened the booking and sent a quote for £45.00 with a £10.00 deposit. The form said "Quote version 1 sent." Firestore stored fare 45, deposit required, deposit amount 10, status `awaiting_customer_confirmation`, quote version 1. The first send was queued and then failed because mail was not configured. After the emulator was allowed to use the local capture transport, Retry in Email history captured the quote to `guest.synthetic@example.com`, with copies to `hashim@spires.com` and `bookings@spires-taxis.com`. The job status became `sent`. The message names the £45 total and the deposit.

Customer acceptance. `http://127.0.0.1:4173/quote.html` with the token from that captured message showed the reference, Standard Car, normal fare £45.00, promotion discount £0.00, final total £45.00, and "Deposit of £10.00 is required in advance." Accept quote then said "Your booking is confirmed." Firestore status became `confirmed`, amount received 1000 pence, payment status `partial`. The confirmation to the guest and "Quote accepted" to the office were captured locally. The quote card still said the journey was only a quote and that a payment link would follow. The page now uses the stored payment label: after reload it reads "Your booking is confirmed." and "Part paid. The remaining balance is still due." The accept button is disabled and reads "Quote accepted".

Deposit before acceptance. Record payment of £10.00 cash, dated 14 November 2026, note "Deposit before acceptance", while the quote was still awaiting the customer. The form said "Payment recorded. Status: Part paid." The booking then showed Amount paid £10.00, Outstanding £35.00, Payment status Part paid. The bookings list later showed "Part Paid" and "Received £10.00 · Remaining £35.00".

Pay later. SYN-LATER remained a pending payment booking. An earlier signed in session on this emulator recorded £15.00 cash on it: 1500 pence, stored payment status `partial`, revision 2. The list shows that booking as unpaid until that amount is opened. This session did not repeat that payment.

Return drivers and vehicles. On SYN-RETURN the list saved outbound driver Sam Test with vehicle TE57 OUT, and return driver Alex Test with vehicle TE57 RET. The labels on the return row are "Return driver" and "Return vehicle". Firestore kept `driverId` `driver-sam`, `vehicleId` `vehicle-out`, `returnDriverId` `driver-alex`, and `returnVehicleId` `vehicle-ret` on the same booking. A second overlapping allocation was not clicked, so the 90 minute conflict warning was not shown in the browser.

Open return, then a return time. SYN-OPEN started with the choice "Return time to be confirmed". The form was then set to "Set return pickup time" for 21 November 2026 at 16:30, with phone 07000000999. The list then showed "SYN-OPEN · Return" at Sat 21 Nov, 16:30, "Return: London Paddington → 3 Test Street". Firestore has `openReturn` false, `returnDate` `2026-11-21`, and `returnPickupTime` `2026-11-21T16:30:00.000Z`.

Two sessions and conflict recovery. One browser form held the note "Side gate for the test". A second writer saved the same booking first, with the note "Saved by the other session", and moved the revision to 2. Update Booking then alerted: "This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again." The typed note was still in the form. The second writer was an emulator Admin SDK write, so this was one browser tab plus a second writer. A second browser tab was not opened.

Quick allocation is the same return driver and vehicle save above. Quick payment of the £10 deposit is the record above. Both were clicked in the signed in admin.

Signup, verification, and password reset. The customer portal signup for Portal Synthetic, `portal.synthetic@example.com`, reached the dashboard: "Welcome back, Portal" and "No bookings found." The Auth emulator captured a VERIFY_EMAIL code. Opening that local link returned "The email has been successfully verified" for that address. On the sign in page, Send a password reset message with an empty email said "Enter the email address first." With the address entered, the page said "A password reset message has been sent. On the local test it is captured by the Auth emulator." The emulator held a PASSWORD_RESET code for that address. Completing the local link with the same test password returned "The password has been successfully updated."

Welcome mail. Signup triggered `onCustomerCreate`. The capture file contains "Welcome to Spires Taxis. Your account is ready" to `portal.synthetic@example.com`. That customer record is `welcomeEmailStatus` `sent`, one attempt. The dashboard shows "Welcome messages needing review" for `review.welcome@example.com`, with the text "A previous send is ambiguous. Check the inbox. Do not send another copy until you know it did not arrive." The buttons are "It arrived" and "It did not arrive. Send one copy." Clicking "It arrived" reached `reviewWelcomeEmail`. The functions emulator then failed to start the function ("Failed to load function"), so the record stayed `needs_review`. Staff resolve that row by checking the inbox, then choosing "It arrived" when the message is already there, or "It did not arrive. Send one copy." when it is not. The second button sends one copy. It does not send on its own.

Compiled `onCustomerCreate` uses `.runWith({ failurePolicy: true })`. That is the source and the emulator build. It is not a reading of the deployed function configuration. A provider rejection stores `welcomeEmailFailure` `rejected` and throws while attempts are under 3. A timeout stores `timeout` and throws the same way. An accepted send whose status write fails leaves `sending`. The next run writes `needs_review` and does not send again. Those branches were covered by the existing function tests. This browser session showed the sent path and the review panel. It did not inject a provider rejection, a timeout, or a duplicate send.

### Journeys not completed in the browser

Deposit or balance after acceptance. After the customer accepted, Record this payment for the remaining £35.00 did not change the stored 1000 pence. The functions emulator logged "Failed to start functions" for `recordManualPayment`. The list still shows Received £10.00 and Remaining £35.00.

Cancellation. The open return booking was opened and the status control was set to Cancelled. The form closed without an alert. Firestore stayed `confirmed` at revision 4, with the 16:30 return time still stored. A cancelled booking was not produced.

Payment failure. The record payment form, before the amount was accepted by the form state, showed "Enter the amount received. (functions/invalid-argument)". That message stayed on screen and did not clear the booking. A payment against a cancelled booking was not reached. Stripe was not called.

Invoice generation, PDF download, and redownload. These were not clicked. The server recovery is a unit test: a retry of the same draft id with a pending number returns `ST-INV-202611-001` and does not advance the sequence. That is not a browser flow. Rounding, deposits, partial payments, and duplicate billing were not exercised on the invoice screen.

Conflict between two vehicles on the same leg was not clicked.

### Booking writers after revision enforcement

Client writes go through Firestore rules. The rules require a new staff booking to start at revision 1 and an update to be the stored revision plus one. A denied snapshot sets "The booking list was refused. This is not an empty list." and leaves the rows in place. Sign out still clears the list.

Admin SDK writes bypass the rules, so each booking update in the functions has to move the revision itself. This session found and corrected writes that crashed or skipped the revision: guest booking create, the guest audit entry, quote issue including the email status that follows a skipped or failed queue, quote resend, and the reminder flag updates. Quote tokens, email jobs, and the audit subcollection are separate documents. Share bookings are a different collection and do not use this revision.

A local Admin SDK race wrote a driver and vehicle in one transaction and a received amount plus payment status in another, on the same booking. Both sets of fields remained, the fare stayed, and the revision finished at 3. A rules denial is reported as an error. It is not turned into an empty list or a success message.

The family allow list now includes the operational vehicle and return vehicle fields, and the timestamps a phone update sends. It still excludes payment status, the ledger, the quote, ownership, and acceptance. Office create no longer sends payment status. Family fare changes remain limited to bookings whose source is family.

### Invoice recovery and old tabs

If a save succeeds and the response or the PDF download fails, the admin reload looks up that same draft id and downloads the number already stored. It does not ask for a new number. A new draft id would be a new invoice. Redownload uses the stored number. This path was unit tested and was not clicked in the browser.

Do not roll `saveSchoolInvoiceVault` back to the previous function. That function cuts the invoice history. Forward recovery is another save of the same draft id, which returns the issued number.

An old open admin tab that omits the next revision is rejected once these rules are deployed. A new admin can still save against the rules that are live today, because those rules accept the extra revision field. The family key addition in this session was not run through the rules script again. The earlier script already showed the revision rejection and the family ledger rejection.

### Deployment inventory, when a deploy is requested

Keep the live system unchanged until that request. Deploy in this order:

1. `saveSchoolInvoiceVault` and `getSchoolInvoiceVault` with the admin build.
2. `firestore.rules` with the admin build. Indexes in `firestore.indexes.json` only if a new query requires them. This session did not add an index.
3. `createPaymentIntent`, `confirmPayment`, and `stripeWebhook` together, after a test mode payment has been watched.
4. `onCustomerCreate` and `reviewWelcomeEmail` after a controlled SMTP send. `reviewWelcomeEmail` is new.

Also in this working copy, and not deployed:

- Functions that write bookings or mail: `issueQuote`, `saveQuoteDraft`, `recordManualPayment`, `sendPaymentRequest`, `acceptQuote`, `retryEmailJob`, `resendQuoteEmail`, `quotePublic`, `submitWebsiteQuote`, `processEmailJob`, `sendBookingPdfToCustomer`, `sendGeneralInvoiceEmail`, reminder processing, and the guest claim handlers.
- Admin hosting is `spires-admin-fresh/build`. The customer portal is a separate app and is not the Firebase hosting target in `firebase.json`.
- Website files that change the booking flow on a loopback host: `contact.html` through `js/guest-booking.js`, `quote.html`, and `js/office-jobs.js`. Production hostnames stay on the live function URLs.
- Storage rules were not changed in this verification.

A full functions deploy would also publish other uncommitted work in this tree, including executive service work that stays switched off. Use named function deploys.

### Still blocked before a live release

- Stripe test mode. No `sk_test` key and no webhook signing secret are available. Live Stripe keys must not be substituted. The emulator refuses a key that starts with `sk_live` before it builds a Stripe client. Stripe was not called.
- A controlled SMTP recipient and a certificate check against the real IONOS host. Local mail was captured. No SMTP connection was opened, so the certificate was not checked.
- Firebase Authentication email templates in the console. They are not files in this repository and were not opened. The emulator captured the verification and reset codes. That does not show the production template wording.
- Invoice PDF download, redownload, a lost download of the same draft, and two browser sessions creating invoices. The first save issued `ST-INV-202611-001` and the paper was built, then `html2pdf` `.save()` did not resolve. Details are in the 15 November section. The unit test that retries a draft id is not this browser flow.
- A signed in account that is not an office address was not used in the browser for `reviewWelcomeEmail`. A signed out call returned `UNAUTHENTICATED`. The earlier emulator check still covers `PERMISSION_DENIED` for the invoice, payment, and quote handlers.

## Browser results, 15 November 2026

Isolated project `demo-spires`. Production was not deployed and was not written to. A scenario is complete only where the screen, Firestore, and captured mail agree.

### Functions that failed to load

The earlier "Failed to load function" for `recordManualPayment` and `reviewWelcomeEmail` was the functions discovery timeout. A clean `require` of `functions/lib/index.js` took about 10.1 seconds, past the default 10 second discovery limit, and Secret Manager returned 403 for `demo-spires` while the worker was reloading. There was no exception inside those two handlers.

The emulator was started with `FUNCTIONS_DISCOVERY_TIMEOUT=60000` and a gitignored `functions/.secret.local` holding synthetic local values. That start initialised `recordManualPayment`, `reviewWelcomeEmail`, `issueQuote`, `acceptQuote`, `quotePublic`, `submitWebsiteQuote`, `saveSchoolInvoiceVault`, `getSchoolInvoiceVault`, `processEmailJob`, and `onCustomerCreate`. The log did not contain "Failed to load function". Later payments, the welcome review, the invoice vault save, and the pay later quote all ran through those handlers. Nothing was written straight to Firestore to stand in for a failed call.

Copying a compiled file into `functions/lib` reloads the worker. Mail capture was moved to `local-mail-capture/` so a captured message does not reload it. `admin.firestore.FieldValue` is undefined in this worker. The receipt job and the invoice vault save now use `FieldValue` from `firebase-admin/firestore`. Other files still use the namespace and will throw if those paths run.

### £45 booking

The booking is `Zj1ts0FyMneXDDuwDxHC`, reference `SPMWHIP1MP30C6087F`, fare £45. The issued quote asked for a £10 deposit (`paymentRequirement` `advance`, `amountRequestedPence` 1000). The customer page showed "Deposit of £10.00 is required in advance." before acceptance.

The office recorded £10 and then the remaining £35 through Record payment. The second click said "Payment recorded. Status: Paid." Firestore held `amountReceivedPence` 4500, `paymentStatus` `paid`, fare 45, and status `confirmed`. The list showed Confirmed and Paid. The customer page showed "Your booking is confirmed." and "Paid. Nothing further is due." Outstanding is £0. Neither leg became `completed`. It is a one way booking, so there is no return leg. Payment did not complete the journey.

The receipt trigger had crashed on `FieldValue` before the fix, so the first transition to paid did not queue a receipt. After the fix, Correct a payment moved the recorded total £45 to £44 and back to £45. That second transition to paid queued one receipt. The capture is "Your Spires Taxis Payment Receipt" to `guest.fortyfive@example.com` at 2026-11-15T07:43:36.997Z. The job `payment_receipt__Zj1ts0FyMneXDDuwDxHC__1` is `sent`. The ledger has four entries because of those two corrections: add 1000, add 3500, correct total 4400, correct total 4500. Received stays 4500.

Repeating the £35 `clientRequestId` `paymwhivr7j7aam1r` through `recordManualPayment` returned `duplicate: true` and did not add an entry or change the revision.

### Cancellation

Closing the booking form without Update Booking left the stored status unchanged. That was a discard.

The whole booking was then set to Cancelled and saved with Update Booking. Firestore `status`, `adminStatus`, and `customerStatus` are `cancelled`, `paymentStatus` is `paid`, received is 4500, fare is 45, revision 12. All bookings shows Cancelled and Paid. The customer page shows "This booking is cancelled.", "Paid. Nothing further is due.", and a disabled "Booking cancelled". A later `recordManualPayment` of £1 with `clientRequestId` `pay-after-cancel-1` returned `FAILED_PRECONDITION`: "This booking is cancelled. Review its payments before making changes." No new ledger entry.

One leg was saved separately on `SYN-RETURN`. Stored `status` stayed `confirmed` and `returnStatus` is `cancelled`. Upcoming jobs lists "SYN-RETURN · Outbound" as Confirmed and does not list the return. The list does not say the return leg is cancelled. That save also rewrote the return stops to the outbound direction, 2 Test Street to Heathrow, because the empty address fields were filled in order to pass the form check. Fare stayed 120 and the payment was not changed.

### Invoice

`saveSchoolInvoiceVault` issued one invoice, `ST-INV-202611-001`, draft `draft_1794731612862`, for Invoice Guest, reference `SPMWHIP1MP30C6087F`. The sequence `ST-INV-2026-11` is 1. The PDF frame on the admin screen contains the reference, 4 Test Street to Oxford Station, travel date 22 November 2026, one line at £45.00, VAT £0.00, and "Deposit received £10.00. Balance £0.00."

The Download button is still "Preparing PDF…". `html2pdf().save()` has not resolved, and the A4 frame is still in the page. No PDF file was produced. Redownload, a lost download of this same draft, and a second browser session were not run. A new click on Download PDF invoice, while this invoice is not the one being edited, would create a new draft id and could issue `ST-INV-202611-002`. That click was not made.

### Welcome review

"It arrived" for `review.welcome@example.com` said "Marked as arrived. No further copy was sent." The customer is `welcomeEmailStatus` `sent`, reviewed by `hashim@spires.com`, with audit `welcome_review_arrived`. No welcome message was captured for that address.

"It did not arrive. Send one copy." for `send.once.welcome@example.com` captured exactly one message, "Welcome to Spires Taxis. Your account is ready", at 2026-11-15T08:36:24.742Z. The audit is `welcome_review_sent`. A later `send_once` on that customer returned `FAILED_PRECONDITION`: "This message is not waiting for review."

"It did not arrive. Send one copy." for `reject.welcome@example.com` said "The copy was not accepted. No message was captured. It is still waiting for review." The row stayed on screen. Two audits are `welcome_review_send_failed`. The capture file has no message to that address. A simultaneous `send_once` and `arrived` then recorded another `welcome_review_send_failed` and `welcome_review_arrived`. Arrived won, the status is `sent`, and no message was captured.

A call with no token returned `UNAUTHENTICATED`: "Sign in required."

The first failure replaced the whole review list, so the remaining row disappeared until reload. The panel now keeps the error with the rows. After reload, `reject.welcome@example.com` was visible again.

### Two sessions, one booking

Two admin tabs at `http://127.0.0.1:3010/` were both signed in. Both opened `SYN-OPEN`. The first tab kept the note "Side gate from session A" and did not save yet. The second tab saved "Saved by session B". Firestore revision is 4 and the stored note is "Saved by session B". The first tab then saved and `window.alert` showed "This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again." The note "Side gate from session A" was still in the open form. The stored note stayed "Saved by session B".

The open return form required a phone and a return date before it would submit. The winning save stored phone `07000000003` and left `openReturn` true, with no return pickup time.

### Pay later, and the issued quote

`SYN-LATER` was confirmed with no issued quote, fare £40, nothing received. The form saved it as pending, then Send quote with Deposit required set to No. The screen said "Quote version 1 sent." Firestore `issuedQuote.paymentRequirement` is `later`, `amountRequestedPence` is 4000, `depositRequired` is false, and `quoteIssuedVersion` is 1. Status is `awaiting_customer_confirmation`.

The captured quote to `synthetic.customer@example.com`, with copies to `hashim@spires.com` and `bookings@spires-taxis.com`, says "Payment can be made later." The public page `quote.html?t=rmcSK9ckcWnZuVcHZ2DNeMvtoSNy4T_femvZfBo0Tkc` shows reference SYN-LATER, 1 Test Street to Oxford Station, final total £40.00, and "Payment can be made later."

The open form was then changed to Deposit required Yes. Send updated quote was not used. Firestore stayed `later` at version 1. Reloading the public page still showed "Payment can be made later." The customer requirement is the issued quote. The unsaved form did not change it.

The £45 journey is the advance counterpart: the public page showed the £10 deposit from the issued quote, and the stored `paymentRequirement` was `advance`.

## Checks that stay at unit or integration level

These were not clicked through as browser journeys.

- Invoice numbers. Two emulator sessions that both started from revision 0 produced one success and one conflict. The second session reloaded and received `ST-INV-202611-002`. A later journey invoice received `ST-INV-202611-003`. A retry of the same draft id keeps `ST-INV-202611-001` and does not advance the sequence.
- Card claims. The Firestore emulator ran `commitCardReceipt` for a simultaneous webhook and browser confirmation, one payment submitted against two bookings, a cash deposit then a card balance, a separate card deposit and balance, two equal amounts, a fare change while an intent was open, and a retry after the first credit. Stripe itself was not called.
- Welcome retry. Two concurrent emulator triggers produced one message. A record left at `sending` was marked `needs_review` and was not sent again.
- Callable authorisation. Signed out calls to `createPaymentIntent`, `confirmPayment`, `saveSchoolInvoiceVault`, `recordManualPayment`, and `issueQuote` returned `UNAUTHENTICATED`. A signed in account that is not an office address received `PERMISSION_DENIED` for the invoice, payment, and quote handlers.
- An earlier scripted emulator journey confirmed a booking, stored two drivers, completed it, and issued `ST-INV-202611-003`. That script did not use the website, the customer portal, or the admin screen.
- Admin `tsc --noEmit` exited 0. The Share suite passed after the fixture clock was pinned. Those are build and test results.
- Firestore still returns the whole booking to a family device that is allowed to read it. Fare and payment fields are visible on that read. The write rules stop the family device from changing the ledger, quote, ownership, and acceptance fields.
- An old invoice function cuts the history at 100. An emulator check showed that cut drops the newest record in a list of 101. Leave the new function in place. Payment claim documents are extra. An older function ignores them. Stored bookings whose status is `paid` are not rewritten. The admin reads that status as Needs review.
