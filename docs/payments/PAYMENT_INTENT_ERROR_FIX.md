# Payment Intent Error - Fixes Applied

## ✅ Fixes Applied

### 1. Added Stripe Configuration Check
- Function now checks if Stripe secret key is configured before attempting to create payment intent
- Returns clear error if not configured: "Payment system not configured"

### 2. Improved Error Logging
- Added detailed console logging at each step
- Full Stripe error details logged with `JSON.stringify(error, null, 2)`
- Error type, code, and message all logged separately

### 3. Better Frontend Error Messages
- Frontend now extracts specific error messages from Firebase Functions errors
- Shows user-friendly messages based on error code:
  - `failed-precondition` → "Payment system not configured"
  - `unauthenticated` → "You must be logged in"
  - `permission-denied` → "You don't have permission"
  - `not-found` → "Booking not found"
  - `already-exists` → "Already paid"
  - `invalid-argument` → Shows specific validation error

### 4. Added Debug Logging
- Console logs show booking ID and amount when creating payment intent
- Logs success when payment intent is created
- Logs full error details on failure

## 🔍 How to Debug the Error

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Pay Now" button
4. Look for error messages

**Look for:**
- "Creating payment intent for booking: [ID]"
- "Amount: [amount]"
- Error messages with codes

### Step 2: Check Firebase Functions Logs
```bash
firebase functions:log --only createPaymentIntent --limit 20
```

**Look for:**
- "createPaymentIntent called with: { bookingId, amount, userId }"
- "FULL STRIPE ERROR:" (shows complete Stripe error)
- "STRIPE_SECRET_KEY not configured"
- Any authentication or validation errors

### Step 3: Verify Configuration
```bash
firebase functions:config:get
```

**Should show:**
```json
{
  "stripe": {
    "secret_key": "sk_test_...",
    "webhook_secret": "whsec_..."
  }
}
```

### Step 4: Check Booking Data
In browser console, check:
```javascript
// The booking object should have:
booking.id          // Booking document ID
booking.actualFare  // Fare amount (number, not string)
booking.uid         // Should match logged-in user
booking.paymentStatus // Should not be "paid"
```

## 🚨 Common Issues and Solutions

### Issue 1: "Payment system not configured"
**Cause**: Stripe secret key not set in Firebase Functions

**Fix**:
```bash
firebase functions:config:set stripe.secret_key="sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K"
firebase deploy --only functions:createPaymentIntent
```

### Issue 2: "Invalid Stripe API key"
**Cause**: Stripe key is wrong or expired

**Fix**:
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy the correct secret key
3. Update Firebase config (see Issue 1)

### Issue 3: "Booking not found"
**Cause**: Booking ID doesn't exist or is wrong

**Fix**:
- Check that booking exists in Firestore
- Verify booking ID is correct
- Check Firestore security rules allow reading

### Issue 4: "No fare amount available"
**Cause**: Booking doesn't have `actualFare` set

**Fix**:
- Admin needs to confirm booking and set fare amount
- Check booking in Firestore has `actualFare` field

### Issue 5: "You don't have permission"
**Cause**: Booking belongs to different user

**Fix**:
- Verify user is logged in
- Check booking.uid matches logged-in user's uid

## 📋 Next Steps

1. **Redeploy functions** with the fixes:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions:createPaymentIntent
   ```

2. **Test the payment flow**:
   - Create a booking
   - Admin confirms and sets fare
   - Customer clicks "Pay Now"
   - Check browser console for logs
   - Check Firebase Functions logs for errors

3. **If still failing**, check:
   - Browser console for frontend errors
   - Firebase Functions logs for backend errors
   - Stripe Dashboard → Developers → Logs for API errors

## 🔧 Quick Test

To test if Stripe is working:

1. **Check Stripe key is valid**:
   ```bash
   # In Stripe Dashboard, test the key
   # Or use Stripe CLI:
   stripe balance retrieve --api-key sk_test_...
   ```

2. **Test function directly** (if you have Firebase CLI):
   ```bash
   firebase functions:shell
   # Then call:
   createPaymentIntent({bookingId: "test", amount: 10}, {auth: {uid: "test"}})
   ```

## 📞 Still Having Issues?

Provide these details:
1. **Browser console error** (full message)
2. **Firebase Functions logs** (last 10 lines)
3. **Booking ID** you're trying to pay
4. **Amount** being charged
5. **User ID** (from Firebase Auth)

The improved error logging should now show exactly what's failing!



