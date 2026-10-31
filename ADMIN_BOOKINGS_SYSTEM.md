# Spires Taxis admin bookings system

This note is for a reviewer. It describes how the live admin bookings system is wired, as the code stands in this repository. It is not a wish list. Where the code and the screen disagree, the code is what is described.

Spires Taxis is a family run Oxford private hire company. The admin is the office tool. It is not a chauffeur product and it does not create a customer login by itself.

## 1. Three front ends, one database

| Surface | Folder | Where it is hosted | How it writes a booking |
| --- | --- | --- | --- |
| Admin | `spires-admin-fresh` | Firebase Hosting, project `spires-taxis`, `https://spires-taxis.web.app` | Staff browser writes Firestore directly |
| Public website | `spires-website` | Vercel, `https://www.spires-taxis.com` | Browser posts to Cloud Function `submitWebsiteQuote` |
| Customer account | `customer-app` | Separate app, same Firebase project | Signed-in user calls Cloud Function `createCustomerBooking` |

All three land in the Firestore collection `bookings` in project `spires-taxis`, region `us-central1`.

Cloud Functions live in `functions` (TypeScript, compiled to `functions/lib`, Node 22). The client never reads `emailJobs`, `quoteTokens`, `termsTokens`, or `bookings/{id}/audit`. Those are written only by functions using the Admin SDK, which bypasses security rules.

Do not deploy the marketing site with Firebase Hosting. Hosting `public` is the admin build only (`firebase.json`).

## 2. Who is allowed to do what

Staff and quote admins are the same two accounts, hard coded in more than one file. They must stay in sync:

- `firestore.rules` `isStaff()` and `isAdmin()`
- `functions/src/quotes/quoteWorkflow.ts` `ADMIN_EMAILS`
- Family staff list, if used

Emails: `spirestaxis24@gmail.com` and `hashim@spires.com`.

| Actor | Bookings access |
| --- | --- |
| Those two staff emails | Read and write every booking from the admin app |
| A signed-in customer | Read bookings where `uid` equals their Auth uid. Create is also allowed by rules, but the live app uses `createCustomerBooking` instead. They may update only a small field list, and only while `status` is `pending` |
| Family device | Rules allow read and write if the Auth token has `familyJobs == true` and `familyDevices/{uid}` is enabled and unexpired. The Family Jobs screen exists in code but is not mounted in the admin navigation |
| Everyone else | No booking access |

Customers cannot delete bookings. Staff can, from the admin, with `deleteDoc`.

Quote, terms, PDF email, payment record and acceptance actions are callable functions. They check the same two admin emails. A staff user who is not in that list can edit the booking document in Firestore but the quote buttons return permission denied.

## 3. The booking document

One Firestore document is one job. A return is extra fields on that same document. It does not create a second booking.

There is no separate jobs collection. "Job" and "booking" are the same document.

### Identity of the document

- Admin create uses `setDoc` with the booking number as the document id. The number is `SP` plus the last 6 digits of `Date.now()` (`generateSpiresBookingNumber`). Two creates in the same millisecond can collide.
- Website quotes and customer-account bookings use an automatic document id. They store `bookingNumber` as a field. Website numbers are also `SP` plus time digits, plus two random digits.
- `bookingNumber` is what staff and customers see. The document id is what functions receive as `bookingId`.

### Two shapes in one document

The admin form uses office fields. The customer app and website also write a parallel set. Both are often copied onto the same document so each screen can read its own names.

| Office field | Customer or website field | Meaning |
| --- | --- | --- |
| `hirerName` | `name` | Customer name |
| `hirerPhone` | `phone` | Phone |
| `hirerEmail` and `email` | `email` | Email. Quote and receipt code reads `hirerEmail` first, then `email` |
| `pickupLocation` | `pickup` | Pickup. The customer app list shows `pickup`, not `pickupLocation` |
| `destination` | `destination` | Destination |
| `pickupTime` and `dateTime` | `dateTime` | When. Admin saves both from the form |
| `hirerAddress` | | Office only |
| `uid` | `uid` | Firebase Auth uid. This is what puts the job on the signed-in account |
| `customerId` | | Set by Link Bookings. The customer app does not query this field |

`source` says who created it:

- `admin` on a new office booking
- `website` on a public quote request
- `customer_app` when `onBookingWrite` sees a uid and no source
- `family` on a family-calendar create
- omitted on many older rows

`createdByFunction: true` means a Cloud Function wrote it (website quote or customer-account booking). `stampPromotionOnCreate` uses that flag. A browser write with `source` `website` or `customer_app` and without that flag is treated as untrusted and can have quote, payment and terms fields stripped.

### Status is three fields

- `status` is the main workflow field the admin form edits.
- `adminStatus` is a legacy copy. Some older rows stored "allocated" only here.
- `customerStatus` is what the customer app prefers when present. The app falls back to `status`.

Allowed workflow values in `quoteWorkflow.ts`:

`pending`, `awaiting_customer_confirmation`, `confirmed`, `allocated`, `completed`, `cancelled`.

`paid` still appears on old rows as a status. Filters treat `paid` as completed. Payment itself is `paymentStatus`, not the workflow status.

`paymentStatus` is `pending`, `partial`, or `paid`.

Quote fields, when a quote has been issued:

- `issuedQuote` object, including fares in pence, vehicle, journey text, payment requirement, terms text, valid until
- `quoteIssuedVersion` number
- `quoteAcceptedVersion` number
- `quoteAcceptanceSubstatus` `awaiting_payment` or absent
- `quoteEmailStatus`, `quoteEmailSentAt`, `emailError`
- `paymentLinkUrl`, `paymentDescription` `full` or `deposit`, `amountRequestedPence`
- `paymentLinkEmailStatus`
- `amountReceivedPence`, `outstandingPence`, `paymentVerified`
- `normalFarePence`, `discountPence`, `finalFarePence`, `actualFare` in pounds
- `promotion` object stamped on create

Terms fields:

- `termsAccepted`, `termsVersion`, `termsAcceptedAt`
- `acceptanceMethod`: `customer_portal`, `website`, `terms_link`, `phone`, `email`, `whatsapp`, `in_person`, `other`
- `termsAcceptanceRecordedAt`, `termsAcceptanceRecordedBy`, `termsAcceptanceNote` for staff records

Current published terms version is `2026-10-25`. URL `https://www.spires-taxis.com/terms/2026-10-25`. The version string is the publication date. The "applies to journeys from 1 April 2026" date is separate and is not the version id.

## 4. How a booking gets into the list

```
Website form  --> submitWebsiteQuote --> bookings/{autoId}  source=website
Customer app  --> createCustomerBooking --> bookings/{autoId}  uid set, source later stamped customer_app
Admin modal   --> setDoc bookings/{SP######}  source=admin
Family screen --> setDoc source=family  (screen is not in the admin nav)
CSV import    --> addDoc via useFirebase.addBooking
```

Then every create and update hits `onBookingWrite`.

### 4.1 Admin manual booking

`BookingModal` saves with the Firestore client SDK. It does not call a function to create the job.

On create:

- Document id is the new `SP######` number.
- `source` is `admin` if empty.
- Choosing a past customer fills name, phone, address and email.
- If that email matches exactly one past booking that has a `uid`, the new job gets that `uid`, plus `name`, `phone`, `pickup` and `customerStatus`. That is what makes it show in the customer app.
- If the person has an account but no previous booking stored their email and uid, this match fails. Link Bookings can still attach them by searching the `customers` collection.
- Quote and terms panels are hidden until the document exists. Save first, then open the job again to send a quote or record terms.

On edit, the modal loads the existing document, including quote and terms panels.

The name list is built only from existing bookings (`buildCustomerSuggestionsFromBookings`), not from the `customers` collection. Bookings that share an account uid, or the same email or phone as that account, collapse into one suggestion labelled `Name · email`.

### 4.2 Public website request

`spires-website/js/quote-form.js` POSTs JSON to `submitWebsiteQuote`.

The function requires name, email, phone, pickup, destination, date and time, plus agreement to terms version `2026-10-25`. It writes a `pending` booking with `createdByFunction: true` and `acceptanceMethod: "website"`. It does not set `uid`. It does not email a price. It stores a `promotion` decision for the half term airport-return offer.

The old no-JavaScript path on some forms still posts to Formspree and does not create a booking.

### 4.3 Customer account booking

`customer-app` `BookingForm.jsx` calls `createCustomerBooking` while signed in.

The function requires terms version `2026-10-25` and `termsAccepted: true`. It writes `uid`, email from the Auth token, `source: "customer_app"`, `createdByFunction: true`, `status: "pending"`, `acceptanceMethod: "customer_portal"`. It does not take a card payment.

The customer dashboard query is only:

`bookings` where `uid == auth.uid`, ordered by `createdAt`.

A manual job with the right email but no `uid` does not appear there.

### 4.4 Link Bookings screen

Admin tab `link-bookings`. This is the older attach tool.

`linkBookingsToCustomer` sets on the selected booking ids:

- `customerId` to the `customers/{uid}` document id
- `uid` to that same id, so the customer app can see the job
- `linkedAt`, `linkedBy`

It does not copy the customer's email onto the booking. A confirmation email still needs `hirerEmail` or `email`.

### 4.5 Customers screen

There is no customer master record on this screen. Rows are grouped from bookings:

1. By `uid` if present
2. Else by email
3. Else by phone of at least 10 digits
4. Else one row per leftover booking

So an office job with no uid and no email does not sit on the account row, even when the phone matches. Editing the group writes name, phone and, if filled, `email` and `hirerEmail` onto every booking in that group. It does not move a booking from one group into another.

The real account record is `customers/{auth uid}`, written at sign-up by the customer app. Admin can read it. Link Bookings searches it. The new-booking name list does not.

## 5. Admin screens that touch bookings

Navigation in `spires-admin-fresh/src/utils/constants.ts`:

- Dashboard. Counts, today's jobs, pending customer bookings, optional desktop reminder.
- Drivers. Max 3 active drivers is a UI limit in `useDriverLimitCheck`.
- Vehicles.
- Bookings. The list, filters, PDF, email PDF, driver reminder, duplicate, edit.
- Customers. Derived profiles.
- Invoices and school invoices. Separate from the booking document. School vault is a callable, not a booking field.
- Spires Share. A different product with its own collections (`spiresShare*`). Do not treat those as airport-transfer bookings.
- Link Bookings.

`BookingModal` is global. It opens over any tab.

Inside an existing booking only:

- `TermsAcceptance`
- `QuoteEditor`

`FamilyJobs.tsx` is a phone calendar that reads and writes the same `bookings` collection with `source: "family"`. It is not imported by `App.tsx`, so it is not on the live admin nav unless something outside this file mounts it.

`CSVImport.tsx` can create bookings through `addBooking` (`addDoc`, automatic id, no `source: "admin"` unless the CSV row has it).

## 6. Quote flow

Quotes are not a second collection. Issuing a quote updates the booking and writes `quoteTokens/{sha256}`.

`QuoteEditor` calls:

| Button | Function | Effect |
| --- | --- | --- |
| Save draft | `saveQuoteDraft` | Stores the figures. Does not email |
| Send quote | `issueQuote` | Requires a normal fare in pounds and pence, such as `85` or `85.00`. Moves status to `awaiting_customer_confirmation`. Emails the customer. Sends a separate copy to the signed-in admin and to `bookings@spires-taxis.com` |
| Save payment link | `savePaymentLink` | Stores an https link. Host must be `checkout.stripe.com`, `buy.stripe.com`, `pay.stripe.com`, or `payments.stripe.com`, unless extra hosts are configured. Does not email. Does not mark paid |
| Send payment request | `sendPaymentRequest` | Emails the stored link. Does not mark paid |
| Resend quote | `resendQuoteEmail` | New token, same issued version. Also sends the office copy |
| Record acceptance | `recordManualAcceptance` | Staff records that the customer accepted, for example by phone |
| Record payment received | `recordManualPayment` | Stores money received. Confirms the job only if this quote version was already accepted and the amount covers the amount requested |
| Retry failed email | `retryEmailJob` | Needs the `emailJobs` document id. Staff cannot see that collection in the app |

`canIssueQuote` refuses send when status is `confirmed`, `allocated`, `completed`, or `cancelled`. A second send on `awaiting_customer_confirmation` needs the reissue tick. Reissue invalidates the old acceptance link by version, not by deleting the old token.

Customer accept:

- Public page `https://www.spires-taxis.com/quote?t={token}` uses `quotePublic` to view and `acceptQuote` with the token.
- A signed-in customer can accept only if `booking.uid` equals their uid.
- Payment later: accept sets `confirmed`.
- Advance payment: accept sets `awaiting_customer_confirmation` and `quoteAcceptanceSubstatus: awaiting_payment`. It becomes `confirmed` only after `recordManualPayment` verifies the amount, or the equivalent payment path.

Fares inside quotes are integer pence. `actualFare` on the booking is pounds. `poundsToPence` rejects empty text, symbols other than a stripped `£` and commas, and more than two decimal places. An empty fare used to surface as `INTERNAL` because it threw a plain `Error`. It is now returned as `invalid-argument` with the sentence "Enter the normal fare in pounds and pence." The form also checks before the call and will use `actualFare` if the quote box is empty but the booking already has one.

The quote email is not the same as the PDF confirmation. The quote email is HTML from `quoteEmailHtml` with a link to `/quote?t=...`.

Office copy subject looks like: `Copy: Your Spires Taxis quote SP123456 sent to customer@example.com`. The customer BCC to `bookings@` is skipped when that explicit copy list is present, so the office gets one real message rather than a hidden copy to the same mailbox that sent it.

## 7. When emails send

SMTP is IONOS via `functions.config()` (`email.user`, `email.pass`, `smtp.host`, `smtp.port`). From address is `bookings@spires-taxis.com`. If the password is missing, the send fails. The function must not pretend it succeeded.

Pipeline:

1. Something writes `emailJobs/{id}` with `status: "queued"`.
2. `processEmailJob` claims it, sends it, then sets `sent` or `failed`.
3. The booking gets `quoteEmailStatus` or `confirmationEmailSentAt` or `paymentReceiptEmailSentAt`.

| Event | Who queues it | Who receives it |
| --- | --- | --- |
| New pending booking | `onBookingWrite` calls `notifyAdminNewBookingRequest` directly, not via `emailJobs` | Office |
| Quote | `issueQuote` or `resendQuoteEmail` | Customer, plus copy to the admin who sent it and `bookings@spires-taxis.com` |
| Payment link request | `sendPaymentRequest` | Customer. Also BCC office unless a quote-style copy list exists |
| Booking confirmed | `onBookingWrite` when status first becomes confirmed, allocated, completed, or paid, and `confirmationEmailSentAt` is empty, and an email exists. Family jobs with no email are skipped | Customer, via `sendBookingReceipt` PDF |
| Payment becomes paid | `onBookingWrite` if `paymentReceiptEmailSentAt` is empty | Customer receipt PDF |
| Terms link | `createTermsAcceptanceLink` with send email | Customer, direct send, not the job queue |
| Staff PDF button | `sendBookingPdfToCustomer` | Address typed in the prompt. Suggested from `hirerEmail` or `email` |
| Driver reminder | `sendDriverReminderManual` and the 15 minute scheduler | Driver |
| Welcome | `onCustomerCreate` on `customers/{uid}` | New account |

Important limit: a confirmation is sent once, on the transition into a confirmed-type status. Adding an email later to a job that is already confirmed does not send another confirmation. Use Email PDF for that. A job saved as pending is emailed when it is later confirmed, if the email is already on the document at that moment.

`shouldSendConfirmation` is true if any of `status`, `adminStatus`, or `customerStatus` is `confirmed`, `allocated`, `completed`, or `paid`. Setting `customerStatus` to `confirmed` while leaving `status` as `pending` can still send the confirmation email.

## 8. Terms

Online channels (`customer_portal`, `website`) must send `termsAccepted: true` and version `2026-10-25`. Anything else is rejected. The agreement is stored on the booking. It is not a separate account flag.

Staff can record an agreement that happened by phone, email, WhatsApp, or in person through `recordStaffTermsAcceptance`. That needs a method, a London date and time, and a note of at least 3 characters. It writes the current version. It does not email by itself.

`createTermsAcceptanceLink` makes a 14 day token in `termsTokens` and optionally emails it. Opening the link does not record agreement. Submitting it calls `acceptTermsPublic`.

An enquiry or a quote is not an accepted booking, and recording terms is not a confirmed car.

## 9. onBookingWrite, the knot in the middle

`functions/src/index.ts` `onBookingWrite` runs on every booking create, update, and delete.

On create:

1. `stampPromotionOnCreate` writes a `promotion` object. Half term discount is only for an eligible airport return in the offer window, standard car or 8 seater, from the website or customer app. Office jobs are stored as not eligible. The stamp does not by itself change the fare the staff typed.
2. If the write looks like a customer or website browser write without `createdByFunction`, the stamp also strips quote acceptance, payment link, and untrusted terms.
3. If the new row is pending, the office gets a new-request email.
4. If the new row is already in a confirmed-type status and has an email, a confirmation email is queued.

On later updates:

- Queue the confirmation the first time it becomes confirmed-type.
- Queue a payment receipt the first time `paymentStatus` becomes `paid`.

Deleting a booking does nothing in this trigger beyond returning.

Because the trigger writes the booking again, a bug in the stamp can loop or overwrite staff fields. Review changes here with care.

## 10. What the customer sees

Signed-in account, `customer-app/src/Dashboard.jsx`:

- Lists only `uid == auth.uid`.
- Route line uses `pickup` and `destination`.
- Date uses `dateTime`.
- Status display uses `customerStatus` if set, otherwise `status`.
- They can accept a quote from `QuotePage.jsx` via `acceptQuote`.
- Card payment callables `createPaymentIntent` and `confirmPayment` exist. The customer booking form does not use them. Live card taking for quotes is a pasted Stripe link, then staff record the money.

Public site:

- Quote request becomes a pending booking for the office to price.
- Business account page ` /business-accounts` posts to `submitBusinessAccountEnquiry`. That only emails `bookings@spires-taxis.com`. It does not create a booking, a login, or credit.

## 11. PDFs and invoices

- Print or download on the bookings list builds a PDF in the browser (`pdfGenerator`).
- Email PDF uploads that PDF to `sendBookingPdfToCustomer`.
- Automatic confirmation and receipt emails build the PDF on the server in `sendBookingReceipt`.
- General invoices and school invoices are separate tools. They are not line items on `bookings`.

## 12. Security rules that matter to a fix

`firestore.rules` for `bookings`:

- Staff or a valid family device: full read and write.
- Customer: read own `uid`. Create only as pending, with the current terms version, and without quote or payment fields. Update only the listed journey fields while still pending. No deletes.
- `bookings/{id}/audit`: nobody from a client.
- `emailJobs`, `quoteTokens`, `termsTokens`: nobody from a client.

A function using the Admin SDK ignores these rules. A bug in a function can write any field.

## 13. Known sharp edges

These are the places a review should look first. They are real in this code, not guesses about future work.

1. Empty quote fare used to show `INTERNAL`. The message is fixed in the working tree. The customer still must enter a fare before a quote will send.
2. Quote buttons only render after the booking has an id. A brand new unsaved form cannot send a quote.
3. Customer app visibility is `uid` only. Email on the document is not enough.
4. The new-booking suggester does not read `customers/{uid}`. Link Bookings does. A person who signed up but never had a booking with that email will not attach from the name box.
5. Link Bookings sets `uid` but not the email. The job can show in the app and still not email.
6. Customers are derived, so the same human can appear twice: once under `uid:` and once under `email:` or `phone:`, until a later booking carries both.
7. `status`, `adminStatus`, and `customerStatus` can disagree. Confirmation email logic treats any of them as enough.
8. Confirmation email does not send again if the job was already confirmed before the email address was added.
9. Office copy of a quote is implemented on `issueQuote`, `resendQuoteEmail`, and `processEmailJob`. It is not a BCC to the From address, because that mailbox often never shows a copy of its own mail.
10. `FamilyJobs.tsx` is not on the admin navigation.
11. Booking numbers are time based and short. They are display refs, not a guaranteed unique key, except when the admin also uses the number as the document id.
12. Website and customer creates do not set `uid` on the website path. Only the customer function sets `uid`.
13. Half term promotion is stamped on every create by the trigger. Eligibility is decided on the server. Do not trust a discount flag sent by the browser.
14. Stripe PaymentIntent code is still deployed. The quote flow does not call it. Do not assume a Stripe webhook marks a pasted payment link as paid.
15. Callable failures that throw a plain `Error` become the client string `INTERNAL`. Validation should throw `HttpsError` with `invalid-argument` or `failed-precondition`.
16. Node 20 Cloud Functions can no longer be deployed. This project's `functions/package.json` engine is Node 22. Existing older functions stay on their last runtime until redeployed.
17. `functions.config()` for SMTP is deprecated by Google in March 2027. Email will break on deploy after that until it is moved to params.

## 14. File map

Admin UI:

- `spires-admin-fresh/src/App.tsx` shell, auth, which screen is open
- `spires-admin-fresh/src/utils/constants.ts` nav and payment methods
- `spires-admin-fresh/src/hooks/useFirebase.ts` live booking, driver and vehicle listeners
- `spires-admin-fresh/src/components/Bookings.tsx` list and PDF email
- `spires-admin-fresh/src/components/BookingModal.tsx` create and edit, customer attach
- `spires-admin-fresh/src/components/QuoteEditor.tsx` quote buttons
- `spires-admin-fresh/src/components/TermsAcceptance.tsx` staff terms
- `spires-admin-fresh/src/components/Customers.tsx` profiles derived from bookings
- `spires-admin-fresh/src/components/LinkBookings.tsx` attach uid from the customers collection
- `spires-admin-fresh/src/utils/customerSuggestions.ts` name and email matching for the booking form
- `spires-admin-fresh/src/utils/customerProfilesFromBookings.ts` customers screen grouping

Functions:

- `functions/src/index.ts` triggers and exports
- `functions/src/quotes/callables.ts` quotes, website requests, email jobs, promotion stamp
- `functions/src/quotes/quoteWorkflow.ts` status, payment buckets, who is an admin
- `functions/src/quotes/emails.ts` quote HTML and SMTP send
- `functions/src/quotes/halfTerm.ts` fare parsing and the offer
- `functions/src/quotes/paymentLink.ts` allowed payment hosts
- `functions/src/terms/callables.ts` customer create, staff terms, terms links
- `functions/src/terms/bookingTerms.ts` version `2026-10-25` and staff validation
- `functions/src/sendBookingReceipt.ts` confirmation and receipt PDFs, new-request notice
- `functions/src/driverReminderEmail.ts` SMTP and `ADMIN_EMAIL = bookings@spires-taxis.com`
- `functions/src/businessAccounts/callables.ts` business enquiry email only

Rules and hosting:

- `firestore.rules`
- `firebase.json` admin hosting and functions

Customer and website:

- `customer-app/src/components/BookingForm.jsx`
- `customer-app/src/Dashboard.jsx`
- `customer-app/src/QuotePage.jsx`
- `spires-website/js/quote-form.js`

## 15. A normal office job, end to end

1. Staff opens Bookings, New booking, picks the customer row that shows the email, checks Customer email, sets the journey, saves.
2. Firestore document `bookings/SP######` appears. `onBookingWrite` stamps `promotion` and, if the status is pending, emails the office that a request exists.
3. Staff opens that booking. Quote panel is now visible. They enter the normal total and press Send quote.
4. `issueQuote` writes the quote, sets `awaiting_customer_confirmation`, queues `emailJobs`.
5. `processEmailJob` emails the customer and a copy to the staff inbox and `bookings@spires-taxis.com`.
6. The customer opens `/quote?t=...`. If payment is later, accepting sets `confirmed`.
7. `onBookingWrite` sees the first transition to confirmed and queues the PDF confirmation, if an email is present and one has not already been sent.
8. If the job has `uid`, it is already on their account from step 1. If it does not, Link Bookings or a later edit that matches the email can add `uid`.

That is the whole knot: one `bookings` document, staff writes for the office fields, functions for quotes, terms and email, and `uid` for the customer account.
