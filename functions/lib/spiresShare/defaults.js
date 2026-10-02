"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.ADMIN_EMAILS = exports.SHARE_TIMEZONE = exports.SPIRES_SHARE_PILOT_ENABLED = exports.SPIRES_SHARE_PUBLIC_ENABLED = exports.DEFAULT_SHARE_CONFIG = void 0;
exports.envFlagTrue = envFlagTrue;
exports.defaultPilotDefaults = defaultPilotDefaults;
const types_1 = require("./types");
/** Default rules are proposed only — all require approval before public launch. */
exports.DEFAULT_SHARE_CONFIG = {
    publicEnabled: false,
    requiresRegulatoryApproval: true,
    mvpAirportIds: ["heathrow"],
    previewTesterEmails: [],
    passengerCapacity: 5,
    earlyDepartureThreshold: 4,
    maxHomeCollectionsPerJourney: 2,
    homeCollectionCustomerEnabled: false,
    confirmationDeadlineHoursBeforeDeparture: 24,
    paymentActionHours: 2,
    paymentWindowHours: 2,
    paymentQuietHoursStart: "22:00",
    paymentQuietHoursEnd: "07:00",
    paymentJoinerMinimumMinutes: 30,
    shareTermsVersion: types_1.SHARE_TERMS_VERSION,
    waitlistOfferMinutes: 60,
    checkInHoursBeforeDeparture: 24,
    arriveBeforeDepartureMinutes: 15,
    boardingClosesMinutesBeforeDeparture: 5,
    matchingFlexibility: ["exact", "plus_minus_15", "plus_minus_30", "plus_minus_60"],
    waitlistEnabled: true,
    homeCollectionSurchargePence: 0,
    dropoffMode: "per_passenger_terminal",
    heathrowTerminals: ["T2", "T3", "T4", "T5"],
    luggage: {
        largeSuitcasesPerPassenger: 1,
        cabinBagsPerPassenger: 1,
        maxLargeSuitcasesPerVehicle: 5,
        maxCabinBagsPerVehicle: 5,
    },
    meetingPoint: {
        id: "thornhill_pr",
        publicName: "Thornhill Park & Ride",
    },
    airports: [
        {
            id: "heathrow",
            name: "Heathrow",
            dropoffLabel: "Heathrow Airport",
            farePence: 3500,
            targetRevenuePence: 17500,
            estimatedDurationMinutes: 75,
            flightSafetyBufferMinutes: 180,
        },
        {
            id: "gatwick",
            name: "Gatwick",
            dropoffLabel: "Gatwick Airport",
            farePence: 4500,
            targetRevenuePence: 22500,
            estimatedDurationMinutes: 110,
            flightSafetyBufferMinutes: 180,
        },
    ],
    notificationsSend: false,
    cityMatchingPublicEnabled: false,
    pilotDefaults: {
        airportId: "heathrow",
        originLabel: "Oxford",
        departureLocation: "Thornhill Park & Ride",
        destinationLabel: "Heathrow Airport Terminal 3",
        destinationTerminal: "T3",
        vehicleLabel: "Mercedes Vito",
        farePence: 3500,
        targetRevenuePence: 17500,
        capacity: 5,
        minPassengerThreshold: 4,
        confirmationDeadlineHoursBeforeDeparture: 24,
    },
};
function envFlagTrue(value) {
    return String(value || "false").toLowerCase() === "true";
}
exports.SPIRES_SHARE_PUBLIC_ENABLED = envFlagTrue(process.env.SPIRES_SHARE_ENABLED);
exports.SPIRES_SHARE_PILOT_ENABLED = envFlagTrue(process.env.SPIRES_SHARE_PILOT);
function defaultPilotDefaults() {
    return { ...exports.DEFAULT_SHARE_CONFIG.pilotDefaults };
}
exports.SHARE_TIMEZONE = "Europe/London";
exports.ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
exports.COLLECTIONS = {
    CONFIG: "spiresShareConfig/current",
    JOURNEYS: "spiresShareJourneys",
    BOOKINGS: "spiresShareBookings",
    WAITLIST: "spiresShareWaitlist",
    AUDIT: "spiresShareAudit",
    PAYMENTS: "spiresSharePayments",
    SLOTS: "spiresShareSlots",
    IDEMPOTENCY: "spiresShareIdempotency",
    NOTIFICATIONS: "spiresShareNotifications",
    DROPOFF_HUBS: "spiresShareDropoffHubs",
    INTEREST_GROUPS: "spiresShareInterestGroups",
    INTEREST_ENTRIES: "spiresShareInterestEntries",
};
