import * as functions from "firebase-functions/v1";

const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

/**
 * Read only advertising spend check.
 * No Google Ads credentials are stored, so this does not call Google Ads and cannot change a campaign or budget.
 * Customer details are not accepted or returned.
 */
export const readAdvertisingSpend = functions.https.onCall((_data, context) => {
  const email = String(context.auth?.token?.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  return {
    connected: false,
    reason: "Google Ads credentials are not configured on the server.",
    budgetChanged: false,
  };
});
