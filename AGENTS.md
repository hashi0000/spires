# Agent instructions — Spires Taxis

Documentation map: [`docs/README.md`](docs/README.md).

## Customer-facing policy

Before changing **customer-facing wording**, **pricing**, **booking behaviour**, **payments**, or **customer documents** (emails, PDFs, terms, forms, portal or admin copy that customers see or are charged by):

1. Read the relevant entries in [`docs/policies/README.md`](docs/policies/README.md) (the policy register).
2. Prefer **shared policy configuration** where it exists (`service-policy.json`, waiting/terms/Cotswolds/Share modules listed in the register). Do not hard-code a new number in one page while leaving the shared source unchanged.
3. For an **approved** policy change: update the register **and** the affected customer surfaces in the same change set. Add a change-history row with effective date and how existing bookings are treated.
4. If **implementation and the register disagree**, surface the mismatch and stop before inventing or “correcting” the rule. Entries marked **Needs Hashim’s approval** require an explicit decision.
5. **Preserve** the policy version already agreed for existing bookings (`waitingPolicyVersion`, `termsVersion`, `acceptedServiceTerms`, Cotswolds timed-hire snapshots, Share `termsVersion`). Do not rewrite historic terms HTML that those bookings still reference.
6. Keep internal policy notes under `docs/` (including `docs/policies/`). That tree is **not** part of the `spires-website/` publish root.
7. This GitHub repo is **public**. Keep approved customer-facing rules here. Store private operating procedures outside the repo ([`docs/ops/README.md`](docs/ops/README.md)). Do not commit driver codes, payment credentials, or real customer data.
8. Before releasing site-wide changes, follow [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md). Run `npm run policy:check` in `spires-website/` (also runs on `npm run build` there).

Confirmed example already in the register: flight-monitored airport pickups include **50 minutes** of waiting from actual landing (current version). Fixed-time and overage charges are separate entries — do not merge them into the flight allowance.

## Cross-system consistency (required)

Website, customer portal, backend, emails and PDFs must stay aligned. Treat the policy register as the record of approved decisions.

### Shared values

For numbers used in more than one place (fares, waiting allowances, vehicle classes, Cotswolds hire durations and overtime):

1. Edit the **source of truth** (`service-policy.json`, waiting/terms/Cotswolds modules, airport fare tables — see the register).
2. Sync published copies with `node tools/sync-service-policy.cjs` (and `tools/sync-document-renderer.cjs` when document modules change).
3. Do not hand-edit app copies of `servicePolicy.json` or `customerFacingLabels.json`.
4. Validation must fail if published copies drift: `npm run policy:check` in `spires-website/` runs `tools/check-customer-consistency.cjs` (waiting scan + shared-policy/labels/payment drift).

### Customer-facing labels

Definitions live in `customer-facing-labels.json` (synced to apps and `spires-website/js/customer-facing-labels.js`). Use these labels with the same meaning on the website, portal, emails and PDFs:

| Label | Meaning |
| --- | --- |
| **Request a quote** | Customer asks for a price or availability. No booking is confirmed and no payment is taken by sending the request. |
| **Request received** | Office has the enquiry or booking request. Not yet a confirmed journey. |
| **Confirmed** | Journey accepted under the agreed fare and terms for that booking. |
| **Deposit paid** | Required deposit recorded as received; counts toward the fare once only. |
| **Balance due** | Amount still owed after effective payments received (paid deposit counted once). |

Example release check: £235 fare with £35 deposit paid → **£35 received** and **£200 balance due** in portal, confirmation and payment request, all from the same payment record (`paymentAmount` / `bookingMoney`).

### Design

Reuse existing navy (`#002147`) and gold (`#b8956a`) styling, spacing, button styles and form feedback on customer-facing screens. Do not invent a second palette for portal, website or documents.

### Touchpoints before release

For each site-wide change, list and verify the affected customer touchpoints before release (see [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)):

- Public website (EN + translated pages)
- Guest quote / contact form
- Customer portal
- Confirmation and payment-request emails
- PDFs (confirmation, payment request, receipt)
- Admin / office tools only where customers see the result

**Airport waiting release check:** current flight-monitored pickups include **50 minutes** from actual landing — same figure on route pages, pickup guide, translated pages, booking forms and confirmations. Preserve stamped booking terms. Flag unresolved overage or fixed-time rules (**Needs Hashim’s approval**).

**Payments release check:** £235 fare + £35 deposit paid → £35 received / £200 due everywhere that balance is shown, from one payment record.

## Scope note

This file does not replace product/feature briefs. For UI copy style (for example no hyphenated compounds in customer-facing language), also follow project Cursor rules under `.cursor/rules/`.
