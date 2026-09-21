"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPIRES_SHARE_PUBLIC_ENABLED = exports.DEFAULT_SHARE_CONFIG = void 0;
/** Default rules are proposed only — all require approval before public launch. */
exports.DEFAULT_SHARE_CONFIG = {
    publicEnabled: false,
    requiresRegulatoryApproval: true,
    passengerCapacity: 5,
    earlyDepartureThreshold: 4,
    maxHomeCollectionsPerJourney: 2,
    confirmationDeadlineHoursBeforeDeparture: 24,
    checkInHoursBeforeDeparture: 24,
    arriveBeforeDepartureMinutes: 15,
    boardingClosesMinutesBeforeDeparture: 5,
    matchingFlexibility: ["exact", "plus_minus_15", "plus_minus_30", "plus_minus_60"],
    waitlistEnabled: true,
    homeCollectionSurchargePence: 0,
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
            dropoffLabel: "Heathrow Terminals 2 & 3",
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
};
exports.SPIRES_SHARE_PUBLIC_ENABLED = String(process.env.SPIRES_SHARE_ENABLED || "false").toLowerCase() === "true";
