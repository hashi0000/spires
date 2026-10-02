"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const defaults_1 = require("./defaults");
const interestGroups_1 = require("./interestGroups");
const logic_1 = require("./logic");
function contact(name, uid = `uid_${name}`) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        uid,
    };
}
function interestBase(name, extras = {}) {
    return {
        origin: "Oxford",
        destinationRegion: "London",
        travelDate: "2026-10-10",
        preferredDepartureTime: "10:00",
        flexibility: "plus_minus_30",
        passengers: 1,
        intendedDestinationText: "South Kensington",
        intendedDestinationPostcode: "SW7 2AZ",
        sharedDropoffAcknowledged: true,
        termsAccepted: true,
        ...contact(name),
        ...extras,
    };
}
async function fillHeathrow(db, journeyId, count, prefix) {
    const provider = new paymentProvider_1.MockPaymentProvider();
    for (let i = 0; i < count; i += 1) {
        await (0, bookingFlow_1.reservePlace)(db, provider, {
            action: "join",
            airportId: "heathrow",
            travelDate: "2026-10-12",
            preferredDepartureTime: "14:00",
            journeyId,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact(`${prefix}${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
            idempotencyKey: `${prefix}-join-${i}xxxxxx`,
            termsAccepted: true,
        });
    }
}
(0, node_test_1.describe)("Spires Share interest groups and waitlist", () => {
    (0, node_test_1.it)("requires login to create interest", () => {
        strict_1.default.throws(() => (0, bookingFlow_1.requireShareAuth)(undefined), /Sign in/);
        const db = new bookingFlow_1.InMemoryShareDb();
        strict_1.default.throws(() => (0, bookingFlow_1.expressInterest)(db, interestBase("A", { uid: undefined })), /Sign in/);
    });
    (0, node_test_1.it)("lets a customer create interest", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const result = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        strict_1.default.equal(result.joinedExisting, false);
        strict_1.default.equal(result.group.origin, "Oxford");
        strict_1.default.equal(result.group.destinationRegion, "London");
        strict_1.default.equal(result.group.interestedSeatCount, 1);
        strict_1.default.equal(result.group.status, "GATHERING_INTEREST");
        strict_1.default.equal(result.entry.intendedDestinationText, "South Kensington");
        strict_1.default.equal(result.entry.status, "ACTIVE");
    });
    (0, node_test_1.it)("joins a compatible customer into an existing group", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        const second = (0, bookingFlow_1.expressInterest)(db, interestBase("B", { preferredDepartureTime: "10:15", intendedDestinationText: "Chelsea" }));
        strict_1.default.equal(second.joinedExisting, true);
        strict_1.default.equal(second.group.id, first.group.id);
        strict_1.default.equal(db.interestGroups.size, 1);
        strict_1.default.equal(second.group.interestedSeatCount, 2);
    });
    (0, node_test_1.it)("creates a separate group when the request is incompatible", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        const heathrow = (0, bookingFlow_1.expressInterest)(db, interestBase("B", { destinationRegion: "Heathrow", intendedDestinationText: undefined, sharedDropoffAcknowledged: false }));
        const later = (0, bookingFlow_1.expressInterest)(db, interestBase("C", { preferredDepartureTime: "14:00", flexibility: "exact" }));
        strict_1.default.equal(db.interestGroups.size, 3);
        strict_1.default.equal(heathrow.joinedExisting, false);
        strict_1.default.equal(later.joinedExisting, false);
    });
    (0, node_test_1.it)("shows the public only an aggregate count", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        (0, bookingFlow_1.expressInterest)(db, interestBase("B", { intendedDestinationText: "Paddington" }));
        const publicRows = (0, bookingFlow_1.listPublicInterestGroups)(db);
        strict_1.default.equal(publicRows.length, 1);
        strict_1.default.equal(publicRows[0].interestedSeatCount, 2);
        strict_1.default.equal(publicRows[0].origin, "Oxford");
        strict_1.default.equal(publicRows[0].destinationRegion, "London");
        strict_1.default.equal((0, interestGroups_1.publicInterestHasPrivateData)(publicRows[0]), false);
        strict_1.default.ok(!JSON.stringify(publicRows[0]).includes("South Kensington"));
        strict_1.default.ok(!JSON.stringify(publicRows[0]).includes("@example.com"));
        strict_1.default.ok(!JSON.stringify(publicRows[0]).includes("07776"));
        strict_1.default.ok(!("interestGroupId" in publicRows[0]));
    });
    (0, node_test_1.it)("does not expose intended destinations on the public interest board", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        const pub = (0, interestGroups_1.toPublicInterestGroup)(created.group);
        const stripped = (0, logic_1.stripPrivateFields)(pub);
        strict_1.default.equal(stripped.intendedDestinationText, undefined);
        strict_1.default.ok(!JSON.stringify(pub).toLowerCase().includes("kensington"));
        strict_1.default.ok(!JSON.stringify(pub).toLowerCase().includes("sw7"));
    });
    (0, node_test_1.it)("requires login to join an existing interest group", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        strict_1.default.throws(() => (0, bookingFlow_1.joinInterestGroup)(db, first.group.publicNumber, interestBase("B", { uid: undefined })), /Sign in/);
    });
    (0, node_test_1.it)("flags unknown places for admin review instead of forcing a match", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const result = (0, bookingFlow_1.expressInterest)(db, interestBase("A", { origin: "Witney" }));
        strict_1.default.equal(result.matchingUncertain, true);
        strict_1.default.equal(result.group.matchingUncertain, true);
        strict_1.default.equal(result.group.origin, "Witney");
    });
    (0, node_test_1.it)("does not charge when converting interest into a proposed journey", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        (0, bookingFlow_1.expressInterest)(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
        (0, bookingFlow_1.expressInterest)(db, interestBase("C", { intendedDestinationText: "Paddington" }));
        (0, bookingFlow_1.expressInterest)(db, interestBase("D", { intendedDestinationText: "Victoria" }));
        strict_1.default.equal(first.group.status, "READY_FOR_REVIEW");
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "South Kensington", city: "London", enabled: true });
        const journey = (0, bookingFlow_1.proposeJourneyFromInterest)(db, first.group.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "09:30",
            farePence: 3500,
            capacity: 5,
            hubId: hub.id,
            actor: "admin@spires.com",
        });
        strict_1.default.equal(journey.status, "PROPOSED");
        strict_1.default.equal(journey.occupiedSeats, 0);
        strict_1.default.equal(db.bookings.size, 0);
        strict_1.default.equal(db.interestGroups.get(first.group.id)?.status, "CONVERTED_TO_JOURNEY");
        strict_1.default.ok(db.notifications.some((row) => row.type === "JOURNEY_PROPOSED_FROM_INTEREST"));
    });
    (0, node_test_1.it)("requires a passenger to accept the proposed journey before they hold a seat", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        (0, bookingFlow_1.proposeJourneyFromInterest)(db, first.group.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "09:30",
            farePence: 3500,
        });
        const declined = (0, bookingFlow_1.declineProposedInterestJourney)(db, first.entry.id, first.entry.uid);
        strict_1.default.equal(declined.status, "DECLINED_PROPOSAL");
        strict_1.default.equal(db.bookings.size, 0);
        const second = (0, bookingFlow_1.expressInterest)(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
        const otherGroup = [...db.interestGroups.values()].find((row) => row.id !== first.group.id);
        (0, bookingFlow_1.proposeJourneyFromInterest)(db, otherGroup.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "10:00",
            farePence: 4500,
        });
        const accepted = (0, bookingFlow_1.acceptProposedInterestJourney)(db, second.entry.id, second.entry.uid);
        strict_1.default.equal(accepted.booking.reservationStatus, "PROVISIONAL");
        strict_1.default.equal(accepted.booking.hostedPaymentStatus, "UNPAID");
        strict_1.default.equal(db.journeys.get(accepted.booking.journeyId)?.occupiedSeats, 1);
    });
    (0, node_test_1.it)("lets admin merge compatible groups and close an interest group", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const morning = (0, bookingFlow_1.expressInterest)(db, interestBase("A", { flexibility: "exact" }));
        const later = (0, bookingFlow_1.expressInterest)(db, interestBase("B", { preferredDepartureTime: "10:05", flexibility: "exact", intendedDestinationText: "Chelsea" }));
        strict_1.default.equal(db.interestGroups.size, 2);
        (0, bookingFlow_1.mergeInterestGroups)(db, later.group.id, morning.group.id);
        strict_1.default.equal(db.interestGroups.get(later.group.id)?.status, "CANCELLED");
        strict_1.default.equal(db.interestGroups.get(morning.group.id)?.interestedSeatCount, 2);
        (0, bookingFlow_1.closeInterestGroup)(db, morning.group.id);
        strict_1.default.equal(db.interestGroups.get(morning.group.id)?.status, "CANCELLED");
    });
    (0, node_test_1.it)("offers a waitlist option when a journey is full", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Full");
        strict_1.default.equal(remaining(db, journey.id), 0);
        const entry = (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
        strict_1.default.equal(entry.status, "WAITING");
        strict_1.default.ok(entry.joinedWaitlistAt);
        strict_1.default.equal(db.journeys.get(journey.id)?.waitlistCount, 1);
    });
    (0, node_test_1.it)("keeps FIFO waitlist order from joinedWaitlistAt", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Fifo");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T10:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T10:05:00.000Z" });
        db.journeys.get(journey.id).occupiedSeats = 4;
        const offered = await (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id, "2026-10-01T11:00:00.000Z");
        strict_1.default.equal(offered?.email, "first@example.com");
        const views = (0, bookingFlow_1.customerWaitlistViews)(db, "uid_First");
        strict_1.default.equal(views[0].waitlistPosition, 1);
        const later = (0, bookingFlow_1.customerWaitlistViews)(db, "uid_Second");
        strict_1.default.equal(later[0].waitlistPosition, 2);
        strict_1.default.equal((0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG).remainingSeats, 0);
    });
    (0, node_test_1.it)("offers a vacant seat to the first waiting passenger", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Vac");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
        const booking = [...db.bookings.values()][0];
        (0, bookingFlow_1.cancelReservation)(db, booking.id, "2026-10-01T12:00:00.000Z");
        const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        strict_1.default.equal(offered?.email, "first@example.com");
        strict_1.default.equal(db.journeys.get(journey.id)?.waitlistOfferOutstanding, true);
        strict_1.default.equal((0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG).remainingSeats, 0);
    });
    (0, node_test_1.it)("advances to the next person when a waitlist offer expires", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Exp");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
        db.journeys.get(journey.id).occupiedSeats = 4;
        const first = await (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id, "2026-10-01T10:00:00.000Z");
        strict_1.default.ok(first?.offerExpiresAt);
        const tick = await (0, bookingFlow_1.expireOpenJourneys)(db, new paymentProvider_1.MockPaymentProvider(), first.offerExpiresAt);
        strict_1.default.ok(tick.waitlistExpired >= 1);
        const next = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        strict_1.default.equal(next?.email, "second@example.com");
        strict_1.default.equal(db.waitlist.get(first.id)?.status, "EXPIRED");
    });
    (0, node_test_1.it)("advances to the next person when a waitlist offer is declined", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Dec");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
        db.journeys.get(journey.id).occupiedSeats = 4;
        const first = await (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id, "2026-10-01T10:00:00.000Z");
        await (0, bookingFlow_1.declineWaitlistOffer)(db, first.id, "uid_First", "2026-10-01T10:10:00.000Z");
        const next = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        strict_1.default.equal(next?.email, "second@example.com");
        strict_1.default.equal(db.waitlist.get(first.id)?.status, "DECLINED");
    });
    (0, node_test_1.it)("does not let two waitlist customers claim the same seat", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Race");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true });
        (0, bookingFlow_1.cancelReservation)(db, [...db.bookings.values()][0].id);
        const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        const results = await Promise.allSettled([
            (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, "uid_First"),
            (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, "uid_First"),
        ]);
        const fulfilled = results.filter((row) => row.status === "fulfilled");
        const rejected = results.filter((row) => row.status === "rejected");
        strict_1.default.equal(fulfilled.length, 1);
        strict_1.default.equal(rejected.length, 1);
        strict_1.default.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
        strict_1.default.equal([...db.bookings.values()].filter((row) => row.waitlistId === offered.id).length, 1);
    });
    (0, node_test_1.it)("offers the waitlist when a payment deadline expires", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Pay");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.test/hosted");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
        const pending = [...db.bookings.values()][0];
        pending.paymentDeadlineAt = "2026-10-10T09:00:00.000Z";
        (0, bookingFlow_1.expireUnpaidReservations)(db, "2026-10-10T09:01:00.000Z");
        strict_1.default.equal(pending.reservationStatus, "PAYMENT_EXPIRED");
        strict_1.default.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
    });
    (0, node_test_1.it)("offers the waitlist when a passenger declines the shared drop off", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "South Kensington", city: "London", enabled: true });
        const provider = new paymentProvider_1.MockPaymentProvider();
        for (let i = 0; i < 5; i += 1) {
            await (0, bookingFlow_1.reservePlace)(db, provider, {
                action: "join",
                airportId: journey.airportId,
                travelDate: journey.travelDate,
                preferredDepartureTime: journey.departureTime,
                journeyId: journey.id,
                passengers: 1,
                luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
                contact: { ...contact(`City${i}`), flexibility: "exact" },
                idempotencyKey: `city-drop-${i}xxxxx`,
                termsAccepted: true,
                intendedDestinationText: "Chelsea",
                sharedDropoffAcknowledged: true,
            });
        }
        (0, bookingFlow_1.addWaitlist)(db, journey.id, {
            ...contact("Wait"),
            passengers: 1,
            termsAccepted: true,
            intendedDestinationText: "Chelsea",
            intendedDestinationPostcode: "SW3",
            sharedDropoffAcknowledged: true,
        });
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin");
        const booking = [...db.bookings.values()][0];
        (0, bookingFlow_1.declineSharedDropoff)(db, booking.id);
        strict_1.default.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
    });
    (0, node_test_1.it)("offers the waitlist after an eligible cancellation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Can");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
        const booking = [...db.bookings.values()][0];
        const result = (0, bookingFlow_1.cancelReservation)(db, booking.id, "2026-10-01T12:00:00.000Z");
        strict_1.default.equal(result.released, true);
        strict_1.default.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
    });
    (0, node_test_1.it)("keeps a confirmed journey confirmed when a replacement seat opens", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Cnf");
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.test/hosted");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
        for (const booking of db.bookings.values()) {
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin", "2026-10-10T08:10:00.000Z");
        }
        (0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id, "2026-10-10T08:20:00.000Z");
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
        const paid = [...db.bookings.values()][0];
        const result = (0, bookingFlow_1.cancelReservation)(db, paid.id, "2026-10-11T08:00:00.000Z");
        strict_1.default.equal(result.journeyStillConfirmed, true);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
        const claimed = await (0, bookingFlow_1.claimWaitlistPlace)(db, [...db.waitlist.values()].find((row) => row.status === "OFFERED").id, "uid_Wait");
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
        strict_1.default.equal(claimed.booking.reservationStatus, "PAYMENT_PENDING");
    });
    (0, node_test_1.it)("does not let waitlist promotion bypass payment", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await fillHeathrow(db, journey.id, 5, "Payb");
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.test/hosted");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
        const booking = [...db.bookings.values()][0];
        booking.paymentDeadlineAt = "2026-10-10T08:30:00.000Z";
        (0, bookingFlow_1.expireUnpaidReservations)(db, "2026-10-10T08:31:00.000Z");
        const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        const claimed = await (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, "uid_Wait", "2026-10-10T08:32:00.000Z");
        strict_1.default.equal(claimed.booking.reservationStatus, "PAYMENT_PENDING");
        strict_1.default.equal(claimed.booking.hostedPaymentStatus, "PAYMENT_PENDING");
        strict_1.default.ok(claimed.booking.paymentDeadlineAt);
        strict_1.default.notEqual(claimed.booking.reservationStatus, "PAID");
    });
    (0, node_test_1.it)("does not let waitlist promotion bypass drop off acceptance", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createCityMatchingJourney)(db, {
            originCity: "Oxford",
            destinationCity: "London",
            departureLocation: "Thornhill Park & Ride",
            travelDate: "2026-10-10",
            departureTime: "10:00",
            farePence: 4500,
        });
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "South Kensington", city: "London", enabled: true });
        const provider = new paymentProvider_1.MockPaymentProvider();
        await (0, bookingFlow_1.reservePlace)(db, provider, {
            action: "join",
            airportId: journey.airportId,
            travelDate: journey.travelDate,
            preferredDepartureTime: journey.departureTime,
            journeyId: journey.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact("CityA"), flexibility: "exact" },
            idempotencyKey: "city-wl-a-xxxxxx",
            termsAccepted: true,
            intendedDestinationText: "Chelsea",
            sharedDropoffAcknowledged: true,
        });
        (0, bookingFlow_1.proposeSharedDropoff)(db, journey.id, hub.id, "admin");
        strict_1.default.equal((0, bookingFlow_1.reservationStageForIncomingPassenger)(db.journeys.get(journey.id), db.config, new Date().toISOString()).reservationStatus, "PROVISIONAL");
        db.journeys.get(journey.id).occupiedSeats = journey.capacity;
        (0, bookingFlow_1.addWaitlist)(db, journey.id, {
            ...contact("Wait"),
            passengers: 1,
            termsAccepted: true,
            intendedDestinationText: "Chelsea",
            sharedDropoffAcknowledged: true,
        });
        db.journeys.get(journey.id).occupiedSeats = 0;
        db.journeys.get(journey.id).waitlistOfferOutstanding = false;
        const offered = await (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id);
        const claimed = await (0, bookingFlow_1.claimWaitlistPlace)(db, offered.id, "uid_Wait");
        strict_1.default.equal(claimed.booking.reservationStatus, "PROVISIONAL");
        strict_1.default.equal(claimed.booking.hostedPaymentStatus, "UNPAID");
        strict_1.default.equal(claimed.booking.sharedDropoffAcceptedAt, undefined);
        (0, bookingFlow_1.acceptSharedDropoff)(db, claimed.booking.id);
        strict_1.default.ok(db.bookings.get(claimed.booking.id)?.sharedDropoffAcceptedAt);
    });
    (0, node_test_1.it)("keeps the existing Heathrow flow operational", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        const first = await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "join",
            airportId: "heathrow",
            travelDate: "2026-10-12",
            preferredDepartureTime: "14:00",
            journeyId: journey.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact("Heath"), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
            idempotencyKey: "heath-keep-01xx",
            termsAccepted: true,
        });
        strict_1.default.equal(first.ok, true);
        strict_1.default.equal(first.status, "GATHERING_INTEREST");
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(pub.destinationLabel.includes("Heathrow"), true);
        strict_1.default.equal(pub.remainingSeats, 4);
    });
    (0, node_test_1.it)("does not show other waitlist identities to a customer", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        db.journeys.get(journey.id).occupiedSeats = 5;
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true });
        const mine = (0, bookingFlow_1.customerWaitlistViews)(db, "uid_First");
        strict_1.default.equal(mine.length, 1);
        strict_1.default.ok(!JSON.stringify(mine).includes("Second"));
        strict_1.default.ok(!JSON.stringify(mine).includes("second@example.com"));
    });
    (0, node_test_1.it)("shows a customer only their own interest, including a private intended destination", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        (0, bookingFlow_1.expressInterest)(db, interestBase("A"));
        (0, bookingFlow_1.expressInterest)(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
        const mine = (0, bookingFlow_1.customerInterestViews)(db, "uid_A");
        strict_1.default.equal(mine.length, 1);
        strict_1.default.equal(mine[0].intendedDestinationText, "South Kensington");
        strict_1.default.ok(!JSON.stringify(mine).includes("Chelsea"));
        strict_1.default.ok(!JSON.stringify((0, bookingFlow_1.listPublicInterestGroups)(db)).includes("South Kensington"));
    });
});
function remaining(db, journeyId) {
    const journey = db.journeys.get(journeyId);
    return Math.max(0, journey.capacity - journey.occupiedSeats);
}
