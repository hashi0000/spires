import fs from "fs";
const p = "spires-admin-fresh/src/App.tsx";
let s = fs.readFileSync(p, "utf8");
if (s.includes("const bookingLocationSuggestions = useMemo")) {
  console.log("useMemo block present");
  process.exit(0);
}
const needle = `  const driverLimitCheck = useDriverLimitCheck(driversHook.drivers);
  
  const [showDriverModal, setShowDriverModal] = useState(false);`;
const insert = `  const driverLimitCheck = useDriverLimitCheck(driversHook.drivers);

  const bookingLocationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const b of bookingsHook.bookings) {
      const pickup = (b.pickupLocation || '').trim();
      const dest = (b.destination || '').trim();
      if (pickup.length > 0) seen.add(pickup);
      if (dest.length > 0) seen.add(dest);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [bookingsHook.bookings]);

  const [showDriverModal, setShowDriverModal] = useState(false);`;
if (!s.includes(needle)) {
  console.error("needle not found");
  process.exit(1);
}
s = s.replace(needle, insert);
fs.writeFileSync(p, s);
console.log("inserted");
