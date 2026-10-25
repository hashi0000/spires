import { confirmationTermsParagraph, CURRENT_BOOKING_TERMS } from "./bookingTerms";

describe("booking terms display", () => {
  it("does not mark a booking accepted when no acceptance was stored", () => {
    const text = confirmationTermsParagraph({});
    expect(text.startsWith("Acceptance not recorded.")).toBe(true);
    expect(text).toContain(CURRENT_BOOKING_TERMS.version);
    expect(text).not.toContain("Accepted ");
  });

  it("shows the stored version and method", () => {
    const text = confirmationTermsParagraph({
      termsAccepted: true,
      termsVersion: "2026-10-25",
      acceptanceMethod: "website",
      termsAcceptedAt: "2026-10-25T18:05:00.000Z",
    });
    expect(text).toContain("Terms version 2026-10-25");
    expect(text).toContain("Website");
    expect(text).toContain(CURRENT_BOOKING_TERMS.url);
  });
});
