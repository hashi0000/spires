import { createHash, randomBytes } from "crypto";
import { ADMIN_EMAIL, escapeHtml, getTransporter, mailFrom, reminderConfigOk } from "../driverReminderEmail";
import { formatPence } from "./halfTerm";

export const QUOTE_PAGE_ORIGIN = "https://www.spires-taxis.com/quote";

export const EMAIL_CONFIG_HELP =
  "Email is not configured. Set firebase functions:config:set email.user=\"bookings@spires-taxis.com\" email.pass=\"YOUR_SMTP_PASSWORD\" smtp.host=\"smtp.ionos.co.uk\" smtp.port=\"587\" and redeploy functions. Do not invent a password.";

export function assertEmailConfigured(): void {
  if (!reminderConfigOk()) {
    throw new Error(EMAIL_CONFIG_HELP);
  }
}

export function newQuoteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashQuoteToken(token) };
}

export function hashQuoteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type QuoteEmailModel = {
  bookingNumber: string;
  customerName: string;
  vehicleLabel: string;
  outbound: string;
  returnLeg: string;
  normalFare: string;
  discount: string;
  finalFare: string;
  validUntil: string;
  paymentRequirement: "advance" | "later";
  paymentDescription: string;
  amountRequested: string;
  quoteUrl: string;
  paymentUrl: string;
  terms: string;
};

function shell(inner: string): string {
  return `<div style="font-family:Georgia,serif;color:#1a2332;background:#f4f7fa;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e9ef;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;color:#b8956a;font-size:13px;letter-spacing:0.04em;">SPIRES TAXIS</p>
      ${inner}
      <p style="margin-top:24px;font-size:14px;">07776 897772<br>
      <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
      <a href="https://www.spires-taxis.com">www.spires-taxis.com</a></p>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:16px 0;"><a href="${escapeHtml(href)}" style="background:#002147;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

export function quoteEmailHtml(model: QuoteEmailModel): string {
  const payment =
    model.paymentRequirement === "advance"
      ? `<p><strong>Advance payment is required</strong> before this booking is confirmed. ${escapeHtml(model.paymentDescription)} of <strong>${escapeHtml(model.amountRequested)}</strong> is requested. Your booking will be confirmed once payment has been received.</p>`
      : `<p>Payment can be made later. Accepting this quote confirms the booking at the final total shown.</p>`;
  const payButton = model.paymentUrl ? button(model.paymentUrl, "Pay securely") : "";
  return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Your quote is ready</h1>
    <p>Dear ${escapeHtml(model.customerName || "Customer")},</p>
    <p><strong>This is a quote, not a confirmed booking.</strong> Booking reference <strong>${escapeHtml(model.bookingNumber)}</strong>.</p>
    <p>Vehicle: ${escapeHtml(model.vehicleLabel)}</p>
    <p>Outbound: ${escapeHtml(model.outbound)}</p>
    ${model.returnLeg ? `<p>Return: ${escapeHtml(model.returnLeg)}</p>` : ""}
    <p>Normal fare ${escapeHtml(model.normalFare)}<br>
    Promotion discount ${escapeHtml(model.discount)}<br>
    <strong>Final quote ${escapeHtml(model.finalFare)}</strong></p>
    ${model.validUntil ? `<p>This quote is valid until ${escapeHtml(model.validUntil)}.</p>` : ""}
    ${payment}
    <p>${escapeHtml(model.terms)}</p>
    ${button(model.quoteUrl, "View and accept quote")}
    ${payButton}
  `);
}

export function paymentRequestHtml(input: {
  bookingNumber: string;
  customerName: string;
  amount: string;
  description: string;
  paymentUrl: string;
  bookingUrl: string;
  confirmed: boolean;
}): string {
  const state = input.confirmed
    ? "This booking is confirmed."
    : "This is a payment request for your quote. The booking is not confirmed until we tell you it is confirmed.";
  return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Payment request</h1>
    <p>Dear ${escapeHtml(input.customerName || "Customer")},</p>
    <p>Booking reference <strong>${escapeHtml(input.bookingNumber)}</strong>.</p>
    <p>${escapeHtml(state)}</p>
    <p>${escapeHtml(input.description)} requested: <strong>${escapeHtml(input.amount)}</strong>.</p>
    ${button(input.paymentUrl, "Pay securely")}
    <p><a href="${escapeHtml(input.bookingUrl)}">View your booking quote</a></p>
  `);
}

export function acceptanceCustomerHtml(input: {
  bookingNumber: string;
  customerName: string;
  confirmed: boolean;
  finalFare: string;
}): string {
  const body = input.confirmed
    ? `Your booking ${escapeHtml(input.bookingNumber)} is confirmed. Final total ${escapeHtml(input.finalFare)}.`
    : `Your quote ${escapeHtml(input.bookingNumber)} is accepted and is awaiting payment. Your booking will be confirmed once payment has been received. Final total ${escapeHtml(input.finalFare)}.`;
  return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">${input.confirmed ? "Booking confirmed" : "Quote accepted"}</h1>
    <p>Dear ${escapeHtml(input.customerName || "Customer")},</p>
    <p>${body}</p>
  `);
}

export function acceptanceAdminHtml(input: { bookingNumber: string; customerName: string; outcome: string }): string {
  return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Quote accepted</h1>
    <p>${escapeHtml(input.customerName)} accepted quote ${escapeHtml(input.bookingNumber)}.</p>
    <p>${escapeHtml(input.outcome)}</p>
  `);
}

export async function sendHtmlEmail(input: {
  to: string;
  subject: string;
  html: string;
  bccAdmin?: boolean;
}): Promise<{ messageId: string }> {
  assertEmailConfigured();
  const info = await getTransporter().sendMail({
    from: mailFrom(),
    to: input.to,
    bcc: input.bccAdmin === false ? undefined : ADMIN_EMAIL,
    subject: input.subject,
    html: input.html,
  });
  return { messageId: String(info.messageId || "") };
}

export function vehicleLabel(vehicleType: string): string {
  const n = vehicleType.toLowerCase();
  if (n.includes("8")) return "8 Seater";
  if (n.includes("standard") || n === "car") return "Standard Car";
  return vehicleType || "Vehicle to be confirmed";
}

export function moneyOrZero(pence: number): string {
  return formatPence(pence);
}
