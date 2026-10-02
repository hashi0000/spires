"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const defaults_1 = require("./defaults");
const interestGroups_1 = require("./interestGroups");
const logic_1 = require("./logic");
const hostedPayment_1 = require("./hostedPayment");
const destinationMatching_1 = require("./destinationMatching");
const routePricing_1 = require("./routePricing");
const types_1 = require("./types");
const terminalGuide_1 = require("./terminalGuide");
function contact(name, uid = `uid_${name}`, extras = {}) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        uid,
        dropoffTerminal: "T3",
        ...extras,
    };
}
async function joinHeathrow(db, journeyId, name, key, extras = {}) {
    return (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
        action: "join",
        airportId: "heathrow",
        travelDate: "2026-10-12",
        preferredDepartureTime: "14:00",
        journeyId,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: { ...contact(name, `uid_${name}`, extras), flexibility: "plus_minus_30" },
        idempotencyKey: key,
        termsAccepted: true,
    });
}
(0, node_test_1.describe)("broader Spires Share product", () => {
    (0, node_test_1.it)("1 and 2. Existing Heathrow £35 hosted payment flow still works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        strict_1.default.equal(journey.farePence, 3500);
        strict_1.default.equal(journey.fourPassengerFallbackEnabled, true);
        for (let i = 0; i < 5; i += 1) {
            await joinHeathrow(db, journey.id, `H${i}`, `heathrow-pay-${i}xxxx`);
        }
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id);
        for (const booking of db.bookings.values()) {
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        }
        (0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
        strict_1.default.equal(db.journeys.get(journey.id)?.farePence, 3500);
    });
    (0, node_test_1.it)("3. Existing four passenger Heathrow fallback still works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        for (let i = 0; i < 4; i += 1) {
            await joinHeathrow(db, journey.id, `Four${i}`, `four-opt-${i}xxxxxxx`);
        }
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id);
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        (0, bookingFlow_1.offerFourPassengerOption)(db, journey.id);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "FOUR_PASSENGER_OPTION");
    });
    (0, node_test_1.it)("4 and 7. Generic CITY interest can be created and compatible passengers join the same group", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "South Kensington",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Ava"),
        });
        const second = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:15",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "Chelsea",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Ben"),
        });
        strict_1.default.equal(first.joinedExisting, false);
        strict_1.default.equal(second.joinedExisting, true);
        strict_1.default.equal(second.group.id, first.group.id);
        strict_1.default.equal(db.interestGroups.get(first.group.id)?.interestedSeatCount, 2);
        strict_1.default.equal(first.entry.termsVersion, types_1.SHARE_TERMS_VERSION);
    });
    (0, node_test_1.it)("5 and 6. Public sees aggregate interest only and private destinations stay private", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "South Kensington",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Cara"),
        });
        const pub = (0, bookingFlow_1.listPublicInterestGroups)(db);
        strict_1.default.equal(pub.length, 1);
        strict_1.default.equal(pub[0].origin, "Oxford");
        strict_1.default.equal(pub[0].destinationRegion, "London");
        strict_1.default.equal(pub[0].interestedSeatCount, 1);
        strict_1.default.equal((0, interestGroups_1.publicInterestHasPrivateData)(pub[0]), false);
        strict_1.default.equal("intendedDestinationText" in pub[0], false);
        strict_1.default.equal("email" in pub[0], false);
    });
    (0, node_test_1.it)("8 and 9. Waitlist is FIFO and cannot exceed capacity", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        for (let i = 0; i < 5; i += 1) {
            await joinHeathrow(db, journey.id, `Full${i}`, `wl-full-${i}xxxxxxx`);
        }
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
        (0, bookingFlow_1.cancelReservation)(db, [...db.bookings.values()][0].id);
        const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        strict_1.default.equal(offered?.email, "first@example.com");
        const second = [...db.waitlist.values()].find((row) => row.email === "second@example.com");
        strict_1.default.notEqual(second.status, "OFFERED");
        await (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, offered.uid, "2026-10-01T10:10:00.000Z");
        strict_1.default.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
        const results = await Promise.allSettled([
            (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, offered.uid, "2026-10-01T10:11:00.000Z"),
        ]);
        strict_1.default.equal(results[0].status, "rejected");
    });
    (0, node_test_1.it)("10. CITY drop off must be accepted before payment", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        const result = await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "join",
            airportId: journey.airportId,
            travelDate: journey.travelDate,
            preferredDepartureTime: journey.departureTime,
            journeyId: journey.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact("Dana"), flexibility: "plus_minus_30" },
            intendedDestinationText: "South Kensington",
            sharedDropoffAcknowledged: true,
            idempotencyKey: "city-drop-1xxxxxxx",
            termsAccepted: true,
        });
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin@example.com");
        const before = db.bookings.get(String(result.bookingId));
        strict_1.default.equal((0, destinationMatching_1.canPassengerEnterPayment)(db.journeys.get(journey.id), before), false);
        const view = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(journey.id), before, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.canAcceptSharedDropoff, true);
        strict_1.default.equal(view.paymentLinkAvailable, false);
        (0, bookingFlow_1.acceptSharedDropoff)(db, String(result.bookingId));
    });
    (0, node_test_1.it)("11-14. Heathrow passengers can specify T2/T3/T4/T5 with the correct transfer guidance", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        const t3 = await joinHeathrow(db, journey.id, "T3p", "term-t3-01xxxxxxxx", { departureTerminal: "T3", dropoffTerminal: "T3" });
        const t5 = await joinHeathrow(db, journey.id, "T5p", "term-t5-01xxxxxxxx", { departureTerminal: "T5", dropoffTerminal: "T5" });
        const t4 = await joinHeathrow(db, journey.id, "T4p", "term-t4-01xxxxxxxx", { departureTerminal: "T4", dropoffTerminal: "T4" });
        const t2 = await joinHeathrow(db, journey.id, "T2p", "term-t2-01xxxxxxxx", { departureTerminal: "T2", dropoffTerminal: "T2" });
        const live = db.journeys.get(journey.id);
        const bookings = [...db.bookings.values()];
        const viewT3 = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(t3.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        const viewT5 = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(t5.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        const viewT4 = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(t4.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        const viewT2 = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(t2.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(db.bookings.get(String(t5.bookingId))?.dropoffTerminal, "T3");
        strict_1.default.equal(viewT3.terminalTransferRequired, false);
        strict_1.default.match(String(viewT3.terminalTransferWarning), /No terminal transfer/);
        strict_1.default.equal(viewT5.terminalTransferRequired, true);
        strict_1.default.equal(viewT5.terminalGuideLabel, "How to get from T3 to T5");
        strict_1.default.equal(viewT4.terminalGuideLabel, "How to get from T3 to T4");
        strict_1.default.equal(viewT2.terminalGuideLabel, "How to get from T3 to T2");
        strict_1.default.ok(String(viewT5.terminalGuideUrl).includes("#t5"));
        strict_1.default.ok(String(viewT4.terminalGuideUrl).includes("#t4"));
    });
    (0, node_test_1.it)("15 and 16. Terminal guide is a public page and does not expose customer information", () => {
        const file = node_path_1.default.join(process.cwd(), "..", "spires-website", "share", "heathrow-terminal-transfer.html");
        const html = node_fs_1.default.readFileSync(file, "utf8");
        strict_1.default.match(html, /Getting from Heathrow Terminal 3 to your departure terminal/);
        strict_1.default.match(html, /id="t2"/);
        strict_1.default.match(html, /id="t5"/);
        strict_1.default.equal(html.includes("bookingId"), false);
        strict_1.default.equal(html.includes("@example.com"), false);
        strict_1.default.equal(html.includes("intendedDestination"), false);
        strict_1.default.equal((0, terminalGuide_1.terminalTransferRequired)("T5"), true);
        strict_1.default.equal((0, terminalGuide_1.terminalGuideLinkText)("T5"), "How to get from T3 to T5");
        strict_1.default.ok((0, terminalGuide_1.terminalGuideHref)("T4").includes("#t4"));
        strict_1.default.match(String((0, terminalGuide_1.terminalTransferWarning)("T3")), /No terminal transfer/);
    });
    (0, node_test_1.it)("17 and 18. New terms version is recorded and old acceptances are not treated as current", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const result = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "Heathrow",
            travelDate: "2026-10-12",
            preferredDepartureTime: "14:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            termsAccepted: true,
            ...contact("Eve"),
        });
        strict_1.default.equal(result.entry.termsVersion, types_1.SHARE_TERMS_VERSION);
        strict_1.default.equal((0, types_1.isCurrentShareTermsVersion)(types_1.SHARE_TERMS_VERSION), true);
        strict_1.default.equal((0, types_1.isCurrentShareTermsVersion)(types_1.PREVIOUS_SHARE_TERMS_VERSION), false);
        strict_1.default.equal((0, types_1.isCurrentShareTermsVersion)("share-heathrow-mvp-2026-09-28"), false);
    });
    (0, node_test_1.it)("19 and 20. Route specific pricing works and London does not inherit Heathrow pricing", () => {
        strict_1.default.throws(() => (0, routePricing_1.cityJourneyRequiresOwnFare)(undefined));
        strict_1.default.throws(() => (0, bookingFlow_1.createCityMatchingJourney)(new bookingFlow_1.InMemoryShareDb(), {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
        }));
        const db = new bookingFlow_1.InMemoryShareDb();
        const london = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const heathrow = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00" });
        strict_1.default.equal(london.farePence, 4500);
        strict_1.default.equal(london.fourPassengerFallbackEnabled, false);
        strict_1.default.equal(heathrow.farePence, 3500);
        strict_1.default.equal(heathrow.fourPassengerFallbackEnabled, true);
        strict_1.default.throws(() => (0, bookingFlow_1.offerFourPassengerOption)(db, london.id));
    });
    (0, node_test_1.it)("21 and 22. Payment URLs stay private and customers cannot self mark paid", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        const result = await joinHeathrow(db, journey.id, "Fay", "pay-priv-01xxxxxxx");
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/secret");
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("paymentLinkUrl" in pub, false);
        const stripped = (0, logic_1.stripPrivateFields)(db.journeys.get(journey.id));
        strict_1.default.equal("paymentLinkUrl" in stripped, false);
        const booking = db.bookings.get(String(result.bookingId));
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(booking, { uid: "uid_Fay" }), true);
        strict_1.default.equal(booking.hostedPaymentStatus === "PAID", false);
    });
    (0, node_test_1.it)("23 and 24. Sixth passenger cannot bypass capacity and confirmed journeys stay locked", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        for (let i = 0; i < 5; i += 1) {
            await joinHeathrow(db, journey.id, `Cap${i}`, `cap-${i}xxxxxxxxxxxx`);
        }
        await strict_1.default.rejects(() => joinHeathrow(db, journey.id, "Sixth", "cap-sixthxxxxxxxxx"));
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id);
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        (0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id);
        const locked = db.journeys.get(journey.id);
        strict_1.default.equal(locked.status, "CONFIRMED");
        locked.occupiedSeats = 4;
        (0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("compatible preview does not force an unsuitable match", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "Mayfair",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Gina"),
        });
        const match = (0, interestGroups_1.previewCompatibleInterest)([...db.interestGroups.values()], {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "18:00",
            flexibility: "exact",
            passengers: 1,
        });
        strict_1.default.equal(match, null);
    });
});
