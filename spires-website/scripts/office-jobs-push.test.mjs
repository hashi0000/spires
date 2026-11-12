import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "js/office-jobs.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "office-jobs-sw.js"), "utf8");

assert.match(page, /saveFamilyPushSubscription/);
assert.match(page, /userVisibleOnly: true/);
assert.match(page, /Allow job alerts to hear about a new job/);
assert.equal(page.includes("hirerPhone"), true);
assert.equal(page.includes("gclid"), false);
assert.match(worker, /addEventListener\("push"/);
assert.match(worker, /showNotification/);
assert.match(worker, /notificationclick/);
console.log("family push client checks passed");
