# Spires Taxis Customer App - Deployment Guide

## 🚀 Vercel Deployment Configuration

This guide will help you deploy the customer booking app to Vercel and fix all configuration issues.

---

## ✅ Step 1: Firebase Authorized Domains

**IMPORTANT:** Before deploying, add your domains to Firebase Authentication:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **spires-taxis**
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Add these domains:
   - `spires-taxis.com`
   - `spires-website.vercel.app`
   - `localhost` (for local development)

---

## ✅ Step 2: Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **spires-taxis**
3. Navigate to **Firestore Database** → **Rules**
4. Copy the contents of `firestore.rules` (included in this repo)
5. Paste into the Firestore Rules editor
6. Click **Publish**

The rules allow:
- ✅ Authenticated users to read/write their own bookings
- ✅ Users to create bookings with "pending" status
- ✅ Users to update only their own pending bookings
- ✅ Authenticated users to read drivers and vehicles
- ❌ Users cannot delete bookings or modify admin data

---

## ✅ Step 3: Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables (optional - defaults are in code, but recommended for security):

```
REACT_APP_FIREBASE_API_KEY=AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4
REACT_APP_FIREBASE_AUTH_DOMAIN=spires-taxis.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=spires-taxis
REACT_APP_FIREBASE_STORAGE_BUCKET=spires-taxis.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=12158743704
REACT_APP_FIREBASE_APP_ID=1:12158743704:web:402ace8b3430906bf28ced
REACT_APP_FIREBASE_MEASUREMENT_ID=G-8JQVEJB1NR
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

**Note:** 
- Firebase variables are optional since the code has fallback values, but using environment variables is a best practice.
- **Stripe key is REQUIRED** for payment functionality. Get it from your Stripe dashboard.
- See `STRIPE_PAYMENT_SETUP.md` for detailed Stripe setup instructions.

---

## ✅ Step 4: Vercel Configuration

The `vercel.json` file is already configured with:
- ✅ Build output directory: `build`
- ✅ SPA routing rewrites for `/customer` path
- ✅ Static asset caching headers

**No additional configuration needed!**

---

## ✅ Step 5: Verify Deployment

After deploying to Vercel:

1. **Test the main site link:**
   - Visit `https://spires-taxis.com/customer`
   - Should load the React app without white screen

2. **Test routing:**
   - `/customer` → redirects to `/customer/dashboard`
   - `/customer/login` → shows login page
   - `/customer/signup` → shows signup page
   - `/customer/dashboard` → shows dashboard (requires auth)

3. **Test Firebase:**
   - Try logging in with existing credentials
   - Create a new booking
   - Check browser console for any 403 errors (should be none)

---

## 🔧 Troubleshooting

### White Screen on Load
- ✅ Check browser console for errors
- ✅ Verify `vercel.json` rewrites are correct
- ✅ Ensure `homepage: "/customer"` in `package.json`
- ✅ Verify `basename="/customer"` in `App.jsx`

### 403 Permission Errors
- ✅ Verify Firestore rules are published
- ✅ Check authorized domains in Firebase
- ✅ Ensure user is authenticated before accessing Firestore

### Routing Issues
- ✅ Verify `vercel.json` has correct rewrites
- ✅ Check that `BrowserRouter` has `basename="/customer"`
- ✅ Ensure all links use relative paths or include `/customer` prefix

### Build Errors
- ✅ Run `npm install` locally to check for dependency issues
- ✅ Check Vercel build logs for specific errors
- ✅ Verify Node.js version in Vercel settings (should be 18+)

---

## 📝 File Structure

```
customer-app/
├── vercel.json          # Vercel deployment config
├── firestore.rules      # Firestore security rules
├── .env.example         # Environment variables template
├── package.json         # Dependencies and homepage config
└── src/
    ├── App.jsx          # Router with basename="/customer"
    └── firebase.js      # Firebase config with env vars
```

---

## 🎯 Quick Checklist

Before deploying, ensure:
- [ ] Firebase authorized domains include `spires-taxis.com` and `spires-website.vercel.app`
- [ ] Firestore rules are published
- [ ] `package.json` has `"homepage": "/customer"`
- [ ] `App.jsx` has `basename="/customer"` in BrowserRouter
- [ ] `vercel.json` exists with correct rewrites
- [ ] Environment variables are set in Vercel (optional but recommended)

---

## 🚀 Deploy Command

If deploying manually:
```bash
npm run build
vercel --prod
```

Or push to your connected Git repository and Vercel will auto-deploy.

---

## 📞 Support

If issues persist:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify Firebase console for authentication and Firestore access
4. Test locally with `npm start` to isolate issues



