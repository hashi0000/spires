import {
  airportCollectionNotes,
  bookingTotalLabel,
  extraStopsNeedAgreement,
  invoiceSupplierForReprint,
  legacyPaidWithoutAmount,
  reconciliationItems,
  vehicleClassRequiredMessage,
} from "./bookingOps";

test("labels one booking total and keeps a return from looking like a second charge", () => {
  expect(bookingTotalLabel(180)).toBe("Booking total £180.00");
  expect(bookingTotalLabel(null)).toBe("Booking total not set");
});

test("clears the extra stop warning only after the fare is explicitly included", () => {
  expect(extraStopsNeedAgreement(true, false)).toBe(true);
  expect(extraStopsNeedAgreement(true, true)).toBe(false);
  expect(extraStopsNeedAgreement(false, false)).toBe(false);
});

test("flags an airport collection contradiction and leaves the flag unchanged", () => {
  const notes = airportCollectionNotes({
    airportCollection: true,
    pickupLocation: "Oxford",
    destination: "Heathrow Terminal 5",
    hasReturn: false,
  });
  expect(notes[0]).toMatch(/Outbound has airport collection checked/);
  expect(notes.join(" ")).toMatch(/stored flag is left as it is/);
});

test("requires a vehicle class for a new confirmation and keeps an older confirmed booking editable", () => {
  expect(vehicleClassRequiredMessage("confirmed", "", false)).toMatch(/vehicle class/);
  expect(vehicleClassRequiredMessage("confirmed", "", true)).toBe("");
  expect(vehicleClassRequiredMessage("pending", "")).toBe("");
});

test("keeps a paid flag without an amount unreconciled", () => {
  expect(legacyPaidWithoutAmount("paid", 0)).toBe(true);
  expect(legacyPaidWithoutAmount("paid", 1500)).toBe(false);
  expect(legacyPaidWithoutAmount("pending", 0)).toBe(false);
});

test("queues missing fare, payment, cost and source without turning unknown into zero", () => {
  const items = reconciliationItems([
    { bookingNumber: "SP1", status: "confirmed", actualFare: null, paymentStatus: "paid", amountReceivedPence: 0, bookingMethod: "telephone" },
    { bookingNumber: "SP2", status: "confirmed", actualFare: 40, subcontractOperator: "Partner Cars", supplierCostPence: 0, bookingMethod: "telephone" },
    { bookingNumber: "SP3", status: "confirmed", actualFare: 40, bookingMethod: "", source: "", heardAbout: "" },
  ]);
  expect(items.map((item) => item.kind)).toEqual(["fare", "payment", "cost", "source"]);
});

test("reprints an issued invoice with the supplier saved on it", () => {
  expect(invoiceSupplierForReprint({ accountName: "Issued" }, { accountName: "Current" })).toEqual({ accountName: "Issued" });
  expect(invoiceSupplierForReprint(undefined, { accountName: "Current" })).toEqual({ accountName: "Current" });
});
