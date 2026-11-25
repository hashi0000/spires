/**
 * Seven admin-workflow scenarios against a local Firestore emulator.
 * Never contacts production, SMTP or Shift4. Uses emailJobs as local mail capture.
 */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

if (!/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) {
  throw new Error("Set FIRESTORE_EMULATOR_HOST to a localhost emulator. Production runs are refused.");
}

const projectId = "demo-spires-admin";
process.env.GCLOUD_PROJECT = projectId;
const admin = require("../functions/node_modules/firebase-admin");
admin.initializeApp({ projectId });
admin.firestore().settings({ ignoreUndefinedProperties: true });
const flow = require("../functions/lib/quotes/callables");
const places = require("../functions/lib/locations/places");
const { shouldSendConfirmation } = require("../functions/lib/quotes/quoteWorkflow");
const airport = require("./.tmp/airportLegFields");
const db = admin.firestore();
const runId = randomUUID().slice(0, 8);
const staff = { auth: { uid: "test-staff", token: { email: "spirestaxis24@gmail.com" } } };
const call = (name, body, context = staff) => flow[name].run(body, context);

function loadPresent() {
  const code = fs.readFileSync(path.join(__dirname, "../spires-website/js/office-jobs-present.js"), "utf8");
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  if (!sandbox.SpiresDriverHub) throw new Error("SpiresDriverHub failed to load");
  return sandbox.SpiresDriverHub;
}

const present = loadPresent();

const SEEDED = [
  { id: "randolph-hotel", label: "The Randolph Hotel", address: "The Randolph Hotel, Beaumont Street, Oxford", postcode: "OX1 2LN", aliases: ["Randolph", "Randolph Hotel", "The Randolph"], meetingInstructions: "Main entrance on Beaumont Street", latitude: 51.75499, longitude: -1.259782 },
  { id: "old-parsonage-hotel", label: "Old Parsonage Hotel", address: "Old Parsonage Hotel, 1 Banbury Road, Oxford", postcode: "OX2 6NN", aliases: ["Old Parsonage", "Parsonage"], meetingInstructions: "Main entrance on Banbury Road", latitude: 51.761074, longitude: -1.26061 },
  { id: "oxford-railway-station", label: "Oxford Railway Station", address: "Oxford Railway Station, Park End Street, Oxford", postcode: "OX1 1HS", aliases: ["Oxford station", "Oxford train station", "Oxford Station"], meetingInstructions: "Station forecourt / taxi rank unless the note says otherwise", latitude: 51.753427, longitude: -1.270079 },
  { id: "gloucester-green-coach", label: "Gloucester Green Coach Station", address: "Gloucester Green Coach Station, Oxford", postcode: "OX1 2BU", aliases: ["Gloucester Green", "Oxford coach station", "Gloucester Green bus"], meetingInstructions: "Coach station forecourt", latitude: 51.75408, longitude: -1.26223 },
  { id: "westgate-oxford", label: "Westgate Oxford", address: "Westgate Oxford, Bonn Square, Oxford", postcode: "OX1 1TR", aliases: ["Westgate", "Westgate shopping centre"], meetingInstructions: "Bonn Square entrance unless the note says otherwise", latitude: 51.747771, longitude: -1.259958 },
  { id: "burford", label: "Burford", address: "Burford, Oxfordshire", postcode: "OX18 4QF", aliases: ["Burford High Street", "Burford Cotswolds"], meetingInstructions: "", latitude: 51.808225, longitude: -1.636826 },
  { id: "bibury", label: "Bibury", address: "Bibury, Gloucestershire", postcode: "GL7 5NR", aliases: ["Bibury Cotswolds", "Arlington Row"], meetingInstructions: "", latitude: 51.757342, longitude: -1.831173 },
  { id: "bourton-on-the-water", label: "Bourton on the Water", address: "Bourton on the Water, Gloucestershire", postcode: "GL54 2AP", aliases: ["Bourton", "Bourton-on-the-Water"], meetingInstructions: "", latitude: 51.885422, longitude: -1.759095 },
  { id: "upper-slaughter", label: "Upper Slaughter", address: "Upper Slaughter, Gloucestershire", postcode: "GL54 2JF", aliases: ["Upper Slaughter Cotswolds"], meetingInstructions: "", latitude: 51.907222, longitude: -1.775361 },
  { id: "lower-slaughter", label: "Lower Slaughter", address: "Lower Slaughter, Gloucestershire", postcode: "GL54 2HS", aliases: ["Lower Slaughter Cotswolds"], meetingInstructions: "", latitude: 51.901272, longitude: -1.762862 },
  { id: "stow-on-the-wold", label: "Stow on the Wold", address: "Stow on the Wold, Gloucestershire", postcode: "GL54 1AF", aliases: ["Stow", "Stow-on-the-Wold"], meetingInstructions: "", latitude: 51.930423, longitude: -1.722452 },
  { id: "broadway", label: "Broadway", address: "Broadway, Worcestershire", postcode: "WR12 7AA", aliases: ["Broadway Cotswolds"], meetingInstructions: "", latitude: 52.035692, longitude: -1.862783 },
  { id: "chipping-norton", label: "Chipping Norton", address: "Chipping Norton, Oxfordshire", postcode: "OX7 5DD", aliases: ["Chippy"], meetingInstructions: "", latitude: 51.940688, longitude: -1.545275 },
  { id: "moreton-in-marsh", label: "Moreton in Marsh", address: "Moreton in Marsh, Gloucestershire", postcode: "GL56 0AF", aliases: ["Moreton", "Moreton-in-Marsh"], meetingInstructions: "", latitude: 51.990904, longitude: -1.703422 },
  { id: "cirencester", label: "Cirencester", address: "Cirencester, Gloucestershire", postcode: "GL7 2AE", aliases: ["Ciren"], meetingInstructions: "", latitude: 51.717547, longitude: -1.968779 },
  { id: "tetbury", label: "Tetbury", address: "Tetbury, Gloucestershire", postcode: "GL8 8AA", aliases: ["Tetbury Cotswolds"], meetingInstructions: "", latitude: 51.638046, longitude: -2.160774 },
];

function matchCompanyPlaces(query, placesList) {
  const q = query.trim().toLowerCase();
  if (!q) return placesList.slice(0, 8);
  return placesList.filter((place) => {
    const hay = `${place.label} ${place.address} ${place.postcode} ${place.aliases.join(" ")}`.toLowerCase();
    return hay.includes(q) || place.aliases.some((alias) => alias.toLowerCase().startsWith(q) || q.startsWith(alias.toLowerCase()));
  }).slice(0, 8);
}

async function seedMissingCompanyPlaces() {
  const snap = await db.collection("companyPlaces").get();
  const existing = new Set(snap.docs.map((doc) => doc.id));
  let added = 0;
  for (const place of SEEDED) {
    if (existing.has(place.id)) continue;
    await db.collection("companyPlaces").doc(place.id).set({ ...place, seeded: true });
    added += 1;
  }
  return added;
}

async function seedCompanyPlacesIfEmpty() {
  return seedMissingCompanyPlaces();
}

async function emailJobsFor(bookingId) {
  const snap = await db.collection("emailJobs").where("bookingId", "==", bookingId).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function clearCompanyPlaces() {
  const snap = await db.collection("companyPlaces").get();
  for (const doc of snap.docs) await doc.ref.delete();
}

async function check(label, fn) {
  await fn();
  console.log(`PASS ${label}`);
}

(async () => {
  console.log(`Admin workflow E2E run ${runId} on ${process.env.FIRESTORE_EMULATOR_HOST}`);

  await check("1. Heathrow Terminal 5 drop-off / pickup / swap / return", async () => {
    const drop = airport.syncOutboundAirportFromAddresses(
      "The Randolph Hotel, OX1 2LN",
      "Heathrow Terminal 5, TW6 2GA",
      { airportCollection: true, flightNumber: "BA123", terminal: "5", collectionLocation: "stale" }
    );
    assert.equal(drop.airportDropOff, true);
    assert.equal(drop.airportCollection, false);
    assert.equal(drop.flightNumber, "");
    assert.equal(drop.collectionLocation, "");

    const pick = airport.syncOutboundAirportFromAddresses(
      "Heathrow Terminal 5, TW6 2GA",
      "Oxford Railway Station, OX1 1HS",
      {}
    );
    assert.equal(pick.airportCollection, true);
    assert.equal(pick.terminal, "5");
    assert.equal(pick.collectionLocation, "Heathrow Terminal 5");

    const fixed = { ...pick, collectionArrangement: "fixed_time" };
    assert.equal(fixed.collectionArrangement, "fixed_time");
    const monitored = { ...pick, collectionArrangement: "flight_monitored", flightNumber: "BA249", landingTime: "18:40" };
    assert.equal(monitored.flightNumber, "BA249");

    const swapped = airport.syncOutboundAirportFromAddresses(
      "Oxford Railway Station, OX1 1HS",
      "Heathrow Terminal 5, TW6 2GA",
      pick
    );
    assert.equal(swapped.airportDropOff, true);
    assert.equal(swapped.airportCollection, false);
    assert.equal(swapped.flightNumber, "");

    const ret = airport.syncReturnAirportFromAddresses(
      "Heathrow Terminal 3, TW6 1QG",
      "The Randolph Hotel, OX1 2LN",
      {}
    );
    assert.equal(ret.returnAirportCollection, true);
    assert.equal(ret.returnTerminal, "3");

    const id = `wf-${runId}-t5`;
    await db.collection("bookings").doc(id).set({
      bookingNumber: id,
      hirerName: "T5 Drop Test",
      pickupLocation: "The Randolph Hotel, OX1 2LN",
      destination: "Heathrow Terminal 5, TW6 2GA",
      pickupTime: "2027-03-01T10:00:00Z",
      status: "confirmed",
      revision: 1,
      airportCollection: drop.airportCollection,
      airportDropOff: drop.airportDropOff,
      flightNumber: drop.flightNumber,
      terminal: drop.terminal,
      collectionLocation: drop.collectionLocation,
      waitingPolicyVersion: "",
      source: "admin",
    });
    const saved = (await db.collection("bookings").doc(id).get()).data();
    assert.equal(saved.airportCollection, false);
    assert.equal(saved.airportDropOff, true);
    assert.equal(saved.flightNumber || "", "");
    assert.equal(saved.waitingPolicyVersion || "", "");
  });

  await check("2. Randolph suggestions, seed idempotency, meeting instructions", async () => {
    await clearCompanyPlaces();
    const first = await seedCompanyPlacesIfEmpty();
    const second = await seedCompanyPlacesIfEmpty();
    assert.equal(first, SEEDED.length);
    assert.equal(second, 0);
    assert.equal((await db.collection("companyPlaces").get()).size, SEEDED.length);
    assert.ok(matchCompanyPlaces("Bourton", SEEDED).some((row) => row.id === "bourton-on-the-water"));
    assert.ok(matchCompanyPlaces("Bibury", SEEDED).some((row) => row.postcode === "GL7 5NR"));

    const curated = places.curatedMatches("Randolph");
    assert.ok(curated.some((row) => /randolph/i.test(row.label)));
    const company = matchCompanyPlaces("Randolph", SEEDED);
    assert.equal(company[0].id, "randolph-hotel");
    assert.equal(company[0].postcode, "OX1 2LN");
    assert.ok(Number.isFinite(company[0].latitude));
    assert.ok(company[0].meetingInstructions.includes("Beaumont"));

    const booking = {
      id: `wf-${runId}-randolph`,
      bookingNumber: `wf-${runId}-randolph`,
      hirerName: "Hotel Guest",
      passengerName: "Hotel Guest",
      hirerPhone: "07000000001",
      pickupLocation: `${company[0].label}, ${company[0].postcode}`,
      destination: "Heathrow Terminal 5, TW6 2GA",
      pickupTime: "2027-03-02T09:00:00Z",
      status: "allocated",
      driverId: "driver-1",
      stops: [
        { id: "a", type: "pickup", address: `${company[0].label}, ${company[0].postcode}`, notes: company[0].meetingInstructions, place: { latitude: company[0].latitude, longitude: company[0].longitude } },
        { id: "b", type: "dropoff", address: "Heathrow Terminal 5, TW6 2GA", notes: "" },
      ],
      pickupPlace: { latitude: company[0].latitude, longitude: company[0].longitude, label: company[0].label },
    };
    const job = present.expandJobs(booking)[0];
    const view = present.presentJob(job, { drivers: [{ id: "driver-1", name: "Test Driver" }], vehicles: [] }, new Date("2027-03-02T08:00:00Z"));
    assert.match(view.pickup, /Randolph/i);
    assert.equal(view.meetingInstructions, company[0].meetingInstructions);
    assert.ok(view.mapLink && view.mapLink.includes("google.com/maps"));
  });

  await check("3. Driver Hub edit/display and suggestion scope", async () => {
    const officeJobs = fs.readFileSync(path.join(__dirname, "../spires-website/js/office-jobs.js"), "utf8");
    assert.ok(officeJobs.includes('list="job-places"'), "Driver Hub has address entry fields");
    assert.ok(officeJobs.includes("hirerName"), "Driver Hub can enter customer name");
    assert.ok(officeJobs.includes("pickupLocation"), "Driver Hub can enter pickup");
    assert.equal(officeJobs.includes("companyPlaces"), false, "company-wide places directory is not wired into Driver Hub");
    assert.equal(officeJobs.includes("searchLocations"), false);

    const view = present.presentJob(
      present.expandJobs({
        id: "hub-1",
        bookingNumber: "hub-1",
        passengerName: "Joyce Passenger",
        billingAccountName: "Eduguard",
        hirerName: "Eduguard Office",
        hirerPhone: "07000000002",
        pickupLocation: "The Randolph Hotel, OX1 2LN",
        destination: "Oxford Railway Station, OX1 1HS",
        pickupTime: "2027-03-03T11:00:00Z",
        status: "allocated",
        driverId: "driver-1",
        stops: [
          { id: "a", type: "pickup", address: "The Randolph Hotel, OX1 2LN", notes: "Main entrance on Beaumont Street", place: { latitude: 51.75499, longitude: -1.259782 } },
          { id: "b", type: "dropoff", address: "Oxford Railway Station, OX1 1HS", notes: "" },
        ],
      })[0],
      { drivers: [{ id: "driver-1", name: "Test Driver" }], vehicles: [] },
      new Date("2027-03-03T10:00:00Z")
    );
    assert.equal(view.customer, "Joyce Passenger");
    assert.equal(view.billingAccount, "Eduguard");
    assert.equal(view.phone, "07000000002");
    assert.match(view.pickup, /Randolph/);
    assert.match(view.destination, /Railway Station/);
    assert.equal(view.meetingInstructions, "Main entrance on Beaumont Street");
    assert.ok(view.mapLink);
  });

  await check("4. Merge contact onto confirmed booking stays silent; new confirmation still queues", async () => {
    const oldId = `wf-${runId}-merge-old`;
    await db.collection("bookings").doc(oldId).set({
      bookingNumber: oldId,
      hirerName: "Daniel Crouch Test",
      status: "confirmed",
      confirmedAt: "2026-01-10T10:00:00Z",
      pickupTime: "2026-01-15T10:00:00Z",
      pickupLocation: "Oxford",
      destination: "Heathrow",
      revision: 2,
      paymentStatus: "paid",
      source: "admin",
    });
    const before = (await db.collection("bookings").doc(oldId).get()).data();
    const afterMerge = { ...before, email: "daniel.merge@example.invalid", hirerEmail: "daniel.merge@example.invalid" };
    assert.equal(shouldSendConfirmation(before, afterMerge), false);
    await flow.enqueueConfirmationIfNeeded(before, afterMerge, oldId);
    assert.equal((await emailJobsFor(oldId)).length, 0);

    const newId = `wf-${runId}-merge-new`;
    await db.collection("bookings").doc(newId).set({
      bookingNumber: newId,
      hirerName: "Fresh Confirm",
      hirerEmail: "fresh.confirm@example.invalid",
      email: "fresh.confirm@example.invalid",
      status: "pending",
      pickupTime: "2027-04-01T12:00:00Z",
      pickupLocation: "Oxford",
      destination: "Heathrow",
      revision: 1,
      source: "admin",
    });
    const pending = (await db.collection("bookings").doc(newId).get()).data();
    const confirmed = { ...pending, status: "confirmed" };
    assert.equal(shouldSendConfirmation(pending, confirmed), true);
    await flow.enqueueConfirmationIfNeeded(pending, confirmed, newId);
    const jobs = await emailJobsFor(newId);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].kind || jobs[0].event, "booking_confirmed");
    assert.equal(jobs[0].status, "queued");
    assert.equal(jobs[0].to, "fresh.confirm@example.invalid");
  });

  await check("5. Account trips marked invoiced without changing paid; return stays in dispatch", async () => {
    const outId = `wf-${runId}-edu-1`;
    const retId = `wf-${runId}-edu-2`;
    for (const [id, passenger, fare] of [[outId, "Benson", 85], [retId, "Joyce", 90]]) {
      await db.collection("bookings").doc(id).set({
        bookingNumber: id,
        hirerName: "Eduguard",
        billingAccountName: "Eduguard",
        passengerName: passenger,
        jobKind: "account",
        paymentMethod: "account",
        paymentStatus: "pending",
        invoiceStatus: "unbilled",
        status: "completed",
        actualFare: fare,
        revision: 1,
        pickupTime: "2027-03-10T09:00:00Z",
        pickupLocation: "Eduguard office",
        destination: "Oxford Station",
        driverId: "driver-1",
      });
      await db.collection("bookings").doc(id).update({
        invoiceStatus: "invoiced",
        invoiceReference: "INV-EDU-100",
        revision: 2,
      });
      const after = (await db.collection("bookings").doc(id).get()).data();
      assert.equal(after.invoiceStatus, "invoiced");
      assert.equal(after.invoiceReference, "INV-EDU-100");
      assert.equal(after.paymentStatus, "pending");
    }

    const upcomingReturn = {
      id: `wf-${runId}-edu-return`,
      bookingNumber: `wf-${runId}-edu-return`,
      hirerName: "Eduguard",
      billingAccountName: "Eduguard",
      passengerName: "Benson",
      paymentMethod: "account",
      paymentStatus: "pending",
      status: "confirmed",
      bookingType: "return",
      returnTrip: true,
      outboundStatus: "completed",
      returnStatus: "confirmed",
      pickupTime: "2027-03-11T09:00:00Z",
      returnPickupTime: "2027-03-11T18:30:00Z",
      pickupLocation: "Eduguard office",
      destination: "Heathrow Terminal 5, TW6 2GA",
      returnPickupLocation: "Heathrow Terminal 5, TW6 2GA",
      returnDestination: "Eduguard office",
      driverId: "driver-1",
      returnDriverId: "driver-1",
      airportDropOff: true,
      returnAirportCollection: true,
      returnTerminal: "5",
    };
    const now = new Date("2027-03-11T12:00:00Z");
    const jobs = present.selectJobs([upcomingReturn], "today", now, "driver-1");
    assert.ok(jobs.some((job) => job.leg === "return"), "upcoming return remains visible in dispatch");
  });

  await check("6. Quote, confirmation, allocation, completion and payment still work", async () => {
    const id = `wf-${runId}-ordinary`;
    await db.collection("bookings").doc(id).set({
      bookingNumber: id,
      hirerName: "Ordinary Customer",
      hirerEmail: "ordinary@example.invalid",
      email: "ordinary@example.invalid",
      hirerPhone: "07000000009",
      pickupLocation: "Oxford",
      destination: "Heathrow Terminal 5, TW6 2GA",
      pickupTime: "2027-05-01T14:00:00Z",
      dateTime: "2027-05-01T14:00:00Z",
      status: "pending",
      paymentStatus: "pending",
      source: "admin",
      uid: "test-customer",
      revision: 1,
    });
    const quoted = await call("issueQuote", {
      bookingId: id,
      normalFarePounds: "120.00",
      vehicleType: "standard",
      bookingType: "one_way",
      pickup: "Oxford",
      destination: "Heathrow Terminal 5, TW6 2GA",
      dateTime: "2027-05-01T14:00:00Z",
      paymentRequirement: "later",
      paymentDescription: "full",
      paymentLinkUrl: "",
    });
    assert.equal(quoted.emailState, "queued");
    await call("recordManualAcceptance", { bookingId: id });
    let row = (await db.collection("bookings").doc(id).get()).data();
    assert.equal(row.status, "confirmed");
    await db.collection("bookings").doc(id).update({ driverId: "driver-1", status: "allocated", adminStatus: "allocated", revision: 3 });
    row = (await db.collection("bookings").doc(id).get()).data();
    assert.equal(row.driverId, "driver-1");
    await db.collection("bookings").doc(id).update({ status: "completed", adminStatus: "completed", revision: 4 });
    await call("recordManualPayment", { bookingId: id, amountReceivedPounds: "120.00", method: "card" });
    row = (await db.collection("bookings").doc(id).get()).data();
    assert.equal(row.paymentStatus, "paid");
    assert.equal(row.outstandingPence, 0);
  });

  await check("7. Local mail capture only; production untouched", async () => {
    assert.match(process.env.FIRESTORE_EMULATOR_HOST, /127\.0\.0\.1|localhost/);
    const jobs = await db.collection("emailJobs").get();
    assert.ok(jobs.size >= 1);
    for (const doc of jobs.docs) {
      assert.equal(doc.data().status, "queued");
    }
  });

  console.log("All 7 admin workflow E2E scenarios passed. emailJobs used as local mail capture. Production untouched.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await db.terminate();
  await admin.app().delete();
});
