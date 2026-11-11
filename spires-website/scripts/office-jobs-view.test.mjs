import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../js/office-jobs.js"),
  "utf8"
);

function take(name) {
  const start = source.indexOf("function " + name);
  assert.notEqual(start, -1, name);
  let depth = 0;
  let seen = false;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      seen = true;
    } else if (source[i] === "}") {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("Could not read " + name);
}

const isCompleted = new Function("return " + take("isCompleted"))();
const hasReturn = new Function("textOf", "return " + take("hasReturn"))(function (booking, keys) {
  for (const key of keys) {
    if (typeof booking[key] === "string" && booking[key].trim()) return booking[key].trim();
  }
  return "";
});

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

assert.equal(isCompleted(completedOpenReturn), true);
assert.equal(hasReturn(completedOpenReturn), true);
assert.match(source, /view === "completed" \|\| !isCompleted\(row\)/);
assert.match(source, /!isCancelled\(row\) && !isCompleted\(row\)/);
console.log("office jobs completed filter ok");
