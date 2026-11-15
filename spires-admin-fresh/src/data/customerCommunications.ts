/**
 * Verified from this repository on 14 November 2026.
 * Firebase Authentication templates and the SMTP password are not in the repository.
 * Return fare savings on the rate card are not listed as offers.
 */

export type OfferRow = {
  id: string;
  name: string;
  status: "active" | "scheduled" | "expired" | "withdrawn" | "not_configured";
  startsOn: string;
  endsOn: string;
  eligibility: string;
  usedIn: string;
  note: string;
};

export type MessageRow = {
  name: string;
  trigger: string;
  source: string;
  service: string;
  active: string;
  preview: string;
};

export const COMMUNICATIONS_REVIEWED_ON = "14 November 2026";

export const OFFER_ROWS: OfferRow[] = [
  {
    id: "online-airport-return",
    name: "Online airport return, £5",
    status: "withdrawn",
    startsOn: "Not recorded",
    endsOn: "Withdrawn",
    eligibility: "Previously advertised for an online airport return. Withdrawn from new messages.",
    usedIn: "Signup welcome and login emails, withdrawn. Offer terms page, withdrawn notice.",
    note: "Withdrawn by instruction. New signup, welcome and login emails must not claim it.",
  },
  {
    id: "half-term-2026",
    name: "Half term 2026, £5 off one airport return",
    status: "expired",
    startsOn: "25 October 2026",
    endsOn: "2 November 2026",
    eligibility: "Website or customer portal request for a Standard Car or 8 Seater airport return, captured on that booking.",
    usedIn: "Quote email only when that booking already has the captured discount.",
    note: "A booking that captured the discount keeps it. A new request after 2 November 2026 does not.",
  },
  {
    id: "student-id",
    name: "Student discount",
    status: "not_configured",
    startsOn: "Not recorded",
    endsOn: "Not recorded",
    eligibility: "Website pages mention a student discount with ID. No amount is stored in this repository.",
    usedIn: "Website copy only. Emails and PDFs do not insert an amount.",
    note: "Do not describe a fixed student amount until it is confirmed.",
  },
];

export const MESSAGE_ROWS: MessageRow[] = [
  {
    name: "Welcome",
    trigger: "A customer document is created",
    source: "functions/src/sendWelcomeEmail.ts",
    service: "IONOS SMTP from Firebase functions config. The password is not in this repository.",
    active: "Active. The expired £5 signup offer is omitted.",
    preview: "Welcome to Spires Taxis. Your account is ready. Sending a request does not confirm the booking. Links: customer portal, phone, WhatsApp, email and website.",
  },
  {
    name: "Login details",
    trigger: "Sent with the welcome email",
    source: "functions/src/offers/messages.ts",
    service: "Same SMTP transport as the welcome email.",
    active: "Active. It does not include a password or a discount.",
    preview: "Your Spires Taxis login details. Use Forgot password on the login page.",
  },
  {
    name: "Website booking request",
    trigger: "A successful public quote or booking request",
    source: "functions/src/bookings/guestHandlers.ts",
    service: "Same SMTP transport.",
    active: "Active. It describes a request, not a confirmed booking.",
    preview: "Your Spires Taxis booking request, with the booking reference.",
  },
  {
    name: "Quote",
    trigger: "Staff issue a quote",
    source: "functions/src/quotes/emails.ts",
    service: "Queued in Firestore emailJobs, then SMTP.",
    active: "Active. A half term sentence is included only when that quote already has the captured discount.",
    preview: "This quote is not a confirmed booking. The journeys are subject to availability.",
  },
  {
    name: "Payment request, receipt and confirmation",
    trigger: "Staff send a payment request, or a booking is confirmed or marked paid",
    source: "functions/src/quotes/emails.ts and functions/src/sendBookingReceipt.ts",
    service: "Queued emailJobs, then SMTP. Receipts are rebuilt from the booking, not from an old promotional template.",
    active: "Active.",
    preview: "Payment request, booking confirmation or payment receipt for the stored booking.",
  },
  {
    name: "Pickup reminders",
    trigger: "Scheduled about 24 hours and 1 hour before pickup",
    source: "functions/src/sendBookingReminderEmails.ts",
    service: "Same SMTP config as the welcome email.",
    active: "Active. These are journey reminders, not offers.",
    preview: "Reminder of the booked pickup time.",
  },
  {
    name: "Booking PDF",
    trigger: "Staff or the customer download or email a PDF",
    source: "functions/src/pdfGenerator.ts and customer-app/src/pdfGenerator.js",
    service: "Generated in the app. Email delivery uses SMTP.",
    active: "Active. An Executive request is labelled as not confirmed until availability is accepted.",
    preview: "Booking document using the fare stored on that booking.",
  },
  {
    name: "Email verification and password reset",
    trigger: "Firebase Authentication, from the customer portal",
    source: "Not in this repository",
    service: "Firebase Authentication email templates. Inspect them in the Firebase console. This view does not claim they match the welcome email.",
    active: "External. Not verified from this repository.",
    preview: "Not available here. Open Firebase Authentication templates before release.",
  },
];

export const RELEASE_CHECKLIST = [
  "Create a test customer with a test email address you control. Do not use a customer address.",
  "Confirm the welcome email has no £5 signup offer and the account link opens the customer portal.",
  "Request a Heathrow quote as a test and confirm the acknowledgement calls it a request.",
  "Issue a test quote with no discount and confirm it says it is not a confirmed booking.",
  "Open a booking that already has an agreed fare and confirm that fare is unchanged.",
  "Check Firebase Authentication password reset and verification templates in the Firebase console.",
  "Do not take a real payment. Use the admin payment request preview only.",
];
