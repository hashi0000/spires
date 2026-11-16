# Agreed service update — 15 November 2026

Work in C:/workspace/spires-site-clean. The Desktop source is read only to this session. Preserve inherited uncommitted work. User authorises implementation, verification, commit, push and deployment of this scope. Do not deploy unfinished work or claim checks not run. GitHub connectivity failed (`getaddrinfo() thread failed to start`) on 15 November.

## Approved policy

- Airport flight monitored collection: 60 minutes from verified actual touchdown, then GBP 5 per started 15 minutes.
- Airport fixed clock time: no flight monitoring or automatic rescheduling; 15 minutes from booked time, then same charge. Earlier collection subject to availability. Hotel collection defaults to this arrangement.
- Airport waiting stops at the time the passenger calls/messages that the whole group and luggage are ready at the agreed collection point. Do not use the time the driver later records the call. No charges for our own delay. Keep old accepted bookings on their original policy.
- Driver confirms actual landing time (not button click time), source and correction reason. Offer a WhatsApp deep link with verified landing and allowance deadline, charges and ready instructions. Label Open WhatsApp, never claim sent/delivered.
- Cotswolds total hire includes customer collection, all driving/stops and final drop off. Customer lateness uses hire time; driver lateness shifts the finish. Driver travel to collect and after final drop off excluded.
- Cotswolds prices: Standard 4/6/8 hours GBP 180/260/340; Executive 240/350/460; 8 Seater 220/320/420. User accepted these prices.
- Cotswolds additional time: GBP 10 per started 20 minutes for ALL categories; supersedes all earlier 15 minute suggestions.
- Normal traffic allowed for in quote. Proposed exceptional disruption exclusion: unexpected accident, unplanned road closure, emergency diversion or severe weather; record excluded minutes, preserve separately chargeable passenger delays. Do not imply all overtime waived if one incident occurs.
- Quote realistic duration/itinerary before acceptance; four hours includes travel and is not four hours sightseeing. Extensions and route changes subject to availability; no guided commentary.

## Scope

1. Journey type Cotswolds trip/private tour across website, portal, admin; stops, duration, final destination, assistance, luggage, price/terms acceptance.
2. Executive service under Services, one explanation page; categories on existing Heathrow pages (no Executive destination in Airports menu); Executive also Cotswolds. Mercedes E Class or equivalent, partner may provide. No invented amenities. Preserve Heathrow fares Oxford 150/290, Abingdon 165/320, Didcot/Bicester/Witney 170/330.
3. Individual random unique four digit driver codes, persistent sessions, reset/revoke from office. Backend must limit each driver to their assigned leg/trips, not just frontend filtering. Prevent guessing; private code/session records; no code logging.
4. Driver Hub: leg completion/timings, final time entry, calculate extras, show fare + extras - all previous payments = balance. Confirm extras before persisting; idempotent transaction. Record payment separately and issue appropriate receipt. No Stripe.
5. No generic customer update email for internal/historical completion; payment receipts stay separate.
6. Tomorrow button red; customer name area in admin opens booking directly; screen sizing at normal zoom.
7. All generated PDF/email attachments match manual admin branding, use A4, no clipped text, repeated table headings/clean page breaks. Cover booking confirmations, receipts, general/school invoices and payment requests.
8. Terms, FAQs, rates, guides, forms, confirmations, portal, admin and Driver Hub must consistently reflect policy; store policy snapshots and acceptance; preserve old agreements.

## Verification needed before release

Boundary/timezone tests, old booking compatibility, correct leg permissions, revoked sessions, concurrent edits/retries, charge/payment distinction, final totals in portal/PDF/receipt, local browser mobile/desktop, actual A4 outputs. Deploy named affected functions only, compatible rules/client order, no full functions deploy (unrelated Stripe exports still exist). No real customer test messages/bookings/payments.
