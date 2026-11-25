import { buildBillingAccountSuggestions, matchBillingAccount } from "./billingAccounts";
import type { Booking } from "../types/types";

describe("billingAccounts", () => {
  it("merges invoice clients with account bookings and prefers invoice contact details", () => {
    const bookings = [
      {
        billingAccountName: "Eduguard",
        billingAccountId: "eduguard",
        hirerPhone: "07000",
        email: "old@example.com",
        jobKind: "account",
      },
      {
        paymentMethod: "account",
        hirerName: "Crouch Rare Books",
        hirerPhone: "07766",
      },
    ] as Booking[];

    const rows = buildBillingAccountSuggestions(bookings, [
      {
        id: "eduguard",
        name: "Eduguard",
        address: "Oxford",
        email: "accounts@eduguard.example",
        phone: "01865 000000",
        invoicePrefix: "EDU",
      },
    ]);

    expect(rows.map((row) => row.name)).toEqual(["Crouch Rare Books", "Eduguard"]);
    const eduguard = rows.find((row) => row.name === "Eduguard");
    expect(eduguard?.email).toBe("accounts@eduguard.example");
    expect(eduguard?.source).toBe("invoice_client");
    expect(matchBillingAccount("edu", rows)?.name).toBe("Eduguard");
  });
});
