# Troubleshooting "Failed to Create Payment Intent"

## Common Causes and Solutions

### 1. Stripe Secret Key Not Configured ⚠️

**Error**: "Payment system not configured" or "Invalid Stripe API key"

**Solution**:
```bash
cd functions
firebase functions:config:set stripe.secret_key="sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K"
firebase deploy --only functions
```

**Verify**:
```bash
firebase functions:config:get
```

Should show:
```
stripe:
  secret_key: sk_test_...
```

### 2. Functions Not Deployed

**Error**: Function not found or 404

**Solution**:
```bash
cd functions
npm run build
firebase deploy --only functions:createPaymentIntent
```

### 3. Check Firebase Functions Logs

**View logs**:
```bash
firebase functions:log --only createPaymentIntent
```

Or in Firebase Console:
- Go to Firebase Console → Functions → Logs
- Filter by `createPaymentIntent`

**Look for**:
- "STRIPE_SECRET_KEY not configured"
- "FULL STRIPE ERROR:" (shows detailed error)
- Any authentication errors

### 4. Verify Stripe Key is Correct

**Test your key**:
1. Go to https://dashboard.stripe.com/test/apikeys
2. Verify the secret key matches what you set in Firebase
3. Make sure you're using **test** keys (starts with `sk_test_`) for testing
4. Make sure you're using **live** keys (starts with `sk_live_`) for production

### 5. Check Booking Data

**Verify**:
- Booking has `actualFare` set
- Booking belongs to the authenticated user
- Booking is not already paid
- Amount is valid (at least £0.50)

**Debug in frontend**:
```javascript
console.log("Booking:", booking);
console.log("Amount:", booking.actualFare);
```

### 6. Network/Firebase Connection Issues

**Check**:
- Internet connection
- Firebase project is active
- Functions are enabled in Firebase Console
- Billing is enabled (required for Cloud Functions)

### 7. CORS or Authentication Issues

**Verify**:
- User is logged in
- Firebase Auth token is valid
- Firestore rules allow reading bookings

## Quick Diagnostic Steps

1. **Check if function is deployed**:
   ```bash
   firebase functions:list
   ```
   Should show `createPaymentIntent`

2. **Check configuration**:
   ```bash
   firebase functions:config:get
   ```

3. **Test locally** (if using emulator):
   ```bash
   firebase emulators:start --only functions
   ```

4. **Check browser console**:
   - Open browser DevTools → Console
   - Look for error messages when clicking "Pay Now"
   - Check Network tab for failed requests

5. **Check Firebase Functions logs**:
   ```bash
   firebase functions:log
   ```

## Expected Error Messages

### "Payment system not configured"
→ Stripe secret key not set in Firebase Functions config

### "Invalid Stripe API key"
→ Stripe key is wrong or expired

### "Booking not found"
→ Booking ID doesn't exist or wrong ID

### "You don't have permission"
→ Booking belongs to different user

### "This booking has already been paid"
→ Payment already completed

### "Amount must be at least £0.50"
→ Fare amount is too small

## Still Not Working?

1. **Check the full error in Firebase logs**:
   ```bash
   firebase functions:log --only createPaymentIntent --limit 50
   ```

2. **Look for "FULL STRIPE ERROR:" in logs** - this shows the complete Stripe error

3. **Verify Stripe account is active**:
   - Go to Stripe Dashboard
   - Check account status
   - Verify API keys are enabled

4. **Test with Stripe CLI** (optional):
   ```bash
   stripe listen --forward-to http://localhost:5001/spires-taxis/us-central1/stripeWebhook
   ```

## Contact Support

If none of these work, provide:
1. Full error message from browser console
2. Firebase Functions logs (last 20 lines)
3. Stripe Dashboard → Developers → Logs (if available)
4. Booking ID and amount you're trying to pay



