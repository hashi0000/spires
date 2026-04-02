# Spires Taxis - Customer Dashboard & Email System Summary

## 🧭 Overview — Customer Dashboard + Admin Integration

### ✅ What’s Completed
1. **New Customer Dashboard React App**
   - Built in `customer-app/src`
   - Includes:
     - Login / Signup pages
     - Dashboard with Firestore sync
     - Booking form modal
     - Booking history view
     - PDF generation via `pdfGenerator.ts`

2. **Firestore Sync with Admin**
   - Customer and admin share the same `bookings` collection.
   - Admin can confirm, assign drivers, etc.
   - Customers see live booking status updates.

3. **PDF Receipt Integration**
   - Customers can download booking receipts.
   - Uses the same logic as admin.

4. **Email Receipt System (In Progress)**
   - Firebase Cloud Function (`sendBookingReceipt.ts`)
   - Sends booking confirmation + attached PDF via email.
   - Configured for **IONOS SMTP**.

---

## ⚙️ Current Project Structure
spires-site-clean/
├── customer-app/
│ ├── src/
│ │ ├── Dashboard.jsx
│ │ ├── firebase.js
│ │ ├── pdfGenerator.ts
│ │ └── styles.css
│ └── package.json
└── functions/
├── src/
│ ├── index.ts
│ └── sendBookingReceipt.ts
├── package.json
└── tsconfig.json


---

## 🔒 Next Steps

### 1️⃣ Secure SMTP Credentials
Use Firebase environment variables instead of storing passwords in code:
```bash
firebase functions:config:set ionos.email="bookings@spires-taxis.com" ionos.password="YOUR_PASSWORD"
const email = functions.config().ionos.email;
const password = functions.config().ionos.password;

const transporter = nodemailer.createTransport({
  host: "smtp.ionos.co.uk",
  port: 465,
  secure: true,
  auth: { user: email, pass: password },
});
firebase deploy --only functions
