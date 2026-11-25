import type { Booking } from "../types/types";
import type { SavedInvoiceClient } from "./generalInvoiceTypes";

export type BillingAccountSuggestion = {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  source: "invoice_client" | "booking";
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `account-${Date.now()}`;
}

/** Distinct billing accounts already used on bookings, plus saved invoice clients. */
export function buildBillingAccountSuggestions(
  bookings: Booking[],
  invoiceClients: SavedInvoiceClient[] = []
): BillingAccountSuggestion[] {
  const byKey = new Map<string, BillingAccountSuggestion>();

  for (const client of invoiceClients) {
    const name = text(client.name);
    if (!name) continue;
    const key = name.toLowerCase();
    byKey.set(key, {
      id: text(client.id) || slugId(name),
      name,
      address: text(client.address),
      email: text(client.email),
      phone: text(client.phone),
      source: "invoice_client",
    });
  }

  for (const booking of bookings) {
    const row = booking as Booking & {
      email?: string;
      hirerEmail?: string;
      hirerPhone?: string;
      hirerAddress?: string;
      jobKind?: string;
    };
    const name = text(booking.billingAccountName) || (
      booking.paymentMethod === "account" || row.jobKind === "account" ? text(booking.hirerName) : ""
    );
    if (!name) continue;
    const key = name.toLowerCase();
    const email = text(row.email) || text(row.hirerEmail);
    const phone = text(row.hirerPhone);
    const address = text(row.hirerAddress);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.id && booking.billingAccountId) existing.id = String(booking.billingAccountId);
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.address && address) existing.address = address;
      continue;
    }
    byKey.set(key, {
      id: text(booking.billingAccountId) || slugId(name),
      name,
      address,
      email,
      phone,
      source: "booking",
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function matchBillingAccount(
  query: string,
  suggestions: BillingAccountSuggestion[]
): BillingAccountSuggestion | null {
  const q = text(query).toLowerCase();
  if (!q) return null;
  return (
    suggestions.find((row) => row.name.toLowerCase() === q) ||
    suggestions.find((row) => row.name.toLowerCase().startsWith(q)) ||
    null
  );
}

export function billingAccountOptionLabel(account: BillingAccountSuggestion): string {
  return account.name;
}
