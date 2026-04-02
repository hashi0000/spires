# Environment Variables for Vercel

## Optional Configuration

The Firebase configuration in `src/firebase.js` has fallback values, so environment variables are **optional**. However, using them is a best practice for security and flexibility.

## Setting Up in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables for **Production**, **Preview**, and **Development**:

```
REACT_APP_FIREBASE_API_KEY=AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4
REACT_APP_FIREBASE_AUTH_DOMAIN=spires-taxis.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=spires-taxis
REACT_APP_FIREBASE_STORAGE_BUCKET=spires-taxis.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=12158743704
REACT_APP_FIREBASE_APP_ID=1:12158743704:web:402ace8b3430906bf28ced
REACT_APP_FIREBASE_MEASUREMENT_ID=G-8JQVEJB1NR
```

## Local Development

For local development, you can create a `.env` file in the `customer-app` directory:

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4
REACT_APP_FIREBASE_AUTH_DOMAIN=spires-taxis.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=spires-taxis
REACT_APP_FIREBASE_STORAGE_BUCKET=spires-taxis.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=12158743704
REACT_APP_FIREBASE_APP_ID=1:12158743704:web:402ace8b3430906bf28ced
REACT_APP_FIREBASE_MEASUREMENT_ID=G-8JQVEJB1NR
```

**Note:** The `.env` file should be added to `.gitignore` to keep credentials secure.



