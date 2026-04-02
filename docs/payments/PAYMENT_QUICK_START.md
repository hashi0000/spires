# Payment Integration - Quick Start

## ✅ What's Been Implemented

Card payment functionality has been added to your customer portal. Here's what's included:

### Frontend (Customer App)
- ✅ **Payment Component** (`customer-app/src/components/Payment.jsx`)
  - Secure card input using Stripe Elements
  - Payment processing flow
  - Error handling and user feedback

- ✅ **Dashboard Updates** (`customer-app/src/Dashboard.jsx`)
  - "Pay Now" button appears on confirmed bookings with a fare
  - Button only shows when payment is needed
  - Automatically updates after successful payment

### Backend (Firebase Functions)
- ✅ **createPaymentIntent** - Creates Stripe payment intent
- ✅ **confirmPayment** - Confirms payment and updates booking
- ✅ **stripeWebhook** - Handles Stripe webhook events (backup)

### Dependencies Added
- ✅ `@stripe/stripe-js` and `@stripe/react-stripe-js` in customer-app
- ✅ `stripe` in Firebase Functions

## 🚀 Next Steps to Enable Payments

### 1. Install Dependencies
```bash
# Customer app
cd customer-app
npm install

# Firebase Functions
cd ../functions
npm install
```

### 2. Set Up Stripe Account
1. Sign up at https://stripe.com
2. Get your API keys from https://dashboard.stripe.com/test/apikeys
3. Copy your **Publishable Key** (starts with `pk_test_`)

### 3. Add Environment Variables

**Customer App** - Create `customer-app/.env`:
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Firebase Functions** - Set in Firebase Console or use:
```bash
firebase functions:config:set stripe.secret_key="sk_test_your_key_here"
```

### 4. Deploy
```bash
# Build and deploy functions
cd functions
npm run build
firebase deploy --only functions

# Build customer app
cd ../customer-app
npm run build
# Deploy to your hosting (Vercel, Firebase Hosting, etc.)
```

## 📖 Full Documentation

See `STRIPE_PAYMENT_SETUP.md` for:
- Detailed setup instructions
- Webhook configuration
- Testing guide
- Troubleshooting
- Security information

## 🧪 Testing

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Use any future expiry date, any CVC, any postal code

## 💡 How It Works

1. Customer sees "Pay Now" button on confirmed bookings
2. Clicks button → Payment modal opens
3. Enters card details (securely via Stripe)
4. Payment processed → Booking status updates to "paid"
5. Customer receives confirmation

## ⚠️ Important Notes

- **Test Mode**: Use `pk_test_...` keys for testing
- **Production**: Switch to `pk_live_...` keys before going live
- **Security**: Card details never touch your server
- **Fees**: Stripe charges 1.4% + 20p per UK transaction

## 🆘 Need Help?

1. Check `STRIPE_PAYMENT_SETUP.md` for detailed instructions
2. Review Firebase Functions logs: `firebase functions:log`
3. Check browser console for frontend errors
4. Verify all environment variables are set



