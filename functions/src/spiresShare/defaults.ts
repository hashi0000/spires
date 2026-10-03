import { SHARE_TERMS_VERSION, ShareConfig, SharePilotDefaults } from "./types";

/** Default rules are proposed only — all require approval before public launch. */
export const DEFAULT_SHARE_CONFIG: ShareConfig = {
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
  shareTermsVersion: SHARE_TERMS_VERSION,
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
    interestRegistrationHours: 48,
    paymentReminderMinutesBeforeDeadline: 30,
    paymentFinalReminderMinutesBeforeDeadline: 10,
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
  londonShareAreas: [
    { id: "london_west", name: "London West", defaultShareFarePenceMin: 3500, defaultShareFarePenceMax: 4000 },
    { id: "london_central", name: "London Central", defaultShareFarePenceMin: 4000, defaultShareFarePenceMax: 4500 },
    { id: "london_east", name: "London East", defaultShareFarePenceMin: 4500, defaultShareFarePenceMax: 5000 },
    { id: "london_extended", name: "London Extended", defaultShareFarePenceMin: 5000, defaultShareFarePenceMax: 6000 },
  ],
  shareVenues: [
    {
      id: "wembley",
      name: "Wembley Stadium",
      londonAreaId: "london_west",
      defaultFarePence: 4000,
      defaultReturnFarePence: 7500,
      defaultPassengerCap: 5,
      defaultPickup: "Thornhill Park and Ride",
      venueDropoffPoint: "Wembley Stadium area",
      suggestedDepartureBufferMinutes: 180,
      eventCategory: "football",
    },
    {
      id: "o2",
      name: "The O2",
      londonAreaId: "london_extended",
      defaultFarePence: 5000,
      defaultReturnFarePence: 9000,
      defaultPassengerCap: 5,
      defaultPickup: "Thornhill Park and Ride",
      venueDropoffPoint: "The O2 area",
      suggestedDepartureBufferMinutes: 180,
      eventCategory: "concert",
    },
    {
      id: "excel",
      name: "ExCeL London",
      londonAreaId: "london_east",
      defaultFarePence: 5000,
      defaultReturnFarePence: 9000,
      defaultPassengerCap: 5,
      defaultPickup: "Thornhill Park and Ride",
      venueDropoffPoint: "ExCeL London area",
      suggestedDepartureBufferMinutes: 180,
      eventCategory: "exhibition",
    },
    {
      id: "allianz",
      name: "Allianz Stadium",
      londonAreaId: "london_extended",
      defaultFarePence: 4500,
      defaultReturnFarePence: 8500,
      defaultPassengerCap: 5,
      defaultPickup: "Thornhill Park and Ride",
      venueDropoffPoint: "Allianz Stadium area",
      suggestedDepartureBufferMinutes: 180,
      eventCategory: "football",
    },
  ],
};

export function envFlagTrue(value: string | undefined): boolean {
  return String(value || "false").toLowerCase() === "true";
}

export const SPIRES_SHARE_PUBLIC_ENABLED = envFlagTrue(process.env.SPIRES_SHARE_ENABLED);

export const SPIRES_SHARE_PILOT_ENABLED = envFlagTrue(process.env.SPIRES_SHARE_PILOT);

export function defaultPilotDefaults(): SharePilotDefaults {
  return { ...DEFAULT_SHARE_CONFIG.pilotDefaults };
}

export const SHARE_TIMEZONE = "Europe/London";

export const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

export const COLLECTIONS = {
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
} as const;
