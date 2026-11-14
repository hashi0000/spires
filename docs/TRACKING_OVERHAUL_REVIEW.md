# Tracking and attribution review — 13 November 2026

This change is prepared for review. It is not a claim that the production journey or Google Ads receipt has been verified.

## Findings

- Production website release inspected: main commit `98438a807095c140419575e5ffc2ef8a5b6c1eb9`. Website and portal use the shared measurement script and GA4 stream `G-RSE4NNBP64`.
- Firebase project `spires-taxis` uses a Standard edition default database. The live GA4 delivery configuration has `enabled: true`.
- Google Ads and Analytics configuration and connected reports were inspected. Account-specific settings and financial results are retained only in the private audit. Event counts do not establish distinct bookings, delivery correctness or Ads attribution. No Google settings were changed.
- Signup did not persist acquisition evidence or emit a dedicated signup event. Portal creation had a UI lock but no server idempotency key. Custom-event collection errors could be automatically replayed despite uncertain receipt. Browser withdrawal did not revoke consent already saved on bookings. The admin source label ignored recorded non-Ads campaigns. Server Ads spend was a placeholder and the admin discarded any potential returned total.

Customer-specific findings belong only in the private audit report, not in this public repository.

## Proposed behavior

- Measurement remains opt-in. Shared parent-domain cookies preserve consented first/latest touches across subdomains. Signup is a separate event, without a user ID in its Analytics parameters. Server-owned acquisition records retain the actual Auth creation time, observed time, consent choice time, capture time and browser-capture provenance.
- A random revocation receipt stays out of GA4. Withdrawal is retried from an essential preference cookie while offline; renewed measurement is held until the previous receipt is synced. A signed-in account can also revoke its older saved bookings. The sender checks withdrawal immediately before collection. Completed Google deliveries cannot be recalled by this mechanism.
- New online booking and acquisition writes check revocation inside the transaction. Guest requests retain existing idempotency, and portal requests add user-scoped idempotency plus payload mismatch protection. Booking creation and its terms audit are atomic. Existing clients without a submission ID remain supported.
- One confirmation outbox row remains associated with one booking. Payment rows retain their separate payment-entry identity and value. Collection errors and ambiguous delivery require review rather than automatic replay. HTTP acceptance is not labelled proof of GA4 reporting or Ads attribution.
- Confirmation time uses the persisted confirmation time or document write time, not delayed trigger execution time. Payment events use their document write time. Delivery-time session age is checked without moving event timestamps earlier.
- Recorded non-Ads source evidence appears distinctly from customer/staff reports and unknown sources. Staff source edits retain actor, timestamp, previous value and provenance in a server-written history. They do not rewrite original browser attribution or enquiry/journey times.
- The admin can read fresh, complete daily Google Ads snapshots from a server-only collection. Currency/account/timezone, freshness and day coverage are validated. Missing days remain unknown. Manual spend is never added to an overlapping imported Ads total. Costs, received payments, quoted fares and contribution remain distinct; missing costs or payments prevent a profit claim.

## Release gates and remaining work

1. Deploy Firebase backend changes before releasing the portal and public measurement script. Keep existing GA4 configuration fields and sender flag. Deploy only the named affected functions; do not deploy the entire codebase or alter unrelated services.
2. Enable Firestore TTL on `expiresAt` for measurementWithdrawals (45 days), measurementWithdrawalRate (1 day), and customerAcquisitions (attribution expiry). Update only TTL configuration; do not delete or replace existing indexes. Default-deny rules already cover these server-only collections and bookingSourceAudit/marketingAdsDaily.
3. Automatic reporting uses a dedicated keyless Google Ads Read-only identity, impersonated by the Firebase runtime. The scheduler refreshes the previous 90 finished London days every six hours. Successful account-level reports establish explicit zero rows; malformed or failed requests keep existing snapshots. It verifies account 7328566496, GBP and Europe/London. Enable only after Cloud API production approval, Ads Read-only access and the scoped runtime impersonation grant. The admin can request a refresh; stale or missing days remain unknown. Today is intentionally incomplete; choose a finished-day range for a complete spend comparison. The connected chat reporting token is not application configuration.
4. Verify the published website/portal scripts and signed-in admin after release. Test signup, guest request, account booking retry, manual source edit, confirmation, payment, receipt/account withdrawal and a no-consent journey. Use clearly labelled test records, suppress customer/driver communications and do not replay historical conversions.
5. Verify one eligible genuine confirmation reaches the correct GA4 report and check Ads attribution after processing. An unconfirmed request is not a confirmed booking. Do not create fake ad-click IDs, import historical guesses or alter conversion goals, budgets, bidding, targeting or auto-tagging.
6. Anonymous legacy bookings without a revocation receipt cannot be located from cookie withdrawal alone. Account withdrawal covers signed-in legacy bookings; otherwise staff must handle a customer's identified saved booking. Offline withdrawal cannot reach the server until connectivity returns, and already transmitted data requires the relevant deletion process if requested.

Public fares, waiting policy, Google Ads settings/budgets and SPIRES_INTERNATIONAL_ENABLED are outside the patch. No customer record is edited merely to improve attribution reports.

## Validation

Browser VM tests exercise consent gating, cross-subdomain capture, click/lead/signup deduplication, offline withdrawal and sanitization. Server tests cover attribution, timestamps, idempotency, transport outcomes, withdrawal and spend completeness. A local transaction-backed simulation covers the callable journey. Signup UI and admin reporting regression tests are included. A disposable real Firebase emulator test is supplied separately; record its actual result in the private audit. Local production builds use existing dependencies with caches redirected into the review copy.

The real Auth/Firestore integration test passed on 14 November 2026 using the disposable demo project, with Google collection stubbed. On this Windows host, Java required TCP fallback because Unix-domain socket connection failed: setting `jdk.net.unixdomain.tmpdir` to a nonexistent directory let Java fall back to loopback TCP. This setting applies only to the local test process. No production booking or customer notification is created by that test. The test exercises account retries, guest persistence, payment/confirmation outbox deduplication, source audit, withdrawal and spend coverage. Actual GA4 receipt and Ads attribution remain separate production verification steps.

Google's session attribution timing requirements: https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases
ICO cookie guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/

