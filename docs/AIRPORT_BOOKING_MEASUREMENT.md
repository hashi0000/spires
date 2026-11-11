# Airport booking measurement

Updated 11 November 2026.

Cloud Functions, Firestore rules and the admin hosting build are deployed to `spires-taxis`. The public website and portal scripts at `https://www.spires-taxis.com/js/measurement.js` and `https://customer.spires-taxis.com/measurement.js` were checked after release and contain the safe referrer and campaign capture. Firestore `marketingConfig/ga4` already has `enabled` set to true and no other stored fields. This pass did not change that document. A debug validation of the booking and payment payloads returned no validation messages. That does not prove a GA4 report or a Google Ads conversion. The GA4 Admin API and Data API both returned permission denied, so receipt and Ads attribution remain unverified.

## Verified configuration

Google Ads account 7328566496 and conversion action 7897318445 were not opened in this pass. GA4 property 497204134, measurement ID G-RSE4NNBP64. The Measurement Protocol secret `SPIRES_GA4_API_SECRET` exists in Secret Manager. No secret is stored in the website or in this document.

## Implementation

- Shared measurement script on the website and portal. It loads only on the live hosts and only after Allow measurement.
- Referrer sent to GA4 is the site and a safe path. Query strings, emails and token-like path segments are removed.
- Consented first and latest campaign touches can store click ids, UTM text, a safe landing path and a referrer host. A later direct visit does not replace a stored click. Emails, phone numbers and our own hosts are rejected.
- `generate_lead` remains the lead event. `lead_type` is `contact` for a contact enquiry, `quote` for a website quote, and `booking_request` for a portal booking request. It is sent only after the enquiry has been saved, and the event does not include the customer's details or message.
- Email, telephone and WhatsApp clicks stay on their existing event names. A repeated click on the same link within one second is sent once. `airport_route` is included when the page has a safe route id.
- One `booking_confirmed` queue row per online booking, and one `purchase` or `refund` row per recorded payment change. The Google value is the amount of that payment, in GBP, not the full fare again.
- Delivery validates with Google's debug endpoint before calling the collection endpoint. A collection response is transport only. Ambiguous requests are not retried. Events older than 72 hours are skipped. `session_id` is included only within 24 hours of the stored session start.
- Card payments recorded from Stripe add the verified amount once. A deposit stays part paid. Cash and bank payments recorded by staff are included in the admin payment totals. Nothing unpaid is labelled as received revenue.
- Advertising results keeps tracked click ids, customer reported source and unknown source separate.

## Still required

1. In Google, confirm property 497204134 is linked to Ads customer 7328566496, auto tagging is on, and Enhanced Measurement is not also counting form submits. Those screens were not opened, and the Admin API returned permission denied.
2. Import `booking_confirmed` as a secondary conversion. Do not change budgets, bidding or primary goals.
3. The sender flag is already true. Do not replace `marketingConfig/ga4`. After the Google checks, merge `measurementId` `G-RSE4NNBP64` onto the existing fields if it is still missing. There is no eligible pending row. Do not replay a skipped, test labelled, or already submitted row.

## Queue read on 11 November 2026

The read did not change customer bookings and did not print customer information. Three `booking_confirmed` rows exist. Eligible pending rows: none. Duplicate groups: none. Purchase and refund value: 0 pence. Two rows match a test label. One was skipped. One test labelled row and one genuine row already show collection HTTP 204 from the previous sender. The scheduled function is running and recent executions finish ok. No new event was created or replayed.

## Rollback

These steps have not been run.

To stop delivery only, merge `enabled: false` into `marketingConfig/ga4` and keep the other fields. To roll the code back, revert `c8b02fa`, `6c49d9d` and `c003ad8`, push `main` so Vercel releases the website and the portal, then run `firebase deploy --only functions,firestore:rules,hosting --project spires-taxis`. That Firebase project is `spires-taxis`. The last command releases functions, Firestore rules and the admin site. The website and portal come from the git push.

## Checks

- `node --test tests/measurement.test.cjs`
- `node --test functions/lib/marketing/attribution.test.js functions/lib/marketing/payments.test.js`
- Admin advertising results unit tests
- Debug endpoint for `booking_confirmed` and `purchase`: HTTP 200, no validation messages. Live collection was not called.

## Limits

Browser withdrawal clears the browser cookie and stops later browser events. It does not revoke consent already stored on a booking. Staff set `marketingAttribution.consent` to denied when a customer withdraws consent for a saved booking.

The sender needs a GA client id. Ad blockers, rejected consent, a closed tab and the 600 ms client id wait reduce how many conversions can be seen. Historical bookings cannot be attributed afterwards. A confirmation more than 24 hours after the session is sent without `session_id`, so it may not join the original session. The sender handles at most 20 records every 15 minutes. Do not infer profit from event counts.
