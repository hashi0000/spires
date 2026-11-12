# Advertising results comparison

Record of the recent admin comparison work. Nothing in this note was deployed. Booking records were not changed.

## Where it lives

The comparison uses the existing admin app. It does not replace the home dashboard.

- Report engine: `spires-admin-fresh/src/utils/advertisingResults.ts` (`buildAdvertisingReport`)
- Advertising results screen: `spires-admin-fresh/src/components/AdvertisingResults.tsx`
- Dashboard sections, admin only: `spires-admin-fresh/src/components/Dashboard.tsx`
- Bookings come from the existing Firebase `bookings` listener in `useBookings`
- Google Ads spend check: `functions/src/marketing/advertisingSpend.ts` (`readAdvertisingSpend`)

Marketing performance and Before and after advertising are extra sections under the existing dashboard. A non admin does not see them.

The existing dashboard still has the pending review alert, upcoming jobs for the next 7 days, desktop reminders, the four counts, UK average fuel prices, and Oxford City Council compliance.

## What was inspected

Read only check on 12 November 2026, about 10:47 UTC. No booking was written.

- 253 documents in `bookings`. 3 synthetic test records are left out. 250 real bookings remain.
- All 250 real bookings have a creation time and a journey time.
- 244 have a quoted fare. 4 have a recorded payment.
- Statuses: 211 completed, 29 confirmed, 5 allocated, 2 stored as paid, 2 cancelled, 1 pending.
- 4 real bookings have a marketing attribution record. 3 record consent as granted. None of the 250 has a Google click id stored.
- 130 real bookings were saved after the journey. The creation time is the time the record was saved. It is not reliable as the customer enquiry time, and it is not the journey date.
- No Google Ads campaign collection is stored. No `marketingSpend` collection is stored. The advertising settings document is not stored, so no Google Ads start date is recorded.
- `marketingConfig` has one document and its only field is `enabled`.
- `marketingConversions` has 4 delivery records. Those are conversion deliveries, not a campaign or spend report.
- `readAdvertisingSpend` does not call Google Ads. It reports that credentials are not configured and that no budget was changed.

A second read only comparison at about 10:46 UTC ran the report engine on those bookings and did not change a creation time, a journey time, a payment, or a status.

## What the comparison does

The objective shown on the page is to see whether introducing Google Ads increased the number of bookings and the revenue recorded for Spires Taxis. That question cannot be answered yet, because no Google Ads start date is recorded. Before and after advertising stays **Not calculated**. A stored Google click, the dates selected on the page, and a campaign creation date are not used as the start date.

The current London day is left out. On 12 November 2026 the finished days 1 to 11 November, against the 11 days immediately before, were:

- Confirmed bookings a day: 20 then 14. Decrease 30 percent.
- Daily bookings, including bookings that are not confirmed: 20 then 15. Decrease 25 percent.
- Revenue per day: not calculated. Missing payments stay unknown.
- Average booking value: not calculated. Missing fares stay unknown.
- Confirmed booking rate: the same in both periods. Increase 0 percent.
- The 14 confirmed bookings on those finished days all have unknown attribution.

The last 7 finished days, 5 to 11 November, were a decrease of 50 percent in confirmed bookings a day and a decrease of 42.9 percent in daily bookings. Revenue per day and average booking value were not calculated.

These figures are a point in time reading. They are not a before and after advertising result.

## Rules kept in the page

- Figures use the existing Firebase booking records. Opening the page does not change a booking, a recorded price, a recorded payment, or stored attribution.
- A historical booking is not modified merely to produce a comparison.
- Enquiry date uses the stored creation time. A journey date is not substituted for a booking creation date. A creation time is not used in place of a missing journey date.
- Where a record was saved after the journey, the page says so and does not treat that time as the customer enquiry time.
- A missing payment, fare, source, journey cost, creation time, or journey date stays missing and is not turned into zero. The limitation is listed.
- A cancellation stays in total bookings and daily bookings. It is left out of confirmed bookings, revenue, average booking value, and the confirmed booking rate denominator.
- Only a booking with a consented Google click id that has not expired is directly attributed to Google Ads. A customer who said Google Ads is another source. No recorded source stays unknown.
- The page does not claim that all additional bookings were caused by Google Ads.
- Seasonality, repeat customers, referrals, and other marketing activities may affect the results.
- Google Ads reporting is described as not available. No campaign report is read and no budget is changed.

## Tests

The latest full run was 43 tests, all passed:

- `spires-admin-fresh/src/utils/advertisingResults.test.ts`
- `spires-admin-fresh/src/components/AdvertisingResults.test.tsx`
- `spires-admin-fresh/src/components/Dashboard.test.tsx`

The tests cover a missing payment, a missing fare, a cancellation, a zero earlier baseline, an unfinished current day, a missing creation time, a journey date left unused, a record saved after the journey, and a comparison that leaves the booking unchanged. They also check that the existing dashboard features remain, and that marketing sections stay hidden for a non admin.

The signed in admin page was not opened in the browser. Live figures need an admin sign in. The unsigned preview bypass was not put back.

## Not done

- Nothing was deployed: website, customer portal, Firebase functions, Firestore rules, or admin hosting.
- No Google Ads start date was invented or saved.
- No booking, price, payment, or attribution was rewritten.
- No advertising budget, bid, targeting, or conversion goal was changed.
