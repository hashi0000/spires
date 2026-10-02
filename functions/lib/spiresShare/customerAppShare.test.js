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
const hostedPayment_1 = require("./hostedPayment");
const logic_1 = require("./logic");
function contact(name, uid = `uid_${name}`) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        uid,
    };
}
(0, node_test_1.describe)("customer initiated Spires Share", () => {
    (0, node_test_1.it)("logged in customer can start a new request without an existing Share booking", () => {
        strict_1.default.equal((0, bookingFlow_1.requireShareAuth)("uid_new"), "uid_new");
        strict_1.default.throws(() => (0, bookingFlow_1.requireShareAuth)(undefined));
        const db = new bookingFlow_1.InMemoryShareDb();
        strict_1.default.equal((0, bookingFlow_1.customerInterestViews)(db, "uid_new").length, 0);
    });
    (0, node_test_1.it)("customer can enter a route and join compatible interest or create their own", () => {
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
            ...contact("Ada"),
        });
        const suggested = (0, interestGroups_1.previewCompatibleInterest)([...db.interestGroups.values()], {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:10",
            flexibility: "plus_minus_30",
            passengers: 1,
        });
        strict_1.default.equal(suggested?.publicNumber, first.group.publicNumber);
        const joined = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:10",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "Chelsea",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Bea"),
        });
        strict_1.default.equal(joined.joinedExisting, true);
        const own = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "18:00",
            flexibility: "exact",
            passengers: 1,
            intendedDestinationText: "Canary Wharf",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Cyd"),
        });
        strict_1.default.equal(own.joinedExisting, false);
        strict_1.default.notEqual(own.group.id, first.group.id);
        const mine = (0, bookingFlow_1.customerInterestViews)(db, "uid_Ada");
        strict_1.default.equal(mine.length, 1);
        strict_1.default.equal(mine[0].status, "ACTIVE");
        const pub = (0, bookingFlow_1.listPublicInterestGroups)(db);
        strict_1.default.equal(pub.find((row) => row.publicNumber === first.group.publicNumber)?.interestedSeatCount, 2);
        strict_1.default.equal("name" in pub[0], false);
    });
    (0, node_test_1.it)("customer can withdraw unpaid interest", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "Paddington",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Dee"),
        });
        (0, bookingFlow_1.withdrawInterest)(db, created.entry.id, "uid_Dee");
        strict_1.default.equal(db.interestEntries.get(created.entry.id)?.status, "WITHDRAWN");
    });
    (0, node_test_1.it)("CITY intended destination stays private and Heathrow collects flight terminals", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const city = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "South Kensington",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Eli"),
        });
        const air = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "Heathrow",
            travelDate: "2026-10-12",
            preferredDepartureTime: "14:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            departureTerminal: "T5",
            flightNumber: "BA123",
            flightDepartureTime: "18:30",
            termsAccepted: true,
            ...contact("Fay"),
        });
        const pub = (0, bookingFlow_1.listPublicInterestGroups)(db);
        strict_1.default.equal(JSON.stringify(pub).includes("intendedDestinationText"), false);
        const cityView = (0, bookingFlow_1.customerInterestViews)(db, "uid_Eli")[0];
        const airView = (0, bookingFlow_1.customerInterestViews)(db, "uid_Fay")[0];
        strict_1.default.equal(cityView.intendedDestinationText, "South Kensington");
        strict_1.default.equal(airView.departureTerminal, "T5");
        strict_1.default.equal(airView.flightNumber, "BA123");
        strict_1.default.equal(city.group.destinationMatchingEnabled, true);
        strict_1.default.equal(air.group.journeyType, "AIRPORT");
    });
    (0, node_test_1.it)("proposed journey appears, can be accepted or declined, and CITY drop off is required before payment", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "South Kensington",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Gus"),
        });
        const proposed = (0, bookingFlow_1.proposeJourneyFromInterest)(db, created.group.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "10:15",
            farePence: 4500,
            capacity: 5,
        });
        const view = (0, bookingFlow_1.customerInterestViews)(db, "uid_Gus")[0];
        strict_1.default.equal(view.canAcceptProposal, true);
        strict_1.default.equal(view.proposedFarePence, 4500);
        const accepted = (0, bookingFlow_1.acceptProposedInterestJourney)(db, created.entry.id, "uid_Gus");
        const hub = (0, bookingFlow_1.createDropoffHub)(db, { name: "Victoria", city: "London", enabled: true });
        (0, bookingFlow_1.proposeSharedDropoff)(db, accepted.booking.journeyId || proposed.id, hub.id, "admin@example.com");
        const booking = accepted.booking;
        const customer = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(booking.journeyId), booking, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(customer.paymentLinkAvailable, false);
        strict_1.default.equal(customer.canAcceptSharedDropoff, true);
        strict_1.default.equal(proposed.farePence, 4500);
        const other = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "Wembley",
            travelDate: "2026-10-17",
            preferredDepartureTime: "12:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            termsAccepted: true,
            ...contact("Ned"),
        });
        (0, bookingFlow_1.proposeJourneyFromInterest)(db, other.group.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "12:15",
            farePence: 4000,
            capacity: 5,
        });
        const declined = (0, bookingFlow_1.declineProposedInterestJourney)(db, other.entry.id, "uid_Ned");
        strict_1.default.equal(declined.status, "DECLINED_PROPOSAL");
    });
    (0, node_test_1.it)("returning from hosted payment does not mark paid until admin verifies", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "join",
            airportId: "heathrow",
            travelDate: journey.travelDate,
            preferredDepartureTime: journey.departureTime,
            journeyId: journey.id,
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact("Hal"), flexibility: "plus_minus_30", dropoffTerminal: "T3", departureTerminal: "T5" },
            idempotencyKey: "app-pay-01xxxxxxxx",
            termsAccepted: true,
        });
        const booking = [...db.bookings.values()][0];
        booking.paymentSubmittedAt = new Date().toISOString();
        const view = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(journey.id), booking, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.hostedPaymentStatus === "PAID", false);
        strict_1.default.match(String(view.paymentSubmittedNotice), /confirming your payment/);
        strict_1.default.equal(view.terminalGuideLabel, "How to get from T3 to T5");
        (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        const paid = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(journey.id), db.bookings.get(booking.id), [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(paid.hostedPaymentStatus, "PAID");
    });
    (0, node_test_1.it)("waitlist can be joined, offered and claimed without exceeding capacity", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        for (let i = 0; i < 5; i += 1) {
            await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
                action: "join",
                airportId: "heathrow",
                travelDate: journey.travelDate,
                preferredDepartureTime: journey.departureTime,
                journeyId: journey.id,
                passengers: 1,
                luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
                contact: { ...contact(`Ivy${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
                idempotencyKey: `app-wl-ivy${i}xxxxxx`,
                termsAccepted: true,
            });
        }
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Jay"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
        (0, bookingFlow_1.addWaitlist)(db, journey.id, { ...contact("Kay"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:05:00.000Z" });
        const views = (0, bookingFlow_1.customerWaitlistViews)(db, "uid_Jay");
        strict_1.default.equal(views[0].status, "WAITING");
        (0, bookingFlow_1.cancelReservation)(db, [...db.bookings.values()][0].id);
        const offered = (0, bookingFlow_1.customerWaitlistViews)(db, "uid_Jay", "2026-10-01T10:05:00.000Z")[0];
        strict_1.default.equal(offered.canClaim, true);
        await (0, bookingFlow_1.claimWaitlistPlace)(db, offered.waitlistId, "uid_Jay", "2026-10-01T10:10:00.000Z");
        strict_1.default.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
        const kay = [...db.waitlist.values()].find((row) => row.uid === "uid_Kay");
        strict_1.default.notEqual(kay.status, "ACCEPTED");
    });
    (0, node_test_1.it)("confirmed Share journeys stay distinct from interest and ordinary taxi bookings", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
        for (let i = 0; i < 5; i += 1) {
            await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
                action: "join",
                airportId: "heathrow",
                travelDate: journey.travelDate,
                preferredDepartureTime: journey.departureTime,
                journeyId: journey.id,
                passengers: 1,
                luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
                contact: { ...contact(`P${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
                idempotencyKey: `app-conf-${i}xxxxxxxx`,
                termsAccepted: true,
            });
        }
        (0, bookingFlow_1.savePaymentLink)(db, journey.id, "https://pay.example.com/share35");
        (0, bookingFlow_1.openPaymentWindow)(db, journey.id);
        for (const booking of db.bookings.values())
            (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin");
        (0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id);
        const view = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(journey.id), [...db.bookings.values()][0], [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.journeyStatus, "CONFIRMED");
        strict_1.default.equal(view.customerStatusLabel, "Journey confirmed");
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journey.id), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(pub.guarantee, "CONFIRMED");
    });
    (0, node_test_1.it)("updating interest rematches when the window no longer overlaps", () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const created = (0, bookingFlow_1.expressInterest)(db, {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "10:00",
            flexibility: "plus_minus_30",
            passengers: 1,
            intendedDestinationText: "Camden",
            sharedDropoffAcknowledged: true,
            termsAccepted: true,
            ...contact("Lee"),
        });
        const moved = (0, bookingFlow_1.updateInterestEntry)(db, created.entry.id, "uid_Lee", {
            origin: "Oxford",
            destinationRegion: "London",
            travelDate: "2026-10-10",
            preferredDepartureTime: "18:00",
            flexibility: "exact",
            passengers: 1,
            intendedDestinationText: "Camden",
            sharedDropoffAcknowledged: true,
        });
        strict_1.default.equal(moved.rematched, true);
        strict_1.default.notEqual(moved.group.id, created.group.id);
    });
});
