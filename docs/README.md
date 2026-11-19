# Documentation index

Internal documentation for the Spires Taxis monorepo.  
**Not published** by the marketing site (`spires-website/`).

## Start here

| Need | Document |
| --- | --- |
| Monorepo overview | [../readme.md](../readme.md) |
| Coding agents / policy workflow | [../AGENTS.md](../AGENTS.md) |
| **Customer-facing policy register** | [policies/README.md](policies/README.md) |
| **Release checklist** | [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) |
| ChatGPT review brief (19 Nov 2026) | [CHAT_GPT_RELEASE_REVIEW-2026-11-19.md](CHAT_GPT_RELEASE_REVIEW-2026-11-19.md) |
| Phase 0 audit ledger (follow-up) | [PHASE0_AUDIT_LEDGER-2026-11-19-followup.md](PHASE0_AUDIT_LEDGER-2026-11-19-followup.md) |
| Phases 1–6 follow-up evidence | [PHASE1_6_FOLLOWUP_EVIDENCE-2026-11-19.md](PHASE1_6_FOLLOWUP_EVIDENCE-2026-11-19.md) |
| Private ops (outside this public repo) | [ops/README.md](ops/README.md) |
| Customer app deploy | [../customer-app/DEPLOYMENT_GUIDE.md](../customer-app/DEPLOYMENT_GUIDE.md) |
| Admin app | [../spires-admin-fresh/README.md](../spires-admin-fresh/README.md) |
| IndexNow after website deploy | [../spires-website/INDEXNOW.md](../spires-website/INDEXNOW.md) |

## Policies and ops checklists

| Document | Role |
| --- | --- |
| [policies/README.md](policies/README.md) | Approved rules, conflicts, change history |
| [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) | Surfaces, staging, £235/£35/£200 sample, deploy verify |
| [offers-and-messages.md](offers-and-messages.md) | Pre-release email/offer checks (not a policy source of truth) |
| Customer consistency check | `npm run policy:check` in `spires-website/` (waiting + shared policy/labels drift + £235/£35→£200) |
| Label glossary | Root [`customer-facing-labels.json`](../customer-facing-labels.json) |
| [executive-heathrow-launch-post.md](executive-heathrow-launch-post.md) | Draft social copy; do not treat as live ad copy |

## Setup, deployment, troubleshooting

| Document | Role |
| --- | --- |
| [../customer-app/DEPLOYMENT_GUIDE.md](../customer-app/DEPLOYMENT_GUIDE.md) | Customer portal on Vercel + Firebase domains/rules |
| [../customer-app/ENV_VARIABLES.md](../customer-app/ENV_VARIABLES.md) | Optional env vars *(proposed for merge/removal — see [archive/README.md](archive/README.md))* |
| [../spires-website/INDEXNOW.md](../spires-website/INDEXNOW.md) | Bing IndexNow post-deploy |
| [admin/BOOKINGS_SYSTEM.md](admin/BOOKINGS_SYSTEM.md) | How admin / website / portal bookings are wired |
| [../firebase.json](../firebase.json) | Functions + emulator + admin hosting |

## Product areas

### Admin and bookings

- [admin/BOOKINGS_SYSTEM.md](admin/BOOKINGS_SYSTEM.md) — live admin booking architecture
- Historical cleanup notes: [archive/ADMIN_OVERHAUL_NOTES.md](archive/ADMIN_OVERHAUL_NOTES.md)

### Spires Share

- [share/SPEC.md](share/SPEC.md) — development specification (proposed defaults)
- [share/PRELAUNCH_CHECKLIST.md](share/PRELAUNCH_CHECKLIST.md) — launch blockers
- [share/ADMIN_AUDIT.md](share/ADMIN_AUDIT.md) — admin UI brief
- Live customer Share terms (website, not this folder): `/share-terms` → `spires-website/share-terms.html`
- Policy register Share entry: [policies/README.md](policies/README.md) §8

### SEO and UX (website)

- [seo/SEO_AUDIT.md](seo/SEO_AUDIT.md)
- [seo/KEYWORD_TO_URL_MAP.md](seo/KEYWORD_TO_URL_MAP.md)
- [seo/SEO_IMPLEMENTATION_PLAN.md](seo/SEO_IMPLEMENTATION_PLAN.md)
- [../spires-website/DESTINATION-SEO-AUDIT.md](../spires-website/DESTINATION-SEO-AUDIT.md)
- [../spires-website/VISUAL-UX-AUDIT.md](../spires-website/VISUAL-UX-AUDIT.md)

### Measurement and advertising

- [AIRPORT_BOOKING_MEASUREMENT.md](AIRPORT_BOOKING_MEASUREMENT.md)
- [TRACKING_OVERHAUL_REVIEW.md](TRACKING_OVERHAUL_REVIEW.md)
- [ADVERTISING_RESULTS_COMPARISON.md](ADVERTISING_RESULTS_COMPARISON.md)

### Other

- [../spires-international/images/SOURCES.md](../spires-international/images/SOURCES.md) — image licensing needs for International preview

## Archive

Superseded notes kept for history (older booking/policy context, past audits): [archive/README.md](archive/README.md).

Old root paths that moved leave short stub files so existing links still resolve.
