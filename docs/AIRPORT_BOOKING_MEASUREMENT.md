# Airport booking measurement

Updated 11 November 2026.

Cloud Functions, Firestore rules and the admin hosting build are deployed to `spires-taxis`. The public website and portal scripts at `https://www.spires-taxis.com/js/measurement.js` and `https://customer.spires-taxis.com/measurement.js` were checked after release and contain the safe referrer and campaign capture. The scheduled sender remains off until `marketingConfig/ga4.enabled` is set. A debug validation of the booking and payment payloads returned no validation messages. That does not prove a GA4 report or a Google Ads conversion.

## Verified configuration

Google Ads account 7328566496 and conversion action 7897318445 were not opened in this pass. GA4 property 497204134, measurement ID G-RSE4NNBP64. The Measurement Protocol secret `SPIRES_GA4_API_SECRET` exists in Secret Manager. No secret is stored in the website or in this document.

## Implementation

- Shared measurement script on the website and portal. It loads only on the live hosts and only after Allow measurement.
- Referrer sent to GA4 is the site and a safe path. Query strings, emails and token-like path segments are removed.
- Consented first and latest campaign touches can store click ids, UTM text, a safe landing path and a referrer host. A later direct visit does not replace a stored click. Emails, phone numbers and our own hosts are rejected.
- `generate_lead` remains the lead event. `lead_type` is `quote` for a website request and `booking_request` for a portal request.
- Email, telephone and WhatsApp clicks stay on their existing event names. A repeated click on the same link within one second is sent once. `airport_route` is included when the page has a safe route id.
- One `booking_confirmed` queue row per online booking, and one `purchase` or `refund` row per recorded payment change. The Google value is the amount of that payment, in GBP, not the full fare again.
- Delivery validates with Google's debug endpoint before calling the collection endpoint. A collection response is transport only. Ambiguous requests are not retried. Events older than 72 hours are skipped. `session_id` is included only within 24 hours of the stored session start.
- Card payments recorded from Stripe add the verified amount once. A deposit stays part paid. Cash and bank payments recorded by staff are included in the admin payment totals. Nothing unpaid is labelled as received revenue.
- Advertising results keeps tracked click ids, customer reported source and unknown source separate.

## Still required before the sender is switched on

1. In Google, confirm property 497204134 is linked to Ads customer 7328566496, auto tagging is on, and Enhanced Measurement is not also counting form submits.
2. Import `booking_confirmed` as a secondary conversion. Do not change budgets, bidding or primary goals.
3. Set Firestore `marketingConfig/ga4` to `{ enabled: true, measurementId: "G-RSE4NNBP64" }` only after that check. Do not replay older than 72 hours.

## Checks

- `node --test tests/measurement.test.cjs`
- `node --test functions/lib/marketing/attribution.test.js functions/lib/marketing/payments.test.js`
- Admin advertising results unit tests
- Debug endpoint for `booking_confirmed` and `purchase`: HTTP 200, no validation messages. Live collection was not called.

## Limits

Browser withdrawal clears the browser cookie and stops later browser events. It does not revoke consent already stored on a booking. Staff set `marketingAttribution.consent` to denied when a customer withdraws consent for a saved booking.

The sender needs a GA client id. Ad blockers, rejected consent, a closed tab and the 600 ms client id wait reduce how many conversions can be seen. Historical bookings cannot be attributed afterwards. A confirmation more than 24 hours after the session is sent without `session_id`, so it may not join the original session. The sender handles at most 20 records every 15 minutes. Do not infer profit from event counts.
