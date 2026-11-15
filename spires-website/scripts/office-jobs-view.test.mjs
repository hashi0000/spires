import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/office-jobs-present.js"), "utf8"), context);
const hub = context.globalThis.SpiresDriverHub;
const page = fs.readFileSync(path.join(root, "js/office-jobs.js"), "utf8");

const completedOpenReturn = {
  status: "completed",
  adminStatus: "completed",
  customerStatus: "completed",
  bookingType: "return",
  returnTrip: true,
  openReturn: true,
  returnPickupTime: "",
  returnDateTime: "",
};

assert.equal(hub.isCompleted(completedOpenReturn), true);
assert.equal(hub.isCompleted({ status: "paid", adminStatus: "paid", customerStatus: "paid" }), false);
assert.equal(hub.hasReturn(completedOpenReturn), true);
assert.match(page, /revision: Number\(existing\.revision \|\| 0\) \+ 1/);
assert.match(page, /source: "family"/);
assert.equal(page.includes("outstandingPence"), false);
console.log("office jobs completed filter ok");
