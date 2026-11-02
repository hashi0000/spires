import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export const GUEST_CLAIM_PREVIEW_URL =
  "https://us-central1-spires-taxis.cloudfunctions.net/guestClaimPreview";

export async function previewGuestClaim(token) {
  const response = await fetch(GUEST_CLAIM_PREVIEW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(body.error || "This link is not valid.");
  }
  return body;
}

export async function claimGuestBooking(token) {
  const claim = httpsCallable(functions, "claimGuestBooking");
  const result = await claim({ token });
  return result.data;
}

export function readableAuthError(err) {
  const code = err && err.code ? String(err.code) : "";
  if (code === "auth/email-already-in-use") {
    return "Please sign in, or reset your password, to continue.";
  }
  const message = err && err.message ? String(err.message) : "";
  const cleaned = message
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  return cleaned || "Something went wrong. Please try again.";
}
