# Stripe Webhook Setup Guide

## Your Stripe Keys

**Publishable Key (for Customer App):**
```
pk_test_51Saxpn2O2JDOUcya8fGPBCKpSnFieo6JV8ucseyMM6ybW1VQlnYN2KoFnArdMznf35k6qdpf6CyV9U2iMhXjxFJ100Evmi8rJu
```

**Secret Key (for Firebase Functions):**
```
sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K
```

## Your Webhook URL

**After deploying Firebase Functions, your webhook URL will be:**

```
https://us-central1-spires-taxis.cloudfunctions.net/stripeWebhook
```

**Note:** If your functions are deployed to a different region, the URL will be:
```
https://REGION-spires-taxis.cloudfunctions.net/stripeWebhook
```

### How to Find Your Exact Webhook URL

1. **Deploy your functions first:**
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. **Check the deployment output** - it will show the exact URLs:
   ```
   ✔  functions[stripeWebhook(us-central1)]: Successful create operation.
   Function URL (stripeWebhook): https://us-central1-spires-taxis.cloudfunctions.net/stripeWebhook
   ```

3. **Or check in Firebase Console:**
   - Go to https://console.firebase.google.com/
   - Select project: **spires-taxis**
   - Navigate to **Functions**
   - Find `stripeWebhook` function
   - Copy the URL shown

## Step-by-Step Webhook Setup

### 1. Deploy Firebase Functions

First, make sure your functions are deployed:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 2. Set Stripe Secret Key in Firebase

```bash
cd functions
firebase functions:config:set stripe.secret_key="sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K"
```

**Note:** For Firebase Functions v2+, you may need to use environment variables instead. Check your Firebase Functions version.

### 3. Configure Webhook in Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://us-central1-spires-taxis.cloudfunctions.net/stripeWebhook
   ```
   (Use the exact URL from your deployment)
4. Select events to listen to:
   - ✅ `payment_intent.succeeded`
5. Click **"Add endpoint"**
6. **IMPORTANT:** Copy the **Signing secret** (starts with `whsec_...`)
   - This will be shown after creating the endpoint
   - You'll need this for the next step

### 4. Set Webhook Secret in Firebase

After getting the webhook signing secret from Stripe:

```bash
firebase functions:config:set stripe.webhook_secret="whsec_your_webhook_secret_here"
```

**Or set it in Firebase Console:**
1. Go to Firebase Console → Functions → Configuration
2. Add environment variable:
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_your_webhook_secret_here`

### 5. Redeploy Functions (if you changed config)

```bash
firebase deploy --only functions
```

## Testing the Webhook

1. **Make a test payment** in your customer portal
2. **Check Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/webhooks
   - Click on your webhook endpoint
   - You should see events being received
3. **Check Firebase Functions Logs:**
   ```bash
   firebase functions:log --only stripeWebhook
   ```
4. **Verify booking updated:**
   - Check Firestore to see if `paymentStatus` was updated to "paid"

## Environment Variables Summary

### Customer App (.env file)
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51Saxpn2O2JDOUcya8fGPBCKpSnFieo6JV8ucseyMM6ybW1VQlnYN2KoFnArdMznf35k6qdpf6CyV9U2iMhXjxFJ100Evmi8rJu
```

### Firebase Functions
- `STRIPE_SECRET_KEY`: `sk_test_51Saxpn2O2JDOUcya8yJpKFvGhjM9MOGTLeB5fJIK7vufn05NRgz57zuDnJ23VBVMbN6hcHgPeoSqDOj4ogJ8EylO00QZzF2m4K`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...` (get this from Stripe after creating webhook)

## Troubleshooting

### Webhook not receiving events
- ✅ Verify the webhook URL is correct
- ✅ Check that functions are deployed
- ✅ Ensure webhook endpoint is enabled in Stripe
- ✅ Check Firebase Functions logs for errors

### "Webhook signature verification failed"
- ✅ Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- ✅ Make sure you're using the signing secret from Stripe (starts with `whsec_`)
- ✅ Redeploy functions after setting the secret

### Payment succeeds but booking not updated
- ✅ Check Firebase Functions logs
- ✅ Verify Firestore security rules allow updates
- ✅ Check that webhook is receiving events in Stripe dashboard

## Production Setup

When ready for production:

1. **Switch to live keys:**
   - Get live keys from https://dashboard.stripe.com/apikeys
   - Update environment variables with `pk_live_...` and `sk_live_...`

2. **Create production webhook:**
   - Use the same webhook URL
   - Stripe will automatically use the correct endpoint based on your API keys

3. **Test thoroughly** before going live!



