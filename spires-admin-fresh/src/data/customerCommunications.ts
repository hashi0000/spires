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
  benefit: string;
  eligibility: string;
  usedIn: string;
  note: string;
};

export type MessageRow = {
  name: string;
  subject: string;
  trigger: string;
  source: string;
  service: string;
  /** The template exists in this repository or is known to be configured elsewhere. */
  configured: "repository" | "external";
  /** This screen does not prove a live inbox received the message. */
  liveDelivery: "not verified";
  previewHtml: string;
};

export const COMMUNICATIONS_REVIEWED_ON = "14 November 2026";

export const OFFER_ROWS: OfferRow[] = [
  {
    id: "online-airport-return",
    name: "Online airport return, £5",
    status: "withdrawn",
    benefit: "£5 off an online airport return. Withdrawn.",
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
    benefit: "£5 off one airport return.",
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
    benefit: "No amount is set.",
    startsOn: "Not recorded",
    endsOn: "Not recorded",
    eligibility: "Website pages mention a student discount with ID. No amount is stored in this repository.",
    usedIn: "Website copy only. Emails and PDFs do not insert an amount.",
    note: "Do not describe a fixed student amount until it is confirmed.",
  },
];

function emailCard(inner: string): string {
  return `<div style="font-family:Georgia,serif;color:#1a2332;background:#f4f7fa;padding:16px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e9ef;border-radius:12px;padding:20px;">
      <p style="margin:0 0 8px;color:#b8956a;font-size:13px;">SPIRES TAXIS</p>
      ${inner}
      <p style="margin-top:20px;font-size:14px;">07776 897772<br>bookings@spires-taxis.com<br>www.spires-taxis.com</p>
    </div>
  </div>`;
}

const SYNTHETIC_NAME = "Alex Example";
const SYNTHETIC_EMAIL = "synthetic.customer@example.com";
const SYNTHETIC_REF = "SYN-EXEC-HEATHROW";

export const MESSAGE_ROWS: MessageRow[] = [
  {
    name: "Welcome",
    subject: "Welcome to Spires Taxis. Your account is ready",
    trigger: "A customer document is created",
    source: "functions/src/offers/messages.ts",
    service: "IONOS SMTP from Firebase functions config. The password is not in this repository.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Welcome to Spires Taxis</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>Thank you for creating a Spires Taxis account.</p>
      <p>Sign in with ${SYNTHETIC_EMAIL}. We do not email your password. It is the password you chose.</p>
      <p>You can request a journey, view bookings, and save addresses. Sending a request does not confirm the booking.</p>
      <p><a href="https://customer.spires-taxis.com">Access your account</a></p>`),
  },
  {
    name: "Login details",
    subject: "Your Spires Taxis login details",
    trigger: "Sent with the welcome email",
    source: "functions/src/offers/messages.ts",
    service: "Same SMTP transport as the welcome email.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Your Spires Taxis login details</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>Use this email address to sign in. We do not email your password.</p>
      <p><strong>Email:</strong> ${SYNTHETIC_EMAIL}</p>
      <p>If you forget your password, phone or email the office. We do not email your password.</p>`),
  },
  {
    name: "Website booking request",
    subject: `Your Spires Taxis booking request ${SYNTHETIC_REF}`,
    trigger: "A successful public quote or booking request",
    source: "functions/src/bookings/guestHandlers.ts",
    service: "Same SMTP transport.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Your booking request has been received</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>Your booking request has been received. The reference is <strong>${SYNTHETIC_REF}</strong>.</p>
      <p><strong>This is not a confirmed booking yet.</strong> We will review the journey and send a quote.</p>`),
  },
  {
    name: "Quote",
    subject: `Your Spires Taxis quote ${SYNTHETIC_REF}`,
    trigger: "Staff issue a quote",
    source: "functions/src/quotes/emails.ts",
    service: "Queued in Firestore emailJobs, then SMTP.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Your quote is ready</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p><strong>This is a quote, not a confirmed booking.</strong> Booking reference <strong>${SYNTHETIC_REF}</strong>.</p>
      <p>Vehicle category: Standard Car</p>
      <p>Outbound: Oxford to Heathrow Terminal 5</p>
      <p>Normal fare £92.00<br>Promotion discount £0.00<br><strong>Final quote £92.00</strong></p>
      <p>This quote is not a confirmed booking. The journeys are subject to availability.</p>`),
  },
  {
    name: "Confirmation",
    subject: `Your Spires Taxis booking ${SYNTHETIC_REF} is confirmed`,
    trigger: "A quote is accepted and the booking becomes confirmed",
    source: "functions/src/quotes/emails.ts",
    service: "Queued emailJobs, then SMTP.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Booking confirmed</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>Your booking ${SYNTHETIC_REF} is confirmed. Final total £150.00.</p>
      <p>Travel between Heathrow and Oxfordshire in a Mercedes E Class or equivalent. Advance booking required. Subject to availability and confirmation. A partner operator may provide the car. Executive Car is the vehicle category, not an allocated car.</p>`),
  },
  {
    name: "Payment request and receipt",
    subject: `Payment request for Spires Taxis booking ${SYNTHETIC_REF}`,
    trigger: "Staff send a payment request, or a payment receipt is queued",
    source: "functions/src/quotes/emails.ts and functions/src/sendBookingReceipt.ts",
    service: "Queued emailJobs, then SMTP. Receipts use the stored booking.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Payment request</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>Booking reference <strong>${SYNTHETIC_REF}</strong>.</p>
      <p>This is a payment request for your quote. The booking is not confirmed until we tell you it is confirmed.</p>
      <p>Balance requested: <strong>£150.00</strong>.</p>
      <p>This message asks for payment. It does not record that the money has been received.</p>`),
  },
  {
    name: "Pickup reminders",
    subject: "Reminder of your Spires Taxis pickup",
    trigger: "Scheduled about 24 hours and 1 hour before pickup",
    source: "functions/src/sendBookingReminderEmails.ts",
    service: "Same SMTP config as the welcome email.",
    configured: "repository",
    liveDelivery: "not verified",
    previewHtml: emailCard(`
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Pickup reminder</h1>
      <p>Dear ${SYNTHETIC_NAME},</p>
      <p>This is a reminder for booking <strong>${SYNTHETIC_REF}</strong>.</p>
      <p>Pickup: 4 Test Street, Oxford. Destination: Heathrow Terminal 5.</p>`),
  },
  {
    name: "Email verification and password reset",
    subject: "Set in Firebase Authentication",
    trigger: "Firebase Authentication, from the customer portal",
    source: "Not in this repository",
    service: "Firebase Authentication email templates. Open them in the Firebase console.",
    configured: "external",
    liveDelivery: "not verified",
    previewHtml: "",
  },
];
