# Stripe Integration Fixes Applied

## ✅ All Issues Fixed

### 1. Stripe Initialization ✅
- **Fixed**: Now uses `functions.config().stripe.secret_key` correctly
- **API Version**: Set to `"2023-10-16"` (stable version)
- **Location**: `functions/src/payment.ts` line 6-8

```typescript
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: "2023-10-16",
});
```

### 2. Webhook Raw Body ✅
- **Fixed**: Webhook function now accesses `req.rawBody` for signature verification
- **Note**: For Firebase Functions v1, `rawBody` should be available on the request object
- **Location**: `functions/src/payment.ts` line 203-258

### 3. Error Logging ✅
- **Fixed**: Added comprehensive error logging with `JSON.stringify(error, null, 2)`
- **Location**: 
  - `createPaymentIntent` catch block (line 114-121)
  - `confirmPayment` catch block (line 187-194)

```typescript
catch (error: any) {
  console.error("FULL STRIPE ERROR:", JSON.stringify(error, null, 2));
  console.error("Error creating payment intent:", error);
  throw new functions.https.HttpsError(
    "internal",
    "Failed to create payment intent",
    error?.message || "Unknown error"
  );
}
```

### 4. Amount Validation ✅
- **Fixed**: Added robust validation to handle:
  - String amounts with currency symbols (£, $, €)
  - Comma separators
  - Whitespace
  - Non-numeric values
- **Location**: `functions/src/payment.ts` line 40-49

```typescript
// Convert amount to number, handling strings with currency symbols
const amountString = String(amount).replace(/[£$€,\s]/g, "");
const amountNumber = parseFloat(amountString);

if (isNaN(amountNumber) || amountNumber <= 0) {
  throw new functions.https.HttpsError(
    "invalid-argument",
    "Amount must be a valid positive number"
  );
}
```

### 5. Booking Validation ✅
- **Fixed**: Added comprehensive validation:
  - `bookingId` must exist and be a string
  - `amount` must exist
  - `booking.uid === context.auth.uid` (permission check)
  - `paymentStatus !== "paid"` (prevent double payment)
  - Booking data exists check
- **Location**: `functions/src/payment.ts` line 24-79

### 6. Stripe Package ✅
- **Verified**: Stripe is installed (`stripe@14.25.0`)
- **Verified**: `@types/stripe` is installed
- **Location**: `functions/package.json`

### 7. TypeScript Compilation ✅
- **Fixed**: All TypeScript errors resolved
- **Build**: `npm run build` completes successfully
- **Location**: `functions/lib/payment.js` (compiled output)

## 🔧 Configuration Required

### Set Stripe Keys in Firebase

```bash
cd functions
firebase functions:config:set stripe.secret_key="sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K"
firebase functions:config:set stripe.webhook_secret="whsec_your_webhook_secret_here"
```

### Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## ⚠️ Important Notes

### Webhook Raw Body
For Firebase Functions v1, the `rawBody` property should be available on the request object when Stripe sends webhook events. If you encounter signature verification errors:

1. Check Firebase Functions logs for "rawBody not available" errors
2. If needed, we may need to add Express middleware to preserve raw body
3. The webhook URL must be configured in Stripe Dashboard

### Testing
1. Use Stripe test cards: `4242 4242 4242 4242`
2. Check Firebase Functions logs: `firebase functions:log`
3. Monitor Stripe Dashboard webhook events
4. Verify Firestore updates after payment

## 📋 Checklist

- [x] Stripe initialized with `functions.config()`
- [x] Webhook uses `req.rawBody`
- [x] Error logging shows full Stripe errors
- [x] Amount validation handles currency symbols
- [x] Booking validation checks permissions
- [x] Stripe package installed
- [x] TypeScript compiles successfully
- [ ] Stripe keys configured in Firebase
- [ ] Functions deployed
- [ ] Webhook URL configured in Stripe Dashboard
- [ ] Test payment completed successfully

## 🚀 Next Steps

1. **Configure Stripe keys in Firebase:**
   ```bash
   firebase functions:config:set stripe.secret_key="sk_test_..."
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   ```

2. **Deploy functions:**
   ```bash
   firebase deploy --only functions
   ```

3. **Set up webhook in Stripe Dashboard:**
   - URL: `https://us-central1-spires-taxis.cloudfunctions.net/stripeWebhook`
   - Event: `payment_intent.succeeded`
   - Copy webhook secret and update Firebase config

4. **Test the payment flow:**
   - Create a booking
   - Admin confirms and sets fare
   - Customer clicks "Pay Now"
   - Complete payment with test card
   - Verify booking status updates to "paid"

## 📞 Troubleshooting

### "Failed to create payment intent"
- Check Firebase Functions logs for full error details
- Verify `stripe.secret_key` is set correctly
- Check Stripe API key is valid (test vs live)

### "Webhook signature verification failed"
- Verify `stripe.webhook_secret` is set correctly
- Check webhook URL in Stripe Dashboard matches deployed function
- Ensure webhook secret matches the one in Stripe Dashboard

### "rawBody not available"
- This may require Express middleware configuration
- Check Firebase Functions v1 documentation
- Consider upgrading to Functions v2 if issues persist



