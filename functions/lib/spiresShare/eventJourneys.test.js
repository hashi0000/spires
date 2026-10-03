"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const boarding_1 = require("./boarding");
const shareProgress_1 = require("./shareProgress");
const defaults_1 = require("./defaults");
const eventJourneys_1 = require("./eventJourneys");
const interestGroups_1 = require("./interestGroups");
const notifications_1 = require("./notifications");
const operatorConsole_1 = require("./operatorConsole");
const paymentProvider_1 = require("./paymentProvider");
const logic_1 = require("./logic");
function person(name, extras = {}) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        uid: `uid_${name}`,
        termsAccepted: true,
        ...extras,
    };
}
function wembleyInput(overrides = {}) {
    return {
        eventName: "England match",
        venueName: "Wembley Stadium",
        venueId: "wembley",
        eventDate: "2026-11-12",
        eventStartTime: "19:45",
        origin: "Oxford",
        pickupLocation: "Thornhill Park and Ride",
        destination: "Wembley Stadium",
        suggestedDepartureTime: "16:30",
        outboundFarePence: 4000,
        returnFarePence: 7500,
        offerReturn: true,
        returnDepartureBasis: "AFTER_EVENT",
        returnAfterMinutes: 45,
        passengerLimit: 5,
        interestDeadlineAt: "2026-11-11T12:00:00.000Z",
        venueReturnMeetingPoint: "Wembley Stadium area",
        ...overrides,
    };
}
function register(db, name, extras = {}) {
    const group = [...db.interestGroups.values()].find((row) => row.journeyType === "EVENT");
    strict_1.default.ok(group);
    return (0, bookingFlow_1.expressInterest)(db, {
        origin: group.origin,
        destinationRegion: group.destinationRegion,
        travelDate: group.travelDate,
        preferredDepartureTime: group.preferredDepartureTime || "16:30",
        passengers: 1,
        publicNumber: group.publicNumber,
        eventSlug: group.eventSlug,
        ...person(name, extras),
    });
}
(0, node_test_1.describe)("Event Share journeys", () => {
    (0, node_test_1.it)("lets admin create, unpublish and publish an event opportunity", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput());
        strict_1.default.equal(created.journeyType, "EVENT");
        strict_1.default.equal(created.eventPublished, false);
        strict_1.default.equal(created.minPassengerThreshold, eventJourneys_1.EVENT_PASSENGER_CAP);
        (0, bookingFlow_1.unpublishEventInterest)(db, created.id);
        strict_1.default.equal(db.interestGroups.get(created.id)?.eventPublished, false);
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        strict_1.default.equal(db.interestGroups.get(created.id)?.eventPublished, true);
        strict_1.default.equal(db.interestGroups.get(created.id)?.eventStatus, "PUBLISHED");
    });
    (0, node_test_1.it)("lists an event on the Share page only when published", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput());
        strict_1.default.equal((0, bookingFlow_1.listPublicInterestGroups)(db).some((row) => row.eventSlug === created.eventSlug), false);
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        const listed = (0, bookingFlow_1.listPublicInterestGroups)(db).filter((row) => row.journeyType === "EVENT");
        strict_1.default.equal(listed.length, 1);
        strict_1.default.equal(listed[0].eventName, "England match");
        strict_1.default.equal(listed[0].interestedSeatCount, 0);
    });
    (0, node_test_1.it)("defaults to a maximum of 5 passengers and keeps Heathrow fare independent", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const event = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ outboundFarePence: undefined, venueId: "wembley" }));
        const heathrow = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-11-12", departureTime: "14:00" });
        strict_1.default.equal(event.minPassengerThreshold, 5);
        strict_1.default.equal(event.outboundFarePence, 4000);
        strict_1.default.equal(heathrow.farePence, 3500);
        strict_1.default.notEqual(event.outboundFarePence, heathrow.farePence);
    });
    (0, node_test_1.it)("can populate fare from a London area and allow an admin override", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const areaFare = (0, eventJourneys_1.fareFromLondonArea)(db.config.londonShareAreas, "london_west");
        strict_1.default.equal(areaFare, 3500);
        const populated = (0, eventJourneys_1.applyVenueDefaults)({ eventName: "Gig", venueName: "The O2", venueId: "o2", eventDate: "2026-10-24", eventStartTime: "19:00" }, db.config);
        strict_1.default.equal(populated.outboundFarePence, 5000);
        const overridden = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ outboundFarePence: 4200 }));
        strict_1.default.equal(overridden.outboundFarePence, 4200);
    });
    (0, node_test_1.it)("lets a customer register interest without creating a booking or requesting payment", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        const result = register(db, "Sarah");
        strict_1.default.equal(result.group.status, "GATHERING_INTEREST");
        strict_1.default.equal(result.entry.status, "ACTIVE");
        strict_1.default.equal(db.bookings.size, 0);
        strict_1.default.equal(db.notifications.some((row) => row.type === "PAYMENT_REQUIRED"), false);
        strict_1.default.equal(result.group.interestedSeatCount, 1);
    });
    (0, node_test_1.it)("keeps a real interest count and hides customer PII on the public event view", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        register(db, "Sarah");
        register(db, "James");
        const publicView = (0, interestGroups_1.toPublicInterestGroup)(db.interestGroups.get(created.id));
        strict_1.default.equal(publicView.interestedSeatCount, 2);
        strict_1.default.equal((0, eventJourneys_1.publicEventHasPii)(publicView), false);
        strict_1.default.equal((0, interestGroups_1.publicInterestHasPrivateData)(publicView), false);
        const json = JSON.stringify((0, eventJourneys_1.eventPublicView)(db.interestGroups.get(created.id)));
        strict_1.default.equal(json.includes("sarah@example.com"), false);
        strict_1.default.equal(json.includes("07776897772"), false);
    });
    (0, node_test_1.it)("creates Needs Action when the 5 passenger threshold is reached", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        for (const name of ["A", "B", "C", "D", "E"])
            register(db, name);
        const group = db.interestGroups.get(created.id);
        strict_1.default.equal(group.status, "READY_FOR_REVIEW");
        strict_1.default.equal(group.interestedSeatCount, 5);
        const needs = (0, operatorConsole_1.buildNeedsAction)({ journeys: [], bookings: [], interestGroups: [group] });
        strict_1.default.ok(needs.some((row) => row.kind === "ready_to_propose"));
    });
    (0, node_test_1.it)("stores one way and return demand separately and uses the return package fare", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        register(db, "Out", { tripType: "ONE_WAY" });
        register(db, "Back", { tripType: "RETURN" });
        register(db, "C", { tripType: "ONE_WAY" });
        register(db, "D", { tripType: "RETURN" });
        register(db, "E", { tripType: "ONE_WAY" });
        const group = db.interestGroups.get(created.id);
        strict_1.default.equal(group.interestedSeatCount, 5);
        strict_1.default.equal(group.returnSeatCount, 2);
        const journey = (0, bookingFlow_1.proposeJourneyFromInterest)(db, created.id, {
            departureLocation: "Thornhill Park and Ride",
            departureTime: "16:30",
            farePence: 4000,
            capacity: 5,
        });
        strict_1.default.equal(journey.journeyType, "EVENT");
        strict_1.default.equal(journey.farePence, 4000);
        strict_1.default.equal(journey.fourPassengerFallbackEnabled, false);
        for (const entry of db.interestEntries.values()) {
            (0, bookingFlow_1.acceptProposedInterestJourney)(db, entry.id, entry.uid);
        }
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.spires-taxis.com/share-wembley");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-11-10T10:00:00.000Z");
        const returnBooking = [...db.bookings.values()].find((row) => row.tripType === "RETURN");
        const oneWay = [...db.bookings.values()].find((row) => row.tripType !== "RETURN");
        strict_1.default.ok(returnBooking);
        strict_1.default.ok(oneWay);
        const payment = db.payments.get(returnBooking.paymentId || "");
        strict_1.default.equal(payment?.amountPence, 7500);
        const oneWayPay = db.payments.get(oneWay.paymentId || "");
        strict_1.default.equal(oneWayPay?.amountPence, 4000);
    });
    (0, node_test_1.it)("runs the existing acceptance, payment and confirmation guard for events", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true, offerReturn: false, returnFarePence: undefined }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        for (const name of ["A", "B", "C", "D", "E"])
            register(db, name);
        const journey = (0, bookingFlow_1.proposeJourneyFromInterest)(db, created.id, {
            departureLocation: "Thornhill Park and Ride",
            departureTime: "16:30",
            farePence: 4000,
            capacity: 5,
        });
        for (const entry of db.interestEntries.values())
            (0, bookingFlow_1.acceptProposedInterestJourney)(db, entry.id, entry.uid);
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.spires-taxis.com/share-event");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-11-10T10:00:00.000Z");
        const bookings = [...db.bookings.values()];
        strict_1.default.equal((0, shareProgress_1.confirmationGuard)(bookings, db.journeys.get(journey.id), db.config).ok, false);
        for (const booking of bookings)
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        const live = db.journeys.get(journey.id);
        strict_1.default.equal(live.status, "CONFIRMED");
        strict_1.default.ok(bookings.every((row) => row.boardingCode));
    });
    (0, node_test_1.it)("keeps return boarding separate from outbound and lists both legs on the driver manifest", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        register(db, "Out", { tripType: "ONE_WAY" });
        for (const name of ["R1", "R2", "R3", "R4"])
            register(db, name, { tripType: "RETURN" });
        const journey = (0, bookingFlow_1.proposeJourneyFromInterest)(db, created.id, {
            departureLocation: "Thornhill Park and Ride",
            departureTime: "16:30",
            farePence: 4000,
            capacity: 5,
        });
        for (const entry of db.interestEntries.values())
            (0, bookingFlow_1.acceptProposedInterestJourney)(db, entry.id, entry.uid);
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.spires-taxis.com/share-event");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-11-10T10:00:00.000Z");
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        const live = db.journeys.get(journey.id);
        const bookings = [...db.bookings.values()];
        (0, boarding_1.issueBoardingCodes)(live, bookings, "2026-11-12T15:00:00.000Z");
        const outbound = bookings.find((row) => row.tripType !== "RETURN");
        const returning = bookings.find((row) => row.tripType === "RETURN");
        (0, bookingFlow_1.verifyPassengerBoarding)(db, outbound.id, outbound.boardingCode || "", "driver", "2026-11-12T16:20:00.000Z", "OUTBOUND");
        strict_1.default.equal(db.bookings.get(outbound.id)?.boardStatus, "BOARDED");
        strict_1.default.notEqual(db.bookings.get(returning.id)?.returnBoardStatus, "BOARDED");
        (0, bookingFlow_1.verifyPassengerBoarding)(db, returning.id, returning.boardingCode || "", "driver", "2026-11-12T22:00:00.000Z", "RETURN");
        strict_1.default.equal(db.bookings.get(returning.id)?.returnBoardStatus, "BOARDED");
        strict_1.default.notEqual(db.bookings.get(returning.id)?.boardStatus, "BOARDED");
        const manifest = (0, boarding_1.driverManifestLines)(bookings, live);
        strict_1.default.match(manifest, /OUTBOUND/);
        strict_1.default.match(manifest, /RETURN/);
        strict_1.default.match(manifest, /England match/);
        strict_1.default.match(manifest, /Wembley Stadium/);
    });
    (0, node_test_1.it)("respects the 5 passenger cap on the waitlist and drops cancelled passengers from the current manifest", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true, offerReturn: false, returnFarePence: undefined }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        for (const name of ["A", "B", "C", "D", "E"])
            register(db, name);
        strict_1.default.throws(() => register(db, "Late"));
        const journey = (0, bookingFlow_1.proposeJourneyFromInterest)(db, created.id, {
            departureLocation: "Thornhill Park and Ride",
            departureTime: "16:30",
            farePence: 4000,
            capacity: 5,
        });
        for (const entry of db.interestEntries.values())
            (0, bookingFlow_1.acceptProposedInterestJourney)(db, entry.id, entry.uid);
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.spires-taxis.com/share-event");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-11-10T10:00:00.000Z");
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...person("Wait"), passengers: 1, termsAccepted: true });
        const dropped = [...db.bookings.values()][0];
        (0, bookingFlow_1.cancelReservation)(db, dropped.id, "2026-11-11T10:00:00.000Z");
        const after = (0, boarding_1.driverManifestLines)([...db.bookings.values()], db.journeys.get(journey.id));
        strict_1.default.equal(after.includes(dropped.name), false);
        (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id);
        const live = db.journeys.get(journey.id);
        strict_1.default.equal(live.status, "CONFIRMED");
    });
    (0, node_test_1.it)("expires unpublished demand and includes event details in customer emails", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true, interestDeadlineAt: "2026-11-01T12:00:00.000Z" }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        register(db, "Solo");
        const expired = (0, bookingFlow_1.expireInsufficientInterest)(db, "2026-11-02T12:00:00.000Z");
        strict_1.default.equal(expired, 1);
        strict_1.default.equal(db.interestGroups.get(created.id)?.eventStatus, "DID_NOT_FILL");
        const mail = (0, notifications_1.buildNotification)("INTEREST_RECEIVED", "solo@example.com", null, {
            eventName: "England match",
            venueName: "Wembley Stadium",
            eventDate: "2026-11-12",
            origin: "Oxford",
            destination: "Wembley Stadium",
        });
        strict_1.default.match(mail.text, /England match/);
        strict_1.default.match(mail.text, /Wembley Stadium/);
        const advert = (0, bookingFlow_1.eventAdvertForGroup)(db, created.id);
        strict_1.default.match(advert, /Maximum 5 passengers/);
        const revenue = (0, bookingFlow_1.eventRevenueForInput)(wembleyInput());
        strict_1.default.equal(revenue.outboundPence, 20000);
        strict_1.default.equal(revenue.returnPackagePence, 37500);
    });
    (0, node_test_1.it)("does not mix an unpublished event with organic London interest and keeps airport Share working", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.createEventInterest)(db, wembleyInput({ publish: true }));
        (0, bookingFlow_1.publishEventInterest)(db, created.id);
        (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "Wembley Stadium",
            travelDate: "2026-11-12",
            preferredDepartureTime: "16:30",
            passengers: 1,
            ...person("Organic"),
        });
        const groups = [...db.interestGroups.values()];
        strict_1.default.equal(groups.length, 2);
        strict_1.default.equal(groups.filter((row) => row.eventPublished === true).length, 1);
        const provider = new paymentProvider_1.MockPaymentProvider();
        const heathrow = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-13", departureTime: "14:00", customerVisible: true });
        await (0, bookingFlow_1.reservePlace)(db, provider, {
            action: "join",
            airportId: "heathrow",
            travelDate: "2026-10-13",
            preferredDepartureTime: "14:00",
            journeyId: heathrow.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...person("Air"), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
            idempotencyKey: "heathrow-event-reg1",
            termsAccepted: true,
        });
        strict_1.default.equal(db.journeys.get(heathrow.id)?.occupiedSeats, 1);
        strict_1.default.equal((0, logic_1.toPublicJourney)(heathrow, defaults_1.DEFAULT_SHARE_CONFIG).farePence, 3500);
    });
});
