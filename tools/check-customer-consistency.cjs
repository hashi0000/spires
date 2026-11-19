/**
 * Customer-facing consistency gate for website builds and agents.
 * Runs waiting-policy scan, shared-config drift check, then prints review notes.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const steps = [
  "check-waiting-policy.cjs",
  "check-shared-policy-drift.cjs",
];

let failed = false;
for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const result = spawnSync(process.execPath, [path.join(root, "tools", step)], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
console.log("\nCustomer consistency checks passed.");
