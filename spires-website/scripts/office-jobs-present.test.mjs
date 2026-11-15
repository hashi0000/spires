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
assert.equal(shown("overdue").collect.text, "Confirm the amount with the office.");
assert.equal(hub.selectJobs(sample.bookings, "completed", now, "").some((row) => row.booking.id === "overdue"), false);
assert.equal(hub.selectJobs(sample.bookings, "today", now, "").some((row) => row.booking.id === "archive"), false);
assert.equal(hub.selectJobs(sample.bookings, "upcoming", now, "").some((row) => row.booking.id === "archive"), false);
assert.equal(hub.nextJourney(sample.bookings, now, "").booking.id === "archive", false);
assert.equal(hub.selectJobs(sample.bookings, "completed", now, "").some((row) => row.booking.id === "done"), true);

const standard = shown("standard");
assert.equal(standard.driverName, "Sam Test");
assert.equal(standard.registration, "TE57 OUT");
assert.equal(standard.allocation.label, "Allocated to Sam Test");
assert.equal(standard.collect.kind, "confirm");

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
assert.equal(shown("collect").collect.text, "Collect £45.00 on this leg.");
assert.equal(shown("collect").collect.text.includes("180"), false);
assert.equal(shown("done").remaining, "Completed");
assert.equal(shown("done").overdue, false);
assert.equal(hub.nextJourney(sample.bookings.filter((row) => row.id === "exec"), now, ""), null);

console.log("driver hub presentation ok");
