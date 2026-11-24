import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../js/office-jobs-present.js");
const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
const hub = context.globalThis.SpiresDriverHub;
const sample = hub.previewBundle();
const now = sample.now;
const lists = { drivers: sample.drivers, vehicles: sample.vehicles };

function job(id, leg) {
  const booking = sample.bookings.find((row) => row.id === id);
  return hub.expandJobs(booking).find((row) => row.leg === (leg || "outbound"));
}

function shown(id, leg) {
  return hub.presentJob(job(id, leg), lists, now);
}

assert.equal(hub.isCompleted({ status: "paid", adminStatus: "paid", customerStatus: "paid" }), false);
assert.equal(hub.nextTitle(""), "Next shared journey");
assert.equal(hub.nextTitle("sam"), "Next assigned journey");

const next = hub.nextJourney(sample.bookings, now, "");
assert.equal(next.booking.id, "overdue");
assert.equal(shown("overdue").remaining, "Overdue");
assert.equal(shown("overdue").passengers, "Passengers unknown");
assert.equal(shown("overdue").luggage, "Luggage unknown");
assert.equal(shown("overdue").collect.kind, "collect");
assert.match(shown("overdue").collect.title, /Amount to collect on this leg/);
assert.equal(hub.selectJobs(sample.bookings, "completed", now, "").some((row) => row.booking.id === "overdue"), false);
assert.equal(hub.selectJobs(sample.bookings, "today", now, "").some((row) => row.booking.id === "archive"), false);
assert.equal(hub.selectJobs(sample.bookings, "upcoming", now, "").some((row) => row.booking.id === "archive"), false);
assert.equal(hub.nextJourney(sample.bookings, now, "").booking.id === "archive", false);
assert.equal(hub.selectJobs(sample.bookings, "completed", now, "").some((row) => row.booking.id === "done"), true);

const standard = shown("standard");
assert.equal(standard.driverName, "Sam Test");
assert.equal(standard.registration, "TE57 OUT");
assert.equal(standard.allocation.label, "Allocated to Sam Test");
assert.equal(standard.collect.kind, "collect");
assert.match(standard.collect.title, /£18\.00/);

const exec = shown("exec");
assert.equal(exec.driverName, "Unassigned");
assert.equal(exec.registration, "No vehicle recorded");
assert.match(exec.allocation.label, /Awaiting availability/);
assert.equal(exec.flight, null);

const air = shown("air");
assert.equal(air.flight.flight, "BA249");
assert.equal(air.flight.terminal, "5");
assert.match(air.landingNote, /lands at 18:40/);
assert.match(air.landingNote, /Driver pickup is 17:20/);
assert.match(air.warning, /terminal 3/);
assert.equal(air.notes.length, 1);

const outbound = shown("return-job", "outbound");
const inbound = shown("return-job", "return");
assert.equal(outbound.flight, null);
assert.equal(inbound.flight.flight, "BA460");
assert.equal(inbound.driverName, "Alex Test");
assert.equal(inbound.registration, "TE57 RET");
assert.equal(outbound.driverName, "Sam Test");
assert.equal(hub.legCompleted(job("return-job", "outbound").booking, "outbound"), true);
assert.equal(hub.legCompleted(job("return-job", "return").booking, "return"), false);

assert.equal(shown("stops").extraStops, "1 extra stop");
assert.equal(shown("stops").stops.length, 3);
assert.equal(shown("paid").collect.kind, "paid");
assert.match(shown("paid").collect.title, /Already paid/);
assert.equal(shown("collect").collect.kind, "collect");
assert.equal(shown("collect").collect.text, "Collect £45.00 on this leg.");
assert.equal(shown("collect").collect.amountToCollectPence, 4500);
assert.equal(shown("collect").collect.text.includes("180"), false);
assert.equal(shown("return-job", "outbound").collect.kind, "office");
assert.match(shown("return-job", "outbound").collect.title, /Check with the office/);
assert.equal(shown("return-job", "return").collect.kind, "collect");
assert.equal(shown("return-job", "return").collect.amountToCollectPence, 4000);

const depositJob = {
  id: "deposit",
  status: "allocated",
  pickupTime: "2026-11-16T12:00:00",
  dateTime: "2026-11-16T12:00:00",
  pickupLocation: "Oxford",
  destination: "Heathrow",
  driverId: "sam",
  vehicleId: "car-out",
  vehicleType: "standard",
  actualFare: 235,
  depositRequired: true,
  depositAmount: 35,
  depositStatus: "paid",
  amountReceivedPence: 3500,
  paymentEntries: [{ kind: "deposit", amountPence: 3500, mode: "add" }],
  paymentStatus: "partial",
  paymentMethod: "cash",
};
assert.equal(hub.collectInstruction(depositJob, "outbound").amountToCollectPence, 20000);
assert.match(hub.collectInstruction(depositJob, "outbound").title, /£200\.00/);

const accountJob = { ...depositJob, id: "account", paymentMethod: "account", depositRequired: false, depositStatus: "", amountReceivedPence: 0, paymentEntries: [] };
assert.equal(hub.collectInstruction(accountJob, "outbound").kind, "account");
assert.match(hub.collectInstruction(accountJob, "outbound").title, /On account/);
assert.equal(shown("done").remaining, "Completed");
assert.equal(shown("done").overdue, false);
assert.equal(hub.nextJourney(sample.bookings.filter((row) => row.id === "exec"), now, ""), null);

const oneWay = {
  id: "one",
  status: "confirmed",
  adminStatus: "confirmed",
  customerStatus: "confirmed",
  pickupTime: "2026-11-15T16:00:00",
  dateTime: "2026-11-15T16:00:00",
  pickupLocation: "Oxford",
  destination: "Heathrow Terminal 5",
  driverId: "sam",
  vehicleId: "car-out",
  vehicleType: "standard",
  actualFare: 92,
  paymentStatus: "pending",
  amountReceivedPence: 0,
  revision: 3,
  stops: [{ type: "pickup", address: "Oxford" }],
};
const trip = {
  id: "ret",
  bookingType: "return",
  status: "allocated",
  adminStatus: "allocated",
  pickupTime: "2026-11-15T16:40:00",
  dateTime: "2026-11-15T16:40:00",
  returnPickupTime: "2026-11-15T20:15:00",
  pickupLocation: "Oxford",
  destination: "Heathrow",
  returnPickupLocation: "Heathrow",
  returnDestination: "Oxford",
  driverId: "sam",
  returnDriverId: "alex",
  vehicleId: "car-out",
  returnVehicleId: "car-ret",
  actualFare: 290,
  paymentStatus: "pending",
  revision: 1,
};
const cancelled = { ...oneWay, id: "cx", status: "cancelled", customerStatus: "cancelled" };
const unassigned = { ...oneWay, id: "open", driverId: "" };

assert.equal(hub.canMarkCompleted(oneWay, "outbound"), true);
assert.equal(hub.presentJob(hub.expandJobs(oneWay)[0], lists, now).statusLabel, "Confirmed");
assert.equal(hub.canMarkCompleted(cancelled, "outbound"), false);
assert.equal(hub.canMarkCompleted(unassigned, "outbound"), false);
assert.equal(hub.completionUpdate(cancelled, "outbound", "sam").ok, false);

const first = hub.completionUpdate(oneWay, "outbound", "sam");
assert.equal(first.ok, true);
assert.equal(first.update.status, "completed");
assert.equal(first.update.adminStatus, "completed");
assert.equal(first.update.outboundStatus, "completed");
assert.equal(first.update.customerStatus, "completed");
assert.equal(first.update.revision, 4);
assert.equal(first.update.actualFare, undefined);
assert.equal(first.update.paymentStatus, undefined);
assert.equal(first.update.driverId, undefined);
const savedOne = hub.applyStatusUpdate(oneWay, first.update);
for (const key of first.unchanged) assert.equal(savedOne[key], oneWay[key]);
assert.equal(hub.presentJob(hub.expandJobs(savedOne)[0], lists, now).statusLabel, "Completed");
assert.equal(hub.selectJobs([savedOne], "completed", now, "").length, 1);
assert.equal(hub.selectJobs([savedOne], "today", now, "").length, 0);
assert.equal(hub.completionUpdate(savedOne, "outbound", "sam").ok, false);
const failed = oneWay;
assert.equal(failed.status, "confirmed");
const officeCopy = { ...oneWay, revision: 8 };
assert.notEqual(first.update.revision, Number(officeCopy.revision) + 1);

const outboundSave = hub.completionUpdate(trip, "outbound", "sam");
const afterOutbound = hub.applyStatusUpdate(trip, outboundSave.update);
assert.equal(afterOutbound.outboundStatus, "completed");
assert.equal(afterOutbound.returnStatus, "allocated");
assert.equal(afterOutbound.status, "allocated");
assert.equal(afterOutbound.actualFare, 290);
assert.equal(afterOutbound.returnDriverId, "alex");
assert.equal(hub.legCompleted(afterOutbound, "outbound"), true);
assert.equal(hub.legCompleted(afterOutbound, "return"), false);
assert.equal(hub.selectJobs([afterOutbound], "completed", now, "").some((row) => row.leg === "return"), false);
assert.equal(hub.selectJobs([afterOutbound], "today", now, "").some((row) => row.leg === "return"), true);
assert.equal(hub.presentJob(hub.expandJobs(afterOutbound).find((row) => row.leg === "return"), lists, now).statusLabel, "Allocated");

const returnSave = hub.completionUpdate(afterOutbound, "return", "alex");
const afterReturn = hub.applyStatusUpdate(afterOutbound, returnSave.update);
assert.equal(afterReturn.returnStatus, "completed");
assert.equal(afterReturn.outboundStatus, "completed");
assert.equal(afterReturn.status, "completed");
assert.equal(afterReturn.adminStatus, "completed");
assert.equal(afterReturn.actualFare, 290);
assert.equal(afterReturn.pickupLocation, "Oxford");
assert.equal(hub.presentJob(hub.expandJobs(afterReturn).find((row) => row.leg === "return"), lists, now).statusLabel, "Completed");

const undone = hub.reopenUpdate(afterReturn, "return", "office");
assert.equal(undone.ok, true);
assert.equal(undone.update.returnStatus, "allocated");
assert.equal(undone.update.outboundStatus, "completed");
assert.equal(undone.update.status, "allocated");
assert.equal(undone.update.actualFare, undefined);

const displayJob = {
  id: "account-display",
  status: "allocated",
  pickupTime: "2026-11-15T16:40:00",
  dateTime: "2026-11-15T16:40:00",
  pickupLocation: "The Randolph Hotel, Beaumont Street, Oxford",
  destination: "Oxford Railway Station",
  driverId: "sam",
  vehicleId: "car-out",
  vehicleType: "standard",
  hirerName: "Company Contact",
  passengerName: "Guest Traveller",
  billingAccountName: "Randolph Accounts",
  pickupPlace: { label: "The Randolph Hotel", latitude: 51.75499, longitude: -1.259782 },
  stops: [{ type: "pickup", address: "The Randolph Hotel", notes: "Main entrance on Beaumont Street" }],
};
const accountView = hub.presentJob(hub.expandJobs(displayJob)[0], lists, now);
assert.equal(accountView.customer, "Guest Traveller");
assert.equal(accountView.billingAccount, "Randolph Accounts");
assert.equal(accountView.meetingInstructions, "Main entrance on Beaumont Street");
assert.equal(accountView.pickupLabel, "Pickup");
assert.equal(accountView.dropOffLabel, "Drop off");
assert.match(accountView.mapLink, /google\.com\/maps\?q=51\.75499/);

console.log("driver hub presentation ok");
