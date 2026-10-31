"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentLinkAllowlist = paymentLinkAllowlist;
exports.validatePaymentLinkUrl = validatePaymentLinkUrl;
exports.paymentStatusAfterCustomerAction = paymentStatusAfterCustomerAction;
/**
 * Hosted payment links are pasted by an admin. Clicking one must never mark a booking paid.
 *
 * Default hosts are Stripe Checkout and Payment Link hosts already used by this project's
 * Stripe dependency, plus the Shift4 host used by Spires. Add other verified hosts with
 * PAYMENT_LINK_HOST_ALLOWLIST or functions config payments.hosts (comma separated exact hosts).
 */
const DEFAULT_HOSTS = ["checkout.stripe.com", "buy.stripe.com", "pay.stripe.com", "payments.stripe.com", "pay.shift4.com"];
function paymentLinkAllowlist(extraRaw = "") {
    const extras = String(extraRaw || "")
        .split(",")
        .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
        .filter(Boolean);
    return Array.from(new Set([...DEFAULT_HOSTS, ...extras]));
}
function validatePaymentLinkUrl(raw, allowlist) {
    const url = String(raw || "").trim();
    if (!url)
        throw new Error("Paste a hosted payment link first.");
    if (url.length > 2048)
        throw new Error("That payment link is too long.");
    if (/[\s<>]/.test(url))
        throw new Error("That payment link is not a plain https URL.");
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new Error("The payment link must be a valid https URL.");
    }
    if (parsed.protocol !== "https:")
        throw new Error("The payment link must use https.");
    if (parsed.username || parsed.password)
        throw new Error("The payment link must not contain credentials.");
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || !host.includes(".") || host.includes("xn--")) {
        throw new Error("The payment link hostname is not valid.");
    }
    const allowed = allowlist.some((entry) => host === entry);
    if (!allowed) {
        throw new Error("That payment host is not on the allowlist. Add the verified host to PAYMENT_LINK_HOST_ALLOWLIST before saving the link.");
    }
    return parsed.toString();
}
/** Customer actions on a hosted link do not change payment state. */
function paymentStatusAfterCustomerAction(current) {
    return current;
}
