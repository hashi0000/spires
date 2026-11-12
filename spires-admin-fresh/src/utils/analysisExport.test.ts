import { buildAnalysisCsv, csvCell } from "./analysisExport";

test("keeps zero separate from a missing amount and leaves personal details out", () => {
  const csv = buildAnalysisCsv([
    {
      id: "one",
      bookingNumber: "SP1",
      createdAt: "2026-11-09T12:13:00Z",
      pickupTime: "2026-11-27T04:00:00Z",
      status: "confirmed",
      source: "website",
      bookingMethod: "internet",
      actualFare: 0,
      amountReceivedPence: 0,
      amountRefundedPence: 0,
      hirerName: "Should Not Export",
      hirerPhone: "07700000000",
      email: "secret@example.com",
      pickupLocation: "10 Beech Crescent",
      destination: "Heathrow Terminal 2",
      notes: "child seat, private note",
      jobCosts: { driverPaymentPence: 1000, fuelPence: 0, parkingPence: 0, airportChargesPence: 0, paymentFeesPence: 0 },
    },
    {
      id: "two",
      bookingNumber: "SP2",
      bookingType: "return",
      status: "completed",
      bookingMethod: "telephone",
      actualFare: 180,
      pickupTime: "2026-10-30T17:25:00Z",
      createdAt: "2026-11-01T09:00:00Z",
    },
  ]);
  const [header, first, second] = csv.split("\n");
  expect(header).not.toMatch(/name|phone|email|address|note/i);
  expect(first).toContain("SP1");
  expect(first).toContain("0.00");
  expect(first).not.toContain("Should Not Export");
  expect(first).not.toContain("secret@example.com");
  expect(first).not.toContain("Beech");
  expect(first).not.toContain("child seat");
  expect(second).toContain("fare is for the whole booking");
  expect(second).toContain("payment missing");
  expect(second.split(",").filter((cell) => cell === "180.00").length).toBe(1);
  expect(csvCell("Hello, \"there\"\nnext")).toBe("\"Hello, \"\"there\"\"\nnext\"");
});
