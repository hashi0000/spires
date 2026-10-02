import { ADMIN_EMAILS, envFlagTrue } from "./defaults";
import { ShareConfig, ShareJourney } from "./types";
import { isListableJourney } from "./logic";
import { cityMatchingPublicBlocked } from "./destinationMatching";

export type ShareAccessRole = "admin" | "preview" | "customer" | "none";

export type ShareFlags = {
  enabled: boolean;
  pilot: boolean;
  publicEnabled: boolean;
};

export function shareFlagsFromEnv(
  env: NodeJS.Dict<string> = process.env,
  publicEnabled = false
): ShareFlags {
  return {
    enabled: envFlagTrue(env.SPIRES_SHARE_ENABLED),
    pilot: envFlagTrue(env.SPIRES_SHARE_PILOT),
    publicEnabled,
  };
}

export function sharePilotActive(flags: ShareFlags): boolean {
  return flags.enabled && flags.pilot;
}

export function publicSharePageAllowed(flags: ShareFlags): boolean {
  return sharePilotActive(flags);
}

export function customerShareAccessAllowed(opts: {
  flags: ShareFlags;
  authenticated: boolean;
  isAdmin: boolean;
  isPreviewTester: boolean;
}): boolean {
  if (opts.isAdmin || opts.isPreviewTester) return true;
  if (!opts.authenticated) return false;
  if (!opts.flags.enabled) return false;
  if (opts.flags.pilot) return true;
  if (opts.flags.publicEnabled) return true;
  return false;
}

export function isAdminEmail(email: string, adminEmails: string[] = ADMIN_EMAILS): boolean {
  return adminEmails.includes((email || "").trim().toLowerCase());
}

export function isPreviewTester(email: string, config: Pick<ShareConfig, "previewTesterEmails">): boolean {
  return config.previewTesterEmails.includes((email || "").trim().toLowerCase());
}

export function canCustomerJoinJourney(
  journey: Pick<ShareJourney, "customerVisible" | "status" | "journeyType" | "destinationMatchingEnabled" | "destinationMatchingPublicEnabled" | "airportId">,
  role: ShareAccessRole,
  cityMatchingPublicEnabled = false
): boolean {
  if (cityMatchingPublicBlocked(journey, cityMatchingPublicEnabled) && role === "customer") return false;
  if (role === "admin" || role === "preview") return true;
  return Boolean(journey.customerVisible) && isListableJourney(journey.status);
}

export function isCustomerListableJourney(
  journey: Pick<ShareJourney, "customerVisible" | "status" | "journeyType" | "destinationMatchingEnabled" | "destinationMatchingPublicEnabled" | "airportId">,
  role: ShareAccessRole = "customer",
  cityMatchingPublicEnabled = false
): boolean {
  if (!isListableJourney(journey.status) || journey.status === "PAYMENT_ACTION_REQUIRED") return false;
  if (cityMatchingPublicBlocked(journey, cityMatchingPublicEnabled) && role === "customer") return false;
  if (role === "admin" || role === "preview") return true;
  return Boolean(journey.customerVisible);
}
