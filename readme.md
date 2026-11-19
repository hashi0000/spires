# Spires Taxis (monorepo)

| Part | Role |
|------|------|
| **`spires-website/`** | Public marketing site (static HTML on Vercel) |
| **`customer-app/`** | Customer React app (Firebase Auth, Firestore, payments) |
| **`spires-admin-fresh/`** | Internal admin React app (TypeScript) |
| **`functions/`** | Firebase Cloud Functions (emails, PDFs, quotes, Share) |
| **`spires-international/`** | Separate International preview site |

Documentation index: **[docs/README.md](docs/README.md)**.  
Customer-facing policy register: **[docs/policies/README.md](docs/policies/README.md)**.  
Coding agents: **[AGENTS.md](AGENTS.md)**.

Firebase project config lives in `firebase.json` (Functions, emulator, admin hosting). Use the Node version stated in each package (`functions/package.json`, app package files).
