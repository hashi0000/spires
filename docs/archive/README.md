# Archived documentation

These files are **historical**. They explain older decisions, audits or booking rules.  
For current customer-facing policy, use [../policies/README.md](../policies/README.md).  
For the live documentation map, use [../README.md](../README.md).

| Archived file | Why archived | Current pointer |
| --- | --- | --- |
| [NOVEMBER_SERVICE_UPDATE-2026-11-15.md](NOVEMBER_SERVICE_UPDATE-2026-11-15.md) | Session brief for the 15 Nov 2026 service update. Still useful for **why** `2026-11-15` bookings used 60 minutes / Cotswolds prices. | [Policy register](../policies/README.md) (current flight allowance is **50** minutes on `2026-11-19`) |
| [SPIRES_SHARE_CODEBASE_AUDIT-2026-09-28.md](SPIRES_SHARE_CODEBASE_AUDIT-2026-09-28.md) | Early Share prototype audit; product moved on | [../share/SPEC.md](../share/SPEC.md), [../share/ADMIN_AUDIT.md](../share/ADMIN_AUDIT.md) |
| [SPIRES_SHARE_MVP_IMPLEMENTATION-2026-09-28.md](SPIRES_SHARE_MVP_IMPLEMENTATION-2026-09-28.md) | One implementation pass log | [../share/SPEC.md](../share/SPEC.md) |
| [SPIRES_SHARE_TERMS_DRAFT.md](SPIRES_SHARE_TERMS_DRAFT.md) | Unapproved draft terms | Published: `spires-website/share-terms.html`; register §8 |
| [ADMIN_OVERHAUL_NOTES.md](ADMIN_OVERHAUL_NOTES.md) | Local cleanup notes for one commit | [../admin/BOOKINGS_SYSTEM.md](../admin/BOOKINGS_SYSTEM.md) |
| [production-engineering-review-2026-11-14.md](production-engineering-review-2026-11-14.md) | Dated production review snapshot | Fix/deploy status may be stale; check code and Firebase |

## Proposed for removal (not deleted — needs Hashim’s approval)

| Path | Why it looks redundant |
| --- | --- |
| [`spires-admin-fresh-README-website-sketch.md`](spires-admin-fresh-README-website-sketch.md) (already archived) | Old static **website** tree sketch that lived under `spires-admin-fresh/README.md`. Admin README is now a short real stub. Delete this archive copy if no longer needed. |
| `customer-app/ENV_VARIABLES.md` | Overlaps [`../../customer-app/DEPLOYMENT_GUIDE.md`](../../customer-app/DEPLOYMENT_GUIDE.md) and embeds Firebase web config values. Optional env setup can live as a short section in the deployment guide. |
| Root stub `.md` files (`SEO_AUDIT.md`, `SPIRES_SHARE_SPEC.md`, etc.) | Temporary redirect stubs after moves. Safe to remove once nothing links to the old root paths. |

Do not delete proposed items until Hashim confirms. Stubs at old root paths for moved files are intentional for now.

## Public repository warning

GitHub visibility for `hashi0000/spires` is **public**. Archives here are still public. Do not add driver codes, live secrets, or real customer data to archive files. Private operating procedures: [`../ops/README.md`](../ops/README.md).
