import {
  assessAccountBooking,
  buildAccountInvoiceDraft,
  filterUnitsNotAlreadyInvoiced,
  invoicedKeysFromHistory,
  listReadyBillableUnits,
  selectionTotalPounds,
} from "./accountBilling";
import type { Booking } from "../types/types";
import type { SavedInvoiceClient } from "./generalInvoiceTypes";

const EDUGUARD: SavedInvoiceClient = {
  id: "client-eduguard",
  name: "EDUGUARD",
  address: "Oxford",
  email: "accounts@eduguard.example",
  phone: "01865 000000",
  invoicePrefix: "ST-EDU",
};

const DCRB: SavedInvoiceClient = {
  id: "client-dcrb",
  name: "DCRB",
  address: "London",
  email: "daniel@crouchrarebooks.com",
  phone: "+44 7766 751391",
  invoicePrefix: "ST-DCRB",
};

function booking(partial: Partial<Booking> & Record<string, unknown>): Booking {
  return {
    bookingNumber: "SP1",
    dateTime: "2026-11-01T10:00:00",
    pickupTime: "2026-11-01T10:00:00",
    hirerName: "Passenger",
    hirerAddress: "",
    hirerPhone: "",
    bookingMethod: "telephone",
    pickupLocation: "Oxford",
    destination: "Heathrow",
    status: "completed",
    paymentMethod: "account",
    jobKind: "account",
    ...partial,
  } as Booking;
}

describe("accountBilling", () => {
  it("lets four EDUGUARD trips for Benson and Joyce become one draft invoice", () => {
    const trips = [
      booking({
        id: "b1",
        bookingNumber: "SP-B1",
        passengerName: "Benson",
        billingAccountId: EDUGUARD.id,
        billingAccountName: "EDUGUARD",
        actualFare: 120,
        pickupTime: "2026-11-02T09:00:00",
      }),
      booking({
        id: "b2",
        bookingNumber: "SP-B2",
        passengerName: "Benson",
        billingAccountId: EDUGUARD.id,
        billingAccountName: "EDUGUARD",
        actualFare: 95,
        pickupTime: "2026-11-05T09:00:00",
      }),
      booking({
        id: "j1",
        bookingNumber: "SP-J1",
        passengerName: "Joyce",
        billingAccountId: EDUGUARD.id,
        billingAccountName: "EDUGUARD",
        actualFare: 110,
        pickupTime: "2026-11-08T09:00:00",
      }),
      booking({
        id: "j2",
        bookingNumber: "SP-J2",
        passengerName: "Joyce",
        billingAccountId: EDUGUARD.id,
        billingAccountName: "EDUGUARD",
        actualFare: 80,
        pickupTime: "2026-11-12T09:00:00",
      }),
    ];

    const units = listReadyBillableUnits(trips, [EDUGUARD, DCRB]);
    expect(units).toHaveLength(4);
    expect(selectionTotalPounds(units)).toBe(405);

    const draft = buildAccountInvoiceDraft(EDUGUARD, units);
    expect(draft.clientId).toBe(EDUGUARD.id);
    expect(draft.lines).toHaveLength(4);
    expect(draft.lines.every((line) => /Benson|Joyce/.test(line.description))).toBe(true);
    expect(draft.billingLineKeys.sort()).toEqual(["b1", "b2", "j1", "j2"]);
  });

  it("bills Daniel trips to DCRB and blocks a Daniel booking with no fare", () => {
    const withFare = booking({
      id: "d1",
      bookingNumber: "SP-D1",
      passengerName: "Daniel Crouch",
      hirerName: "Daniel Crouch",
      billingAccountId: DCRB.id,
      billingAccountName: "DCRB",
      actualFare: 235,
    });
    const noFare = booking({
      id: "d2",
      bookingNumber: "SP-D2",
      passengerName: "Daniel Crouch",
      hirerName: "Daniel Crouch",
      billingAccountId: DCRB.id,
      billingAccountName: "DCRB",
      actualFare: 0,
    });

    const ready = assessAccountBooking(withFare, [DCRB]);
    const blocked = assessAccountBooking(noFare, [DCRB]);
    expect(ready.ready).toBe(true);
    expect(ready.units[0].farePounds).toBe(235);
    expect(blocked.ready).toBe(false);
    expect(blocked.blockedUnits[0].reason).toBe("missing_fare");
  });

  it("blocks future incomplete trips and legacy names without a saved client id", () => {
    const future = booking({
      id: "f1",
      bookingNumber: "SP-F1",
      status: "confirmed",
      billingAccountId: EDUGUARD.id,
      billingAccountName: "EDUGUARD",
      actualFare: 50,
      pickupTime: "2026-12-20T09:00:00",
    });
    const legacy = booking({
      id: "l1",
      bookingNumber: "SP-L1",
      billingAccountName: "EDUGUARD",
      actualFare: 50,
    });

    expect(assessAccountBooking(future, [EDUGUARD]).blockedUnits[0].reason).toBe("not_complete");
    expect(assessAccountBooking(legacy, [EDUGUARD]).blockedUnits[0].reason).toBe("missing_client");
  });

  it("waits for combined return completion but allows split legs separately", () => {
    const combined = booking({
      id: "r1",
      bookingNumber: "SP-R1",
      billingAccountId: EDUGUARD.id,
      billingAccountName: "EDUGUARD",
      actualFare: 200,
      bookingType: "return",
      returnTrip: true,
      returnPickupTime: "2026-11-03T18:00:00",
      outboundStatus: "completed",
      returnStatus: "confirmed",
      status: "allocated",
    });
    const split = booking({
      id: "r2",
      bookingNumber: "SP-R2",
      billingAccountId: EDUGUARD.id,
      billingAccountName: "EDUGUARD",
      actualFare: 200,
      dueOnOutbound: 120,
      dueOnReturn: 80,
      bookingType: "return",
      returnTrip: true,
      returnPickupTime: "2026-11-03T18:00:00",
      outboundStatus: "completed",
      returnStatus: "confirmed",
      status: "allocated",
    });

    expect(assessAccountBooking(combined, [EDUGUARD]).blockedUnits[0].reason).toBe(
      "combined_return_incomplete"
    );
    const splitAssessment = assessAccountBooking(split, [EDUGUARD]);
    expect(splitAssessment.units).toHaveLength(1);
    expect(splitAssessment.units[0].key).toBe("r2:outbound");
    expect(splitAssessment.units[0].farePounds).toBe(120);
  });

  it("keeps draft keys free until an invoice is issued, then blocks a second attempt", () => {
    const unit = listReadyBillableUnits(
      [
        booking({
          id: "b1",
          bookingNumber: "SP-B1",
          billingAccountId: EDUGUARD.id,
          billingAccountName: "EDUGUARD",
          actualFare: 100,
        }),
      ],
      [EDUGUARD]
    )[0];

    const abandonedDraftKeys = invoicedKeysFromHistory([
      { invoiceNumber: "PENDING", needsServerNumber: true, billingLineKeys: ["b1"] },
    ]);
    expect(filterUnitsNotAlreadyInvoiced([unit], abandonedDraftKeys).allowed).toEqual([unit]);

    const issuedKeys = invoicedKeysFromHistory([
      { invoiceNumber: "ST-EDU-202611-001", billingLineKeys: ["b1"] },
    ]);
    expect(filterUnitsNotAlreadyInvoiced([unit], issuedKeys).blocked).toEqual([unit]);
  });
});
