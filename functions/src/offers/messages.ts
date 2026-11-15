import { claimFor } from "./catalog";

const PORTAL_URL = "https://customer.spires-taxis.com";
const SITE_URL = "https://www.spires-taxis.com";
const PHONE_TEL = "tel:+447776897772";
const PHONE_DISPLAY = "07776 897772";
const EMAIL = "bookings@spires-taxis.com";
const WHATSAPP = "https://wa.me/447776897772";

export const CUSTOMER_LINKS = { PORTAL_URL, SITE_URL, PHONE_TEL, PHONE_DISPLAY, EMAIL, WHATSAPP };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Removes the withdrawn signup offer if a queued message still contains that block. */
const SIGNUP_OFFER_BLOCK =
  /<div[^>]*>\s*<h2[^>]*>[^<]*Special Offer[^<]*<\/h2>[\s\S]*?£5 off the total[\s\S]*?<\/div>/gi;

export function withoutExpiredSignupOffer(html: string, nowMs: number): string {
  if (claimFor("online-airport-return", nowMs)) return html;
  return String(html || "")
    .replace(SIGNUP_OFFER_BLOCK, "")
    .replace(/<p[^>]*>[\s\S]*?£5 off the total[\s\S]*?<\/p>/gi, "");
}

export function welcomeSendDecision(status: unknown, attempts: unknown): "send" | "already_sent" | "stopped" {
  if (status === "sent") return "already_sent";
  const count = Math.max(0, Math.round(Number(attempts) || 0));
  if (count >= 3) return "stopped";
  return "send";
}

export type WelcomeClaim =
  | { action: "send"; attempts: number; sendId: string }
  | { action: "skip"; reason: "already_sent" | "stopped" | "needs_review" };

/**
 * A status of sending means SMTP may already have accepted the message.
 * The next trigger must not send another copy. onCustomerCreate retries only
 * when the function throws after a failed SMTP attempt.
 */
export function decideWelcomeClaim(row: { welcomeEmailStatus?: unknown; welcomeEmailAttempts?: unknown }, sendId: string): WelcomeClaim {
  const status = String(row.welcomeEmailStatus || "");
  if (status === "sent") return { action: "skip", reason: "already_sent" };
  if (status === "sending" || status === "needs_review") return { action: "skip", reason: "needs_review" };
  const attempts = Math.max(0, Math.round(Number(row.welcomeEmailAttempts) || 0));
  if (attempts >= 3) return { action: "skip", reason: "stopped" };
  return { action: "send", attempts: attempts + 1, sendId };
}

export function welcomeFailureShouldRetry(attempts: number): boolean {
  return attempts < 3;
}

export function welcomePlainText(fullName: string, email = ""): string {
  const name = String(fullName || "Customer").replace(/[<>]/g, "");
  const signIn = String(email || "").replace(/[\r\n<>]/g, "").trim();
  return [
    `Dear ${name},`,
    "",
    "Thank you for creating a Spires Taxis account.",
    "",
    ...(signIn ? [`Sign in with ${signIn}.`, "We do not email your password. It is the password you chose.", ""] : []),
    "You can now:",
    "- Request a journey online through your account",
    "- View and manage your bookings",
    "- Save your favourite addresses for the next request",
    "- Look back at your booking history",
    "",
    "Sending a request does not confirm the booking. We confirm the journey after we have agreed it with you.",
    "",
    `Access your account: ${PORTAL_URL}`,
    "",
    `Phone: ${PHONE_DISPLAY}`,
    `WhatsApp: ${WHATSAPP}`,
    `Email: ${EMAIL}`,
    `Website: ${SITE_URL}`,
    "",
    "Best regards,",
    "The Spires Taxis team",
  ].join("\n");
}

export function loginPlainText(fullName: string, email: string): string {
  const name = String(fullName || "Customer").replace(/[<>]/g, "");
  const signIn = String(email || "").replace(/[\r\n<>]/g, "").trim();
  return [
    `Dear ${name},`,
    "",
    "Use this email address to sign in. We do not email your password.",
    "",
    `Email: ${signIn}`,
    "",
    "If you forget your password, phone or email the office and we will help you sign in. We do not email your password.",
    "",
    `Log in: ${PORTAL_URL}`,
    "",
    `If you did not create this account, email ${EMAIL}.`,
  ].join("\n");
}

export function signupOfferHtml(nowMs: number): string {
  const claim = claimFor("online-airport-return", nowMs);
  if (!claim) return "";
  return `
        <div style="background: #f7f9fc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C5A572;">
          <h2 style="color: #002147; font-size: 20px; margin-top: 0;">Special offer</h2>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            ${escapeHtml(claim.customerClaim)}. This offer ends on ${escapeHtml(claim.endsOn)}.
          </p>
        </div>`;
}

export function quoteCustomerTerms(discountPence: number): string {
  if (discountPence > 0) {
    return "This quote is not a confirmed booking. The half term offer is £5 off this complete airport return and is not combined with other offers. One way bookings are not discounted. The journeys are subject to availability.";
  }
  return "This quote is not a confirmed booking. The journeys are subject to availability.";
}

export function buildWelcomeEmail(input: { fullName: string; nowMs: number; email?: string }): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.fullName || "Customer");
  const email = escapeHtml(input.email || "");
  const offer = signupOfferHtml(input.nowMs);
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #002147; font-size: 28px; margin: 0;">Welcome to Spires Taxis</h1>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">Dear ${name},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          Thank you for creating a Spires Taxis account.
        </p>
        ${email ? `<p style="font-size: 16px; line-height: 1.6;">Sign in with ${email}. We do not email your password. It is the password you chose.</p>` : ""}
        ${offer}
        <p style="font-size: 16px; line-height: 1.6;">You can now:</p>
        <ul style="font-size: 16px; line-height: 1.8;">
          <li>Request a journey online through your account</li>
          <li>View and manage your bookings</li>
          <li>Save your favourite addresses for the next request</li>
          <li>Look back at your booking history</li>
        </ul>
        <p style="font-size: 16px; line-height: 1.6;">Sending a request does not confirm the booking. We confirm the journey after we have agreed it with you.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${PORTAL_URL}" style="background: #002147; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Access your account</a>
        </div>
        <div style="background: #f7f9fc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 14px;">
            Phone: <a href="${PHONE_TEL}" style="color: #002147;">${PHONE_DISPLAY}</a><br>
            WhatsApp: <a href="${WHATSAPP}" style="color: #002147;">${PHONE_DISPLAY}</a><br>
            Email: <a href="mailto:${EMAIL}" style="color: #002147;">${EMAIL}</a><br>
            Website: <a href="${SITE_URL}" style="color: #002147;">www.spires-taxis.com</a>
          </p>
        </div>
        <p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br><strong>The Spires Taxis team</strong></p>
      </div>`;
  return {
    subject: "Welcome to Spires Taxis. Your account is ready",
    html: withoutExpiredSignupOffer(html, input.nowMs),
    text: welcomePlainText(input.fullName || "Customer", input.email || ""),
  };
}

export function buildLoginDetailsEmail(input: { fullName: string; email: string }): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.fullName || "Customer");
  const email = escapeHtml(input.email);
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #002147; font-size: 28px; margin: 0;">Your Spires Taxis login details</h1>
        <p style="font-size: 16px; line-height: 1.6;">Dear ${name},</p>
        <p style="font-size: 16px; line-height: 1.6;">Use this email address to sign in. We do not email your password.</p>
        <div style="background: #f7f9fc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C5A572;">
          <p style="margin: 10px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6;">If you forget your password, phone or email the office and we will help you sign in. We do not email your password.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${PORTAL_URL}" style="background: #002147; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Log in to your account</a>
        </div>
        <p style="font-size: 14px; color: #666;">If you did not create this account, email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
      </div>`;
  return { subject: "Your Spires Taxis login details", html, text: loginPlainText(input.fullName || "Customer", input.email) };
}
