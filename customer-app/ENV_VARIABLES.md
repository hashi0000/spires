# Environment variables (customer app)

Optional Firebase web config for Vercel. Fallback values also exist in `src/firebase.js` for local builds.

**Do not commit secrets.** Firebase web API keys are public client identifiers, but treat measurement protocol secrets, SMTP passwords and payment keys as private — store them in Secret Manager / Vercel encrypted env, not in Markdown.

## Setting up in Vercel

1. Open the customer-app Vercel project → **Settings** → **Environment Variables**
2. Add these for Production, Preview and Development (values from the Firebase project console, not from chat history):

```
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
REACT_APP_FIREBASE_MEASUREMENT_ID=
```

## Local development

Create a gitignored `.env` in `customer-app/` with the same keys. See also [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

Private credential locations: [`../docs/ops/README.md`](../docs/ops/README.md).
