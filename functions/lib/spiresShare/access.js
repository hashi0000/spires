"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareFlagsFromEnv = shareFlagsFromEnv;
exports.sharePilotActive = sharePilotActive;
exports.publicSharePageAllowed = publicSharePageAllowed;
exports.customerShareAccessAllowed = customerShareAccessAllowed;
exports.isAdminEmail = isAdminEmail;
exports.isPreviewTester = isPreviewTester;
exports.canCustomerJoinJourney = canCustomerJoinJourney;
exports.isCustomerListableJourney = isCustomerListableJourney;
const defaults_1 = require("./defaults");
const logic_1 = require("./logic");
const destinationMatching_1 = require("./destinationMatching");
function shareFlagsFromEnv(env = process.env, publicEnabled = false) {
    return {
        enabled: (0, defaults_1.envFlagTrue)(env.SPIRES_SHARE_ENABLED),
        pilot: (0, defaults_1.envFlagTrue)(env.SPIRES_SHARE_PILOT),
        publicEnabled,
    };
}
function sharePilotActive(flags) {
    return flags.enabled && flags.pilot;
}
function publicSharePageAllowed(flags) {
    return sharePilotActive(flags);
}
function customerShareAccessAllowed(opts) {
    if (opts.isAdmin || opts.isPreviewTester)
        return true;
    if (!opts.authenticated)
        return false;
    if (!opts.flags.enabled)
        return false;
    if (opts.flags.pilot)
        return true;
    if (opts.flags.publicEnabled)
        return true;
    return false;
}
function isAdminEmail(email, adminEmails = defaults_1.ADMIN_EMAILS) {
    return adminEmails.includes((email || "").trim().toLowerCase());
}
function isPreviewTester(email, config) {
    return config.previewTesterEmails.includes((email || "").trim().toLowerCase());
}
function canCustomerJoinJourney(journey, role, cityMatchingPublicEnabled = false) {
    if ((0, destinationMatching_1.cityMatchingPublicBlocked)(journey, cityMatchingPublicEnabled) && role === "customer")
        return false;
    if (role === "admin" || role === "preview")
        return true;
    return Boolean(journey.customerVisible) && (0, logic_1.isListableJourney)(journey.status);
}
function isCustomerListableJourney(journey, role = "customer", cityMatchingPublicEnabled = false) {
    if (!(0, logic_1.isListableJourney)(journey.status) || journey.status === "PAYMENT_ACTION_REQUIRED")
        return false;
    if ((0, destinationMatching_1.cityMatchingPublicBlocked)(journey, cityMatchingPublicEnabled) && role === "customer")
        return false;
    if (role === "admin" || role === "preview")
        return true;
    return Boolean(journey.customerVisible);
}
