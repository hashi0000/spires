"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const hostedPayment_1 = require("./hostedPayment");
const defaults_1 = require("./defaults");
const access_1 = require("./access");
const logic_1 = require("./logic");
const destinationMatching_1 = require("./destinationMatching");
function contact(name, uid = `uid_${name}`) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        flexibility: "plus_minus_30",
        dropoffTerminal: "T3",
        uid,
    };
}
async function bookHeathrow(db, opts) {
    return (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
        action: opts.action,
        airportId: "heathrow",
        travelDate: "2026-10-06",
        preferredDepartureTime: "14:00",
        journeyId: opts.journeyId,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: contact(opts.name),
        idempotencyKey: opts.key,
        termsAccepted: true,
    });
}
async function joinCity(db, journeyId, name, destination, key) {
    return (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
        action: "join",
        airportId: "city:oxford-london",
        travelDate: "2026-10-10",
        preferredDepartureTime: "10:00",
        journeyId,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: contact(name),
        idempotencyKey: key,
        termsAccepted: true,
        intendedDestinationText: destination,
        sharedDropoffAcknowledged: true,
    });
}
(0, node_test_1.describe)("destination matching architecture", () => {
    (0, node_test_1.it)("1. Heathrow journey works without destination matching", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-06", departureTime: "14:00", customerVisible: true });
        strict_1.default.equal(journey.destinationMatchingEnabled, false);
        strict_1.default.equal(journey.journeyType, "AIRPORT");
        const first = await bookHeathrow(db, { action: "join", journeyId: journey.id, key: "h1xxxxxxx", name: "Ann" });
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(booking?.intendedDestinationText, undefined);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "GATHERING_INTEREST");
    });
    (0, node_test_1.it)("2. CITY matching journey asks for intended destination", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        await strict_1.default.rejects(() => (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "join",
            airportId: journey.airportId,
            travelDate: journey.travelDate,
            preferredDepartureTime: journey.departureTime,
            journeyId: journey.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: contact("Ben"),
            idempotencyKey: "city-missing",
            termsAccepted: true,
        }), /Where in London/);
        strict_1.default.throws(() => (0, destinationMatching_1.requireIntendedDestination)({ intendedDestinationText: "Chelsea" }), /shared drop off/);
    });
    (0, node_test_1.it)("3. Intended destination is stored against the correct reservation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const result = await joinCity(db, journey.id, "Cara", "South Kensington", "city-dest-1");
        const booking = db.bookings.get(String(result.bookingId));
        strict_1.default.equal(booking.intendedDestinationText, "South Kensington");
        strict_1.default.ok(booking.destinationEnteredAt);
        strict_1.default.ok(booking.sharedDropoffAcknowledgedAt);
        strict_1.default.equal(booking.journeyId, journey.id);
    });
    (0, node_test_1.it)("4 and 10. Passenger cannot see another passenger destination and can see their own", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const a = await joinCity(db, journey.id, "Dana", "Paddington", "city-a");
        const b = await joinCity(db, journey.id, "Eli", "Chelsea", "city-b");
        const live = db.journeys.get(journey.id);
        const bookings = [...db.bookings.values()];
        const viewA = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(a.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        const viewB = (0, hostedPayment_1.toCustomerBookingView)(live, db.bookings.get(String(b.bookingId)), bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(viewA.intendedDestinationText, "Paddington");
        strict_1.default.equal(viewB.intendedDestinationText, "Chelsea");
        strict_1.default.equal(JSON.stringify(viewA).includes("Chelsea"), false);
        strict_1.default.equal(JSON.stringify(viewB).includes("Paddington"), false);
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(db.bookings.get(String(b.bookingId)), { uid: "uid_Dana" }), false);
    });
    (0, node_test_1.it)("5. Public journey DTO contains no intended destinations", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        await joinCity(db, journey.id, "Fay", "Mayfair", "city-f");
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal((0, destinationMatching_1.publicDtoHasPrivateDestinations)(pub), false);
        strict_1.default.equal(pub.destinationMatchingEnabled, true);
        const stripped = (0, logic_1.stripPrivateFields)(db.bookings.get([...db.bookings.keys()][0]));
        strict_1.default.equal("intendedDestinationText" in stripped, false);
        strict_1.default.equal("paymentLinkUrl" in stripped, false);
    });
    (0, node_test_1.it)("6. Admin can see passenger destinations", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        await joinCity(db, journey.id, "Gina", "Westminster", "city-g");
        const summary = (0, destinationMatching_1.adminDestinationSummary)(db.journeys.get(journey.id), [...db.bookings.values()], [...db.hubs.values()]);
        strict_1.default.equal(summary.destinations[0].intendedDestinationText, "Westminster");
        strict_1.default.equal(summary.interestedCount, 1);
    });
    (0, node_test_1.it)("7 and 8. Admin can select an enabled hub and cannot select a disabled hub", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const disabled = (0, bookingFlow_1.createDropoffHub)(db, { name: "Marble Arch", city: "London", enabled: false });
        const enabled = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        await joinCity(db, journey.id, "Hugo", "Chelsea", "city-h");
        strict_1.default.throws(() => (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, disabled.id, "admin@example.com"), /not enabled/);
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, enabled.id, "admin@example.com");
        strict_1.default.equal(db.journeys.get(journey.id)?.proposedSharedDropoffDisplayName, "Victoria");
        (0, bookingFlow_1.setDropoffHubEnabled)(db, enabled.id, false);
        strict_1.default.throws(() => (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, enabled.id, "admin@example.com"), /not enabled/);
    });
    (0, node_test_1.it)("9 and 11. Passenger sees proposed drop off and can accept it", async () => {
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
        const result = await joinCity(db, journey.id, "Ivy", "South Kensington", "city-i");
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin@example.com");
        const live = db.journeys.get(journey.id);
        const booking = db.bookings.get(String(result.bookingId));
        const view = (0, hostedPayment_1.toCustomerBookingView)(live, booking, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.proposedSharedDropoffDisplayName, "Victoria");
        strict_1.default.equal(view.sharedDropoffStatus, "PROPOSED");
        strict_1.default.match(view.sharedDropoffNotice || "", /South Kensington/);
        strict_1.default.match(view.sharedDropoffNotice || "", /Victoria/);
        (0, bookingFlow_1.acceptSharedDropoff)(db, booking.id);
        strict_1.default.equal(db.bookings.get(booking.id)?.acceptedDropoffProposalVersion, 1);
        strict_1.default.ok(db.bookings.get(booking.id)?.sharedDropoffAcceptedAt);
    });
    (0, node_test_1.it)("12, 13 and 14. Declining does not create a late cancellation and releases the seat", async () => {
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
        const first = await joinCity(db, journey.id, "Jade", "Mayfair", "city-j");
        await joinCity(db, journey.id, "Kai", "Chelsea", "city-k");
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin@example.com");
        (0, bookingFlow_1.declineSharedDropoff)(db, String(first.bookingId));
        const declined = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(declined.reservationStatus, "DROP_OFF_DECLINED");
        strict_1.default.equal(declined.cancellationCategory, undefined);
        strict_1.default.ok(declined.sharedDropoffDeclinedAt);
        strict_1.default.equal(db.journeys.get(journey.id)?.occupiedSeats, 1);
        const again = await joinCity(db, journey.id, "Leah", "Paddington", "city-l");
        strict_1.default.equal(again.ok, true);
        strict_1.default.equal(db.journeys.get(journey.id)?.occupiedSeats, 2);
    });
    (0, node_test_1.it)("15. CITY passenger cannot enter payment before accepting proposed drop off", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const names = ["Mia", "Ned", "Ora", "Pat"];
        for (const [index, name] of names.entries()) {
            await joinCity(db, journey.id, name, ["Paddington", "Mayfair", "Chelsea", "Westminster"][index], `pay-${name}`);
        }
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "AWAITING_DROPOFF_SELECTION");
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/share35");
        strict_1.default.throws(() => (0, bookingFlow_1.openPaymentWindow)(db, journey.id), /shared drop off/);
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin@example.com");
        const live = db.journeys.get(journey.id);
        const unpaid = [...db.bookings.values()][0];
        strict_1.default.equal((0, hostedPayment_1.hostedPaymentUrlForCustomer)(live, unpaid), null);
        strict_1.default.throws(() => (0, bookingFlow_1.openPaymentWindow)(db, journey.id), /accept the proposed shared drop off/);
    });
    (0, node_test_1.it)("16 and 17. Changing proposed drop off invalidates previous acceptance for that version", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const victoria = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        const marble = (0, bookingFlow_1.createDropoffHub)(db, { name: "Marble Arch", city: "London", enabled: true });
        const result = await joinCity(db, journey.id, "Quinn", "Chelsea", "city-q");
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, victoria.id, "admin@example.com");
        (0, bookingFlow_1.acceptSharedDropoff)(db, String(result.bookingId));
        strict_1.default.equal(db.bookings.get(String(result.bookingId))?.acceptedDropoffProposalVersion, 1);
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, marble.id, "admin@example.com");
        const booking = db.bookings.get(String(result.bookingId));
        strict_1.default.equal(booking.sharedDropoffAcceptedAt, undefined);
        strict_1.default.equal(booking.acceptedDropoffProposalVersion, undefined);
        strict_1.default.equal(db.journeys.get(journey.id)?.sharedDropoffProposalVersion, 2);
        strict_1.default.equal(db.journeys.get(journey.id)?.proposedSharedDropoffDisplayName, "Marble Arch");
    });
    (0, node_test_1.it)("18. Payment link remains private", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-06", departureTime: "14:00" });
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/secret-link");
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("paymentLinkUrl" in pub, false);
        strict_1.default.equal(JSON.stringify(pub).includes("secret-link"), false);
        const stripped = (0, logic_1.stripPrivateFields)(db.journeys.get(journey.id));
        strict_1.default.equal("paymentLinkUrl" in stripped, false);
    });
    (0, node_test_1.it)("19. Existing five passenger payment confirmation still works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await bookHeathrow(db, { action: "propose", key: "five-a", name: "A" });
        const journeyId = String(first.journeyId);
        for (const name of ["B", "C", "D", "E"]) {
            await bookHeathrow(db, { action: "join", journeyId, key: `five-${name}`, name });
        }
        (0, bookingFlow_1.savePaymentLink)(db, journeyId, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journeyId, "2026-10-04T09:00:00.000Z");
        for (const booking of db.bookings.values()) {
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        }
        const confirmed = (0, bookingFlow_1.confirmHostedIfEligible)(db, journeyId);
        strict_1.default.equal(confirmed.ok, true);
        strict_1.default.equal(db.journeys.get(journeyId)?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("20. Existing four passenger fallback still works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await bookHeathrow(db, { action: "propose", key: "four-a", name: "A" });
        const journeyId = String(first.journeyId);
        for (const name of ["B", "C", "D"]) {
            await bookHeathrow(db, { action: "join", journeyId, key: `four-${name}`, name });
        }
        (0, bookingFlow_1.savePaymentLink)(db, journeyId, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journeyId, "2026-10-04T09:00:00.000Z");
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        (0, bookingFlow_1.offerFourPassengerOption)(db, journeyId);
        (0, bookingFlow_1.saveSupplementLink)(db, journeyId, "https://pay.example.com/share875");
        for (const booking of db.bookings.values()) {
            (0, bookingFlow_1.acceptFourPassenger)(db, booking.id, true);
            (0, bookingFlow_1.markSupplementPaid)(db, booking.id, "admin");
        }
        const confirmed = (0, bookingFlow_1.confirmHostedIfEligible)(db, journeyId);
        strict_1.default.equal(confirmed.ok, true);
    });
    (0, node_test_1.it)("21. Existing concurrency protection still prevents overbooking", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await bookHeathrow(db, { action: "propose", key: "cap-a", name: "A" });
        const journeyId = String(first.journeyId);
        await Promise.all(["B", "C", "D", "E"].map((name) => bookHeathrow(db, { action: "join", journeyId, key: `cap-${name}`, name })));
        await strict_1.default.rejects(() => bookHeathrow(db, { action: "join", journeyId, key: "cap-overflow", name: "F" }), /No remaining places/);
        strict_1.default.equal(db.journeys.get(journeyId)?.occupiedSeats, 5);
    });
    (0, node_test_1.it)("22. Existing Heathrow tests continue: cancel is not drop off declined", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await bookHeathrow(db, { action: "propose", key: "can-a", name: "A" });
        (0, bookingFlow_1.cancelReservation)(db, String(first.bookingId), "2026-10-01T09:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(booking?.reservationStatus, "CANCELLED");
        strict_1.default.notEqual(booking?.reservationStatus, "DROP_OFF_DECLINED");
        strict_1.default.equal((0, access_1.isCustomerListableJourney)((0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-07", departureTime: "09:00", customerVisible: true }), "customer"), true);
        const city = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-11",
            departureTime: "10:00",
            farePence: 4500,
        });
        city.customerVisible = true;
        strict_1.default.equal((0, access_1.isCustomerListableJourney)(city, "customer"), false);
        strict_1.default.equal((0, access_1.isCustomerListableJourney)(city, "admin"), true);
    });
    (0, node_test_1.it)("matching ranks enabled hubs without fabricating routing times", () => {
        const hubs = [
            (0, bookingFlow_1.createDropoffHub)(new bookingFlow_1.InMemoryShareDb(), { name: "Victoria", city: "London", enabled: true }),
        ];
        const db = new bookingFlow_1.InMemoryShareDb();
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        const result = (0, destinationMatching_1.rankSharedDropoffHubs)([
            {
                id: "b1",
                journeyId: "j1",
                publicNumber: "x",
                passengers: 1,
                name: "A",
                mobile: "1",
                email: "a@example.com",
                flexibility: "exact",
                luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
                homeCollection: "HOME_COLLECTION_UNAVAILABLE",
                homeCollectionSurchargePence: 0,
                paymentStatus: "HOSTED_UNPAID",
                reservationStatus: "PROVISIONAL",
                boardStatus: "NOT_CHECKED_IN",
                earlyDepartureAccepted: false,
                manageTokenHash: "x",
                idempotencyKey: "x",
                createdAt: "2026-10-01T00:00:00.000Z",
                intendedDestinationText: "Chelsea",
            },
        ], [hub]);
        strict_1.default.equal(result.routingAvailable, false);
        strict_1.default.equal(result.geocodingAvailable, false);
        strict_1.default.equal(result.overallQuality, "MANUAL_REVIEW");
        strict_1.default.equal(result.hubScores[0].meanDistanceMetres, null);
        strict_1.default.equal(result.clusters[0].quality, "MANUAL_REVIEW");
        void hubs;
    });
});
