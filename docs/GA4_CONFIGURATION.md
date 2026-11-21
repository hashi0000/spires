# GA4 configuration for Spires Taxis

Property: `497204134` · Measurement ID: `G-RSE4NNBP64` · Google Ads: `7328566496`

Code can send events and parameters. The steps below need GA4 / Ads administrator access in Google’s UI.

## Key events

Mark these as key events (conversions), prioritising confirmed bookings:

1. `booking_confirmed` — primary business outcome (online website/portal confirmations only)
2. `purchase` — real payment received (not confirmation alone)
3. `generate_lead` — successful enquiry / quote / booking request

Keep `phone_click`, `whatsapp_click` and `email_click` as engagement, not primary conversions.

## Custom dimensions (event-scoped)

Register these event parameters so reports can break down vehicle and route demand:

| Parameter | Suggested dimension name | Notes |
| --- | --- | --- |
| `vehicle_type` | Vehicle type | `standard`, `8_seater`, `executive` |
| `route_category` | Route category | e.g. `heathrow`, `gatwick`, `stansted`, `luton`, `cotswolds`, `other` |
| `lead_type` | Lead type | `quote`, `contact`, `booking_request` |
| `journey_type` | Journey type | `one_way`, `return`, `cotswolds` |
| `booking_source` | Booking source | `verified_ads`, `likely_ads`, `other` |
| `landing_page` | Landing page | Path only, e.g. `/heathrow-to-oxford-8-seater` |
| `campaign_source` | Campaign source | From stored UTM when present |
| `campaign_medium` | Campaign medium | From stored UTM when present |
| `campaign_name` | Campaign name | From stored UTM when present |
| `lead_channel` | Lead channel | `website` or `portal` |

## Google Ads linking

1. Link GA4 property `497204134` to Google Ads account `7328566496`.
2. Confirm auto-tagging is on.
3. Import `booking_confirmed` as a secondary conversion unless Hashim approves a bidding change.
4. Do not change budgets, bidding or primary goals from this document.

## Useful explorations

- Acquisition → traffic acquisition, filtered by `booking_confirmed` / `generate_lead`
- Landing page + `vehicle_type` = `8_seater`
- Country + `route_category` = `heathrow`
- Funnel: session → `generate_lead` → `booking_confirmed` → `purchase`
- Comparison of `booking_source` verified vs likely vs other

## Eight-seater analysis

Use:

- Landing page contains `heathrow-to-oxford-8-seater`, **and/or**
- `vehicle_type` = `8_seater` on `generate_lead` / `booking_confirmed`

A visit to an eight-seater page alone is not a vehicle selection. Prefer the `vehicle_type` parameter on successful submissions and confirmations.

## Why CPC attribution can look low

- Sessions and leads only fire after measurement consent.
- `booking_confirmed` and `purchase` are server Measurement Protocol events for online bookings with stored consented `client_id`.
- Admin / phone / WhatsApp bookings are not sent as GA4 confirmations.
- Google only joins MP events to an Ads session within 24 hours of `session_id` capture. Later office confirmations keep `client_id` but may not show as Google CPC in session reports.
- Campaign UTMs and `booking_source` are sent as parameters for reporting when available; click ids stay on the booking record and are not copied into GA4 payloads.
