"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_CONFIG_HELP = exports.QUOTE_PAGE_ORIGIN = void 0;
exports.assertEmailConfigured = assertEmailConfigured;
exports.newQuoteToken = newQuoteToken;
exports.hashQuoteToken = hashQuoteToken;
exports.quoteEmailHtml = quoteEmailHtml;
exports.paymentRequestHtml = paymentRequestHtml;
exports.acceptanceCustomerHtml = acceptanceCustomerHtml;
exports.acceptanceAdminHtml = acceptanceAdminHtml;
exports.sendHtmlEmail = sendHtmlEmail;
exports.vehicleLabel = vehicleLabel;
exports.moneyOrZero = moneyOrZero;
const crypto_1 = require("crypto");
const driverReminderEmail_1 = require("../driverReminderEmail");
const halfTerm_1 = require("./halfTerm");
exports.QUOTE_PAGE_ORIGIN = "https://www.spires-taxis.com/quote";
exports.EMAIL_CONFIG_HELP = "Email is not configured. Set firebase functions:config:set email.user=\"bookings@spires-taxis.com\" email.pass=\"YOUR_SMTP_PASSWORD\" smtp.host=\"smtp.ionos.co.uk\" smtp.port=\"587\" and redeploy functions. Do not invent a password.";
function assertEmailConfigured() {
    if (!(0, driverReminderEmail_1.reminderConfigOk)()) {
        throw new Error(exports.EMAIL_CONFIG_HELP);
    }
}
function newQuoteToken() {
    const token = (0, crypto_1.randomBytes)(32).toString("base64url");
    return { token, hash: hashQuoteToken(token) };
}
function hashQuoteToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function shell(inner) {
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
function button(href, label) {
    return `<p style="margin:16px 0;"><a href="${(0, driverReminderEmail_1.escapeHtml)(href)}" style="background:#002147;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">${(0, driverReminderEmail_1.escapeHtml)(label)}</a></p>`;
}
function quoteEmailHtml(model) {
    const payment = model.paymentRequirement === "advance"
        ? `<p><strong>Advance payment is required</strong> before this booking is confirmed. ${(0, driverReminderEmail_1.escapeHtml)(model.paymentDescription)} of <strong>${(0, driverReminderEmail_1.escapeHtml)(model.amountRequested)}</strong> is requested. Your booking will be confirmed once payment has been received.</p>`
        : `<p>Payment can be made later. Accepting this quote confirms the booking at the final total shown.</p>`;
    const payButton = model.paymentUrl ? button(model.paymentUrl, "Pay securely") : "";
    return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Your quote is ready</h1>
    <p>Dear ${(0, driverReminderEmail_1.escapeHtml)(model.customerName || "Customer")},</p>
    <p><strong>This is a quote, not a confirmed booking.</strong> Booking reference <strong>${(0, driverReminderEmail_1.escapeHtml)(model.bookingNumber)}</strong>.</p>
    <p>Vehicle: ${(0, driverReminderEmail_1.escapeHtml)(model.vehicleLabel)}</p>
    <p>Outbound: ${(0, driverReminderEmail_1.escapeHtml)(model.outbound)}</p>
    ${model.returnLeg ? `<p>Return: ${(0, driverReminderEmail_1.escapeHtml)(model.returnLeg)}</p>` : ""}
    <p>Normal fare ${(0, driverReminderEmail_1.escapeHtml)(model.normalFare)}<br>
    Promotion discount ${(0, driverReminderEmail_1.escapeHtml)(model.discount)}<br>
    <strong>Final quote ${(0, driverReminderEmail_1.escapeHtml)(model.finalFare)}</strong></p>
    ${model.validUntil ? `<p>This quote is valid until ${(0, driverReminderEmail_1.escapeHtml)(model.validUntil)}.</p>` : ""}
    ${payment}
    <p>${(0, driverReminderEmail_1.escapeHtml)(model.terms)}</p>
    ${button(model.quoteUrl, "View and accept quote")}
    ${payButton}
  `);
}
function paymentRequestHtml(input) {
    const state = input.confirmed
        ? "This booking is confirmed."
        : "This is a payment request for your quote. The booking is not confirmed until we tell you it is confirmed.";
    return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Payment request</h1>
    <p>Dear ${(0, driverReminderEmail_1.escapeHtml)(input.customerName || "Customer")},</p>
    <p>Booking reference <strong>${(0, driverReminderEmail_1.escapeHtml)(input.bookingNumber)}</strong>.</p>
    <p>${(0, driverReminderEmail_1.escapeHtml)(state)}</p>
    <p>${(0, driverReminderEmail_1.escapeHtml)(input.description)} requested: <strong>${(0, driverReminderEmail_1.escapeHtml)(input.amount)}</strong>.</p>
    ${button(input.paymentUrl, "Pay securely")}
    <p><a href="${(0, driverReminderEmail_1.escapeHtml)(input.bookingUrl)}">View your booking quote</a></p>
  `);
}
function acceptanceCustomerHtml(input) {
    const body = input.confirmed
        ? `Your booking ${(0, driverReminderEmail_1.escapeHtml)(input.bookingNumber)} is confirmed. Final total ${(0, driverReminderEmail_1.escapeHtml)(input.finalFare)}.`
        : `Your quote ${(0, driverReminderEmail_1.escapeHtml)(input.bookingNumber)} is accepted and is awaiting payment. Your booking will be confirmed once payment has been received. Final total ${(0, driverReminderEmail_1.escapeHtml)(input.finalFare)}.`;
    return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">${input.confirmed ? "Booking confirmed" : "Quote accepted"}</h1>
    <p>Dear ${(0, driverReminderEmail_1.escapeHtml)(input.customerName || "Customer")},</p>
    <p>${body}</p>
  `);
}
function acceptanceAdminHtml(input) {
    return shell(`
    <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">Quote accepted</h1>
    <p>${(0, driverReminderEmail_1.escapeHtml)(input.customerName)} accepted quote ${(0, driverReminderEmail_1.escapeHtml)(input.bookingNumber)}.</p>
    <p>${(0, driverReminderEmail_1.escapeHtml)(input.outcome)}</p>
  `);
}
async function sendHtmlEmail(input) {
    assertEmailConfigured();
    const info = await (0, driverReminderEmail_1.getTransporter)().sendMail({
        from: (0, driverReminderEmail_1.mailFrom)(),
        to: input.to,
        bcc: input.bccAdmin === false ? undefined : driverReminderEmail_1.ADMIN_EMAIL,
        subject: input.subject,
        html: input.html,
    });
    return { messageId: String(info.messageId || "") };
}
function vehicleLabel(vehicleType) {
    const n = vehicleType.toLowerCase();
    if (n.includes("8"))
        return "8 Seater";
    if (n.includes("standard") || n === "car")
        return "Standard Car";
    return vehicleType || "Vehicle to be confirmed";
}
function moneyOrZero(pence) {
    return (0, halfTerm_1.formatPence)(pence);
}
