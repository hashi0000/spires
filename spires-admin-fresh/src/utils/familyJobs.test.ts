import { Booking } from "../types/types";
import {
  bookingInView,
  buildFamilyCancelPayload,
  buildFamilyCreatePayload,
  buildFamilyUpdatePayload,
  emptyFamilyJobDraft,
  familyVehicleLabel,
  filterFamilyJobs,
  findJobConflicts,
  validateFamilyJobDraft,
  whatsappHref,
} from "./familyJobs";
import { isFamilyStaffEmail as staffCheck } from "./staffAccess";

jest.mock("./bookingNumber", () => ({
  generateSpiresBookingNumber: () => "SP123456",
}));

function job(partial: Partial<Booking> & Pick<Booking, "id">): Booking {
  return {
    bookingNumber: partial.bookingNumber || "SP1",
    dateTime: partial.pickupTime || partial.dateTime || "",
    hirerName: partial.hirerName || "Sam",
    hirerAddress: "",
    hirerPhone: partial.hirerPhone || "07776897772",
    bookingMethod: "telephone",
    pickupTime: partial.pickupTime || "",
    pickupLocation: partial.pickupLocation || "Oxford",
    destination: partial.destination || "Heathrow",
    status: partial.status || "confirmed",
    ...partial,
  } as Booking;
}

describe("family job helpers", () => {
  it("requires the mobile quick add fields only", () => {
    const draft = emptyFamilyJobDraft();
    expect(validateFamilyJobDraft(draft)).toMatch(/pickup location/i);
    draft.pickupLocation = "Marston";
    draft.destination = "Heathrow T5";
    draft.pickupDate = "2026-10-16";
    draft.pickupTime = "08:30";
    draft.hirerName = "Alex";
    draft.hirerPhone = "07776897772";
    expect(validateFamilyJobDraft(draft)).toBeNull();
  });

  it("never treats fare, driver or notes as required", () => {
    const draft = {
      ...emptyFamilyJobDraft(),
      pickupLocation: "Oxford",
      destination: "Gatwick",
      pickupDate: "2026-10-16",
      pickupTime: "09:00",
      hirerName: "Jordan",
      hirerPhone: "07700 900123",
      vehicleType: "standard" as const,
    };
    expect(validateFamilyJobDraft(draft)).toBeNull();
  });

  it("labels family vehicle choices in British English", () => {
    expect(familyVehicleLabel("standard")).toBe("Standard car");
    expect(familyVehicleLabel("8_seater")).toBe("Mercedes Vito");
    expect(familyVehicleLabel("multiple")).toBe("Multiple vehicles");
  });

  it("builds a WhatsApp link for UK numbers", () => {
    expect(whatsappHref("07776 897772")).toBe("https://wa.me/447776897772");
  });

  it("filters today and hides cancelled jobs by default", () => {
    const now = new Date(2026, 9, 16, 10, 0, 0);
    const today = job({
      id: "a",
      pickupTime: new Date(2026, 9, 16, 12, 0, 0).toISOString(),
      status: "confirmed",
    });
    const cancelled = job({
      id: "b",
      pickupTime: new Date(2026, 9, 16, 13, 0, 0).toISOString(),
      status: "cancelled",
    });
    const tomorrow = job({
      id: "c",
      pickupTime: new Date(2026, 9, 17, 9, 0, 0).toISOString(),
      status: "confirmed",
    });
    const rows = filterFamilyJobs([today, cancelled, tomorrow], { view: "today", now });
    expect(rows.map((row) => row.id)).toEqual(["a"]);
  });

  it("places a booking in the week view", () => {
    const now = new Date(2026, 9, 16, 8, 0, 0);
    const later = job({
      id: "w",
      pickupTime: new Date(2026, 9, 20, 15, 0, 0).toISOString(),
      status: "allocated",
    });
    expect(bookingInView(later, "week", now)).toBe(true);
    expect(bookingInView(later, "today", now)).toBe(false);
  });

  it("flags overlapping jobs for the same driver", () => {
    const left = job({
      id: "1",
      driverId: "d1",
      pickupTime: "2026-10-16T08:00:00.000Z",
      status: "allocated",
    });
    const right = job({
      id: "2",
      driverId: "d1",
      pickupTime: "2026-10-16T08:30:00.000Z",
      status: "allocated",
    });
    const conflicts = findJobConflicts([left, right]);
    expect(conflicts.some((row) => row.reason === "driver")).toBe(true);
  });

  it("flags overlapping Mercedes Vito jobs even without a vehicle id", () => {
    const left = job({
      id: "v1",
      vehicleType: "8_seater",
      pickupTime: "2026-10-16T08:00:00.000Z",
      status: "confirmed",
    });
    const right = job({
      id: "v2",
      vehicleType: "8_seater",
      pickupTime: "2026-10-16T08:20:00.000Z",
      status: "confirmed",
    });
    expect(findJobConflicts([left, right]).some((row) => row.reason === "vehicle")).toBe(true);
  });

  it("includes website bookings that have no family source field", () => {
    const now = new Date(2026, 9, 16, 10, 0, 0);
    const web = job({
      id: "web-1",
      pickupTime: new Date(2026, 9, 16, 14, 0, 0).toISOString(),
      status: "pending",
      uid: "customer-uid",
    });
    const rows = filterFamilyJobs([web], { view: "today", now });
    expect(rows.map((row) => row.id)).toEqual(["web-1"]);
  });

  it("does not treat different drivers as a conflict", () => {
    const left = job({
      id: "1",
      driverId: "d1",
      pickupTime: "2026-10-16T08:00:00.000Z",
      status: "allocated",
    });
    const right = job({
      id: "2",
      driverId: "d2",
      pickupTime: "2026-10-16T08:30:00.000Z",
      status: "allocated",
    });
    expect(findJobConflicts([left, right])).toEqual([]);
  });

  it("creates family jobs on the shared bookings collection shape", () => {
    const payload = buildFamilyCreatePayload(
      {
        ...emptyFamilyJobDraft(),
        pickupLocation: "Oxford Station",
        destination: "Heathrow T5",
        pickupDate: "2026-10-16",
        pickupTime: "07:00",
        hirerName: "Alex",
        hirerPhone: "07776897772",
        vehicleType: "8_seater",
      },
      "2026-10-16T06:00:00.000Z",
      { uid: "u1", email: "hashim@spires.com" }
    );
    expect(payload.bookingNumber).toBe("SP123456");
    expect(payload.source).toBe("family");
    expect(payload.bookingMethod).toBe("telephone");
    expect(payload.status).toBe("confirmed");
    expect(payload.uid).toBeUndefined();
    expect(payload.pickupLocation).toBe("Oxford Station");
  });

  it("soft cancels and records who cancelled", () => {
    const payload = buildFamilyCancelPayload(
      job({ id: "x", uid: "customer-1", status: "confirmed" }),
      { uid: "staff", email: "hashim@spires.com" }
    );
    expect(payload.status).toBe("cancelled");
    expect(payload.customerStatus).toBe("cancelled");
    expect(payload.cancelledByEmail).toBe("hashim@spires.com");
  });

  it("keeps a website booking pending when still unassigned", () => {
    const payload = buildFamilyUpdatePayload(
      job({ id: "web", status: "pending", uid: "cust" }),
      {
        ...emptyFamilyJobDraft(),
        pickupLocation: "Didcot",
        destination: "Luton",
        pickupDate: "2026-10-16",
        pickupTime: "11:00",
        hirerName: "Pat",
        hirerPhone: "07700 900000",
        vehicleType: "standard",
      },
      "2026-10-16T10:00:00.000Z",
      { uid: "staff", email: "hashim@spires.com" }
    );
    expect(payload.status).toBe("pending");
  });
});

describe("family staff allow list", () => {
  it("allows the existing office accounts", () => {
    expect(staffCheck("hashim@spires.com")).toBe(true);
    expect(staffCheck("spirestaxis24@gmail.com")).toBe(true);
    expect(staffCheck("stranger@example.com")).toBe(false);
  });
});

