# Private operating procedures

**This GitHub repository is public** (`hashi0000/spires`).

## What may stay in this repo

- Approved **customer-facing** rules in [`../policies/README.md`](../policies/README.md)
- Public setup / deploy guides that do not contain secrets
- Architecture notes that describe how the product works, without live credentials or customer data

## What must not be committed here

Store these **outside** this public repository (private notes, a private repo, or an internal drive Hashim controls):

- Driver access codes, reset procedures, and session recovery steps
- SMTP / payment provider secrets, webhook signing secrets, API keys
- Private Google Ads / Analytics operating playbooks beyond public measurement IDs already used on the site
- Real customer names, phone numbers, emails, booking references, or payment screenshots
- Staff-only runbooks that are not needed to build the public product

## Pointer

Keep a single private index (outside git) titled something like **Spires private ops** and link from there to:

1. Current policy register (this public repo): `docs/policies/README.md`
2. Release checklist (this public repo): `docs/RELEASE_CHECKLIST.md`
3. Private: driver codes, credentials vault locations, Ads console steps, incident notes

Do not paste private ops into `docs/archive/` either — archives in this repo are still public.
