import fs from "fs";
const p = "spires-admin-fresh/src/hooks/useFirebase.ts";
let s = fs.readFileSync(p, "utf8");
if (s.includes("from '../utils/bookingNumber'")) {
  console.log("already has import");
  process.exit(0);
}
s = s.replace(
  "import { normalizeBooking } from '../utils/bookingMapper';",
  "import { normalizeBooking } from '../utils/bookingMapper';\nimport { generateSpiresBookingNumber } from '../utils/bookingNumber';"
);
fs.writeFileSync(p, s);
console.log("fixed");
