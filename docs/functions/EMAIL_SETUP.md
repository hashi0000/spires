# Email Setup Guide - Customer Welcome Emails

## Overview
This function automatically sends welcome emails to customers when they sign up through the customer app.

## What Gets Sent
1. **Welcome Email** - Thank you message with special offer details
2. **Login Details Email** - Account information (email address, note about password)

## Setup Instructions

### 1. Set Environment Variables in Firebase

You need to set your SMTP credentials as Firebase Functions environment variables:

```bash
firebase functions:config:set smtp.host="smtp-1and1.live.any.po.server.lan"
firebase functions:config:set smtp.port="587"
firebase functions:config:set email.user="bookings@spires-taxis.com"
firebase functions:config:set email.pass="YOUR_EMAIL_PASSWORD"
```

**Note:** For Firebase Functions v2, use:
```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASS
```

### 2. Update Code to Use Config (if using v1)

If you're using Firebase Functions v1, update the code to read from config:

```typescript
const functions = require('firebase-functions');
const config = functions.config();

const transporter = nodemailer.createTransport({
  host: config.smtp.host || "smtp-1and1.live.any.po.server.lan",
  port: Number(config.smtp.port) || 587,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});
```

### 3. Deploy the Function

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 4. Test the Function

1. Create a new customer account through the customer app
2. Check the customer's email inbox for:
   - Welcome email
   - Login details email
3. Check Firebase Functions logs:
   ```bash
   firebase functions:log
   ```

## How It Works

- When a new customer document is created in the `customers` collection in Firestore, the `onCustomerCreate` function triggers
- The function sends two emails:
  1. Welcome email with special offer
  2. Login details email (note: password is not sent for security)

## Troubleshooting

### Emails Not Sending
1. Check Firebase Functions logs: `firebase functions:log`
2. Verify SMTP credentials are correct
3. Check that environment variables are set
4. Verify the customer document is being created in Firestore

### SMTP Connection Issues
- Verify SMTP host and port are correct
- Check if your email provider requires specific IP whitelisting
- Test SMTP connection separately if needed

## Security Notes

- Passwords are NOT sent via email (security best practice)
- Customers can reset passwords using Firebase Auth password reset
- Email credentials are stored securely in Firebase Functions config/secrets

