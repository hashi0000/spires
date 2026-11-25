import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type AccountInvoiceStampLink = {
  bookingId: string;
  keys: string[];
  expectedRevision?: number;
};

export async function stampAccountInvoiceBookings(input: {
  invoiceId: string;
  invoiceNumber: string;
  links: AccountInvoiceStampLink[];
}): Promise<{ ok: true; stamped: string[]; invoiceNumber: string }> {
  const call = httpsCallable(functions, "stampAccountInvoiceBookings");
  const result = await call(input);
  return result.data as { ok: true; stamped: string[]; invoiceNumber: string };
}

export function linksFromDraft(keys: string[], bookingRevisions: Record<string, number>): AccountInvoiceStampLink[] {
  const byBooking = new Map<string, string[]>();
  for (const key of keys) {
    const bookingId = key.includes(":") ? key.split(":")[0] : key;
    const list = byBooking.get(bookingId) || [];
    list.push(key);
    byBooking.set(bookingId, list);
  }
  return Array.from(byBooking.entries()).map(([bookingId, unitKeys]) => ({
    bookingId,
    keys: unitKeys,
    expectedRevision: bookingRevisions[bookingId],
  }));
}
