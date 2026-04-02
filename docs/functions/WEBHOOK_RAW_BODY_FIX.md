# Webhook Raw Body Fix for Firebase Functions v1

## Current Implementation

The webhook function currently accesses `req.rawBody` directly. For Firebase Functions v1, this should work, but if you encounter "rawBody not available" errors, you may need to add Express middleware.

## If Raw Body is Not Available

If you see errors like "rawBody not available on request", you'll need to add Express middleware to preserve the raw body. Here's how:

### Option 1: Add Express Body Parser (Recommended)

1. Install express:
```bash
cd functions
npm install express
npm install --save-dev @types/express
```

2. Update `functions/src/payment.ts`:

```typescript
import * as express from "express";

// Create Express app for webhook
const webhookApp = express();

// Middleware to preserve raw body
webhookApp.use('/stripeWebhook', express.raw({ type: 'application/json' }));

webhookApp.post('/stripeWebhook', async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = functions.config().stripe.webhook_secret;
  
  // Now req.body is a Buffer containing the raw body
  const rawBody = req.body;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle event...
  res.json({ received: true });
});

export const stripeWebhook = functions.https.onRequest(webhookApp);
```

### Option 2: Use Functions v2 (Alternative)

If raw body issues persist, consider upgrading to Firebase Functions v2, which has better support for raw body:

```typescript
import { onRequest } from "firebase-functions/v2/https";

export const stripeWebhook = onRequest(
  { raw: true },
  async (req, res) => {
    const rawBody = req.rawBody; // Available in v2
    // ... rest of webhook code
  }
);
```

## Testing

After deploying, test the webhook:
1. Make a test payment
2. Check Stripe Dashboard → Webhooks → Your endpoint
3. Verify events are received (green checkmark)
4. Check Firebase Functions logs for any errors

## Current Status

The current implementation should work if `req.rawBody` is available. If not, use Option 1 above.



