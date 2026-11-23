import { buildBulkContactPatch } from "./customerContactPatch";
import type { Booking } from "../types/types";

test("bulk contact patch bumps revision so staff updates pass Firestore rules", () => {
  const booking = {
    id: "b1",
    hirerName: "Old Name",
    hirerPhone: "07000000000",
    email: "old@example.com",
    source: "admin",
    revision: 3,
  } as Booking;

  const patch = buildBulkContactPatch("New Name", "+447700900123", "new@example.com", booking);
  expect(patch).toEqual({
    hirerName: "New Name",
    hirerPhone: "+447700900123",
    email: "new@example.com",
    hirerEmail: "new@example.com",
    revision: 4,
  });
});

test("customer-app bookings also sync name and phone fields", () => {
  const booking = {
    id: "b2",
    uid: "user123",
    hirerName: "Portal User",
    hirerPhone: "07000000001",
    email: "portal@example.com",
    source: "customer_app",
    revision: 0,
  } as Booking;

  const patch = buildBulkContactPatch("Portal User", "07000000001", "portal@example.com", booking);
  expect(patch.revision).toBe(1);
  expect(patch.name).toBe("Portal User");
  expect(patch.phone).toBe("07000000001");
});
