# Stripe Payment Integration Setup Guide

This guide will help you set up card payments through the customer portal using Stripe.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Firebase project with Functions enabled
3. Node.js and npm installed

## Step 1: Install Dependencies

### Customer App
```bash
cd customer-app
npm install
```

### Firebase Functions
```bash
cd functions
npm install
```

## Step 2: Set Up Stripe Account

1. **Create a Stripe Account**
   - Go to https://stripe.com and sign up
   - Complete the account setup process
   - Verify your business details

2. **Get Your API Keys**
   - Go to https://dashboard.stripe.com/test/apikeys (for testing)
   - Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

3. **Set Up Webhook** (for production)
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Enter your webhook URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
   - Select events: `payment_intent.succeeded`
   - Copy the **Webhook Signing Secret** (starts with `whsec_`)

## Step 3: Configure Environment Variables

### Customer App (.env file)

Create a `.env` file in the `customer-app` directory:

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

**For Production:**
- Use `pk_live_...` instead of `pk_test_...`
- Update the `.env` file before building for production

### Firebase Functions

Set environment variables in Firebase:

```bash
cd functions

# Set Stripe Secret Key
firebase functions:config:set stripe.secret_key="sk_test_your_secret_key_here"

# Set Webhook Secret (for production)
firebase functions:config:set stripe.webhook_secret="whsec_your_webhook_secret_here"
```

**Or use Firebase Console:**
1. Go to Firebase Console → Your Project → Functions → Configuration
2. Add the following environment variables:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Your webhook signing secret (for production)

**Note:** For Firebase Functions v2+, use `.env` file or Firebase Console instead of `functions:config:set`.

## Step 4: Update Payment Function Code

The payment functions are already created in `functions/src/payment.ts`. Make sure the code reads from environment variables correctly:

- `process.env.STRIPE_SECRET_KEY` - Your Stripe secret key
- `process.env.STRIPE_WEBHOOK_SECRET` - Your webhook secret (optional, for webhook handler)

## Step 5: Deploy Firebase Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

This will deploy:
- `createPaymentIntent` - Creates a payment intent for a booking
- `confirmPayment` - Confirms payment after successful Stripe payment
- `stripeWebhook` - Handles Stripe webhook events

## Step 6: Build and Deploy Customer App

```bash
cd customer-app
npm run build
```

Deploy the built files to your hosting platform (Firebase Hosting, Vercel, etc.).

## Step 7: Test the Integration

### Test Mode (Recommended First)

1. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Use any future expiry date, any CVC, any postal code

2. Create a booking in the customer portal
3. Wait for admin to confirm the booking and set a fare
4. Click "Pay Now" on the confirmed booking
5. Enter test card details
6. Complete the payment

### Production Mode

1. Switch to live keys in your environment variables
2. Redeploy functions and customer app
3. Test with a real card (you can refund test payments)

## How It Works

1. **Customer clicks "Pay Now"**
   - Frontend calls `createPaymentIntent` Firebase Function
   - Function creates a Stripe Payment Intent
   - Returns client secret to frontend

2. **Customer enters card details**
   - Stripe Elements securely collects card information
   - Card details never touch your server

3. **Payment is confirmed**
   - Frontend calls `confirmPayment` Firebase Function
   - Function verifies payment with Stripe
   - Updates booking in Firestore with `paymentStatus: "paid"`

4. **Webhook (optional backup)**
   - Stripe sends webhook event when payment succeeds
   - `stripeWebhook` function updates booking as backup

## Security Notes

- ✅ Card details are never stored on your server
- ✅ All payment processing happens through Stripe
- ✅ Payment intents are verified before updating booking status
- ✅ Only booking owners can pay for their bookings
- ✅ Webhook signature verification prevents unauthorized updates

## Troubleshooting

### "Stripe is not configured" error
- Check that `REACT_APP_STRIPE_PUBLISHABLE_KEY` is set in customer-app `.env`
- Rebuild the customer app after adding the key

### "Failed to create payment intent"
- Check that `STRIPE_SECRET_KEY` is set in Firebase Functions
- Verify the key is correct (test vs live)
- Check Firebase Functions logs for detailed errors

### Payment succeeds but booking not updated
- Check Firebase Functions logs
- Verify `confirmPayment` function is being called
- Check Firestore security rules allow updates
- Webhook should handle this as backup

### Webhook not working
- Verify webhook URL is correct in Stripe dashboard
- Check webhook secret is set correctly
- Ensure webhook endpoint is publicly accessible
- Check Firebase Functions logs

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For integration issues:
- Check Firebase Functions logs: `firebase functions:log`
- Check browser console for frontend errors
- Verify all environment variables are set correctly

## Cost Information

Stripe charges:
- **UK cards**: 1.4% + 20p per transaction
- **EU cards**: 1.9% + 20p per transaction
- **International cards**: 2.9% + 20p per transaction

No monthly fees or setup costs.



