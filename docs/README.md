# Spires Taxis — documentation index

Operational notes live here so the repo root stays small. App-specific deploy notes remain next to each app where relevant.

| Folder | Contents |
|--------|----------|
| `payments/` | Stripe setup, webhooks, payment-intent troubleshooting |
| `seo/` | SEO checklists and landing-page plans |
| `functions/` | Cloud Functions email setup, Stripe webhook raw body |
| `customer-app/` | Historical notes (`readnew.md`), deployment status snapshots |
| `admin/` | Admin-specific note copies (see `guides/` for shared material like `online.md`) |
| `guides/` | Navigation bar install, site-wide nav guide, legacy overview |
| `templates/` | HTML shells for new static pages (were `template.md` / `template2.md`) |
| `archive/` | Old scratch docs (e.g. legacy CSS readme dump) |

**Live apps**

- `customer-app/` — React customer portal; see `DEPLOYMENT_GUIDE.md` and `ENV_VARIABLES.md` in that folder.
- `spires-admin-fresh/` — React admin; build with `npm run build` there.
- `functions/` — Firebase Functions; deploy from repo root with Firebase CLI.

**Static marketing site** — HTML/CSS/JS at repository root (`index.html`, `css/`, `js/`, `images/`).
