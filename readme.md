# Spires Taxis (monorepo)

| Part | Role |
|------|------|
| **Root** (`*.html`, `css/`, `js/`, `images/`) | Public marketing site |
| **`customer-app/`** | Customer React app (Firebase Auth, Firestore, Stripe) |
| **`spires-admin-fresh/`** | Internal admin React app (TypeScript) |
| **`functions/`** | Firebase Cloud Functions (emails, PDFs, Stripe) |

Documentation index: **[docs/README.md](docs/README.md)**.

Firebase project config lives in `firebase.json` (Functions + emulator settings). Node **22** is specified for the static root `package.json`; Cloud Functions use **Node 20** per `functions/package.json`.
