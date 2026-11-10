# Airport booking measurement: review and rollout

Draft implementation, 10 November 2026. Not deployed.

## Verified configuration

Google Ads account 7328566496, Campaign #1 24449313037, £4 daily budget. GA4 property 497204134, Main Site stream 15721253113, G-RSE4NNBP64. GA4 key events generate_lead and booking_confirmed have been created without arbitrary monetary values. Google Ads conversion import and live conversion tests are still outstanding.

## Implementation

- Shared, production-only bootstrap on existing tagged website pages and Portal, including page generators. The two copies are tested byte-identical.
- Equal Allow measurement and Reject measurement controls; no Google tag or attribution storage until consent. Choices persist across the website and customer subdomain. Preferences allow withdrawal. Booking remains available without consent. Google signals and ad personalisation are disabled.
- Successful guest requests and signed-in Portal requests emit generate_lead only after the server saves the record. Duplicate guest submissions, failures and honeypots do not trigger another lead. SessionStorage suppresses repeat client success events. No booking reference is transmitted to GA4.
- Telephone and WhatsApp clicks are separate engagement events, not confirmed enquiries or bookings.
- Attribution is server-allowlisted: consent, time bounds, client/session IDs, gclid/gbraid/wbraid only. No customer names, contact details, addresses, notes or flight data. Portal URLs/titles are generic and token parameters are excluded. Click identifiers expire in 30 days; consent choice in 180 days.
- A separate Firestore trigger queues one confirmation per server-created online booking, following the existing confirmed/allocated/completed workflow, including its legacy paid mapping. Stable outbox document IDs and transactions prevent duplicate queue creation. Cancellations, deletions and recorded consent revocations are checked before delivery.
- Scheduled GA4 delivery is OFF by default. It requires Secret Manager SPIRES_GA4_API_SECRET and marketingConfig/ga4.enabled=true. No secrets are committed. No invented revenue is attached. The old session ID is only included within 24 hours of session start; later confirmations may not attribute to the original session.
- The queue retains click attribution for a future Ads offline conversion import, but this PR does NOT upload click conversions to Google Ads.

## Required gates before production

1. Confirm Vercel production roots are spires-website and customer-app within hashi0000/spires. Owner must approve merge and deployment.
2. Review GA4 Enhanced Measurement automatic form/history settings and test claim/quote URLs in Tag Assistant. Query tokens and customer data must not leak via automatic events.
3. Test consent allow/reject/withdrawal, mobile layout, guest and signed-in request success/failure in staging. No live passenger details in test data. Verify one lead only on server success.
4. Deploy Functions only with an owner-created Measurement Protocol secret in Secret Manager. Do not put the secret in public frontend variables or chat. Keep delivery disabled.
5. Validate exact payloads with Google's debug endpoint. A 2xx collection response does NOT prove that GA4 accepted or reported an event.
6. Verify a consented test confirmation, repeat updates, cancellations, missing identifiers and queue errors. Confirm measurement never blocks booking/email work.
7. Enable sender only after explicit approval. Ambiguous delivery is review_required and never blindly retried. A crash can leave sending records: inspect manually. Custom event_id is not an exactly-once GA4 guarantee.
8. Check GA4/Google Ads link and import validated conversions initially as secondary. Avoid counting enquiry and confirmed booking as equivalent primary wins. Keep the current bidding strategy until the feed is verified.
9. Check actual month-to-date cost and the Google Ads budget report. £4 daily is not a hard account-wide £135 cap following earlier mid-month budget changes.

## Limits and operational notes

Browser withdrawal clears browser attribution and stops subsequent browser events. It does not automatically revoke consent stored against historical bookings. Staff must mark booking.marketingAttribution.consent=denied when a customer withdraws previously granted booking measurement consent. Delivery checks that field. A self-service historical revocation endpoint is not included.

The GA sender needs a usable GA client ID. Click-only attribution entries are skipped by it. Ad blockers, rejected consent, closed tabs and the 600 ms attribution timeout reduce observable conversions. The booking database remains authoritative. Historical bookings cannot be retroactively attributed. Later confirmed bookings may require Google Ads offline imports with order IDs for reliable ad attribution.

Sender: at most 20 records per 15 minutes, disabled until configured. HTTP failures and ambiguous sends require review. Do not infer ROAS or profit from event counts; reconcile actual fares, cancellations and operating costs.

## Checks

- node --test tests/measurement.test.cjs
- npm --prefix functions run build
- node --test functions/lib/marketing/*.test.js functions/lib/bookings/*.test.js functions/lib/terms/*.test.js
- npm --prefix customer-app run build
- npm --prefix spires-website run build

Deployment and live validation remain pending. Consult the PR for which checks completed successfully in this environment.
