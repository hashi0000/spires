# Release checklist (short)

Use before a site-wide change. Policy rules: [`policies/README.md`](policies/README.md). Labels and design: root `customer-facing-labels.json`. Agent rules: [`../AGENTS.md`](../AGENTS.md).

Run `npm run policy:check` from `spires-website/` (also part of `npm run build` there). That runs waiting-policy scan **and** shared-config drift (service policy copies, labels, £235/£35→£200 payment example).

After editing shared numbers or labels: `node tools/sync-service-policy.cjs` (and document sync if needed) before the check.

## 1. List touchpoints

For **every** site-wide change, write which customer surfaces are affected, then verify each before release:

- [ ] Public website (`spires-website/`, including translated pages)
- [ ] Guest form (`contact.html` + `js/guest-booking.js`)
- [ ] Customer portal (`customer-app/`)
- [ ] Admin / office tools (only if customers see the result: quotes, PDFs, WhatsApp previews)
- [ ] Confirmation emails
- [ ] Payment-request emails
- [ ] PDFs (booking confirmation, payment request, receipt)

If the change is policy, pricing or status language, also update [`policies/README.md`](policies/README.md) when the decision is approved. Keep labels aligned with `customer-facing-labels.json`.

## 2. Staging

- [ ] Deploy or run the affected apps on staging / local preview
- [ ] Check each ticked surface above on staging
- [ ] Labels match glossary meanings: Request a quote, Request received, Confirmed, Deposit paid, Balance due
- [ ] Navy / gold styling, spacing, buttons and form feedback match existing customer-facing patterns (no new palette)
- [ ] Guest form: airport collection shows the **current** flight-monitored allowance from shared policy (50 minutes)
- [ ] Portal and website / document balances match for the same booking figures

## 3. Release example A — Airport waiting

Current flight-monitored pickups include **50 minutes** from **actual landing**.

Verify the same allowance on:

- [ ] EN route / airport pages
- [ ] Pickup guide (`how-airport-pickup-works` and guides)
- [ ] Translated pages touched by this release
- [ ] Booking / guest forms
- [ ] Confirmations (email + PDF) for **current-version** bookings

Also:

- [ ] Preserve previously agreed booking terms (`waitingPolicyVersion` / terms stamps)
- [ ] Flag any unresolved **overage** or **fixed-time** wording (do not invent a fix — Needs Hashim’s approval)

## 4. Release example B — Payments (£235 / £35 / £200)

Create or use a test booking with one payment record:

| Field | Value |
| --- | --- |
| Agreed fare | **£235** |
| Amount received (paid deposit) | **£35** |
| Expected balance due | **£200** |

All three must read from the **same** payment maths (`effectiveReceivedPence` / outstanding):

- [ ] Customer portal booking / payment summary — £35 received, £200 balance due
- [ ] Confirmation or payment-request email — same figures
- [ ] PDF confirmation / payment request / receipt — same figures
- [ ] Pickup / waiting instructions still match the booking’s stamped waiting policy version

Do not use a real customer address or live card for this check.

## 5. Deployed verification

- [ ] Confirm production (or the intended live host) for each ticked surface
- [ ] Re-check the £235 / £35 / £200 sample on the deployed portal and documents if payment code changed
- [ ] Re-run `npm run policy:check` in `spires-website/` against the released tree
- [ ] Spot-check one translated airport page if website copy changed

## 6. Do not

- Rewrite historic terms pages (`terms/2026-11-15`, older) that existing bookings still reference
- Treat unresolved overage (£5/15 vs £10/30) or fixed-time wording as settled unless Hashim has approved
- Hand-edit synced `servicePolicy.json` / `customerFacingLabels.json` copies instead of the root sources
- Commit private operating procedures into this **public** repository (see [`ops/README.md`](ops/README.md))
