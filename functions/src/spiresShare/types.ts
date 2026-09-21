export type JourneyStatus =
  | "PROPOSED"
  | "FILLING"
  | "ALMOST_FULL"
  | "AWAITING_EARLY_DEPARTURE_DECISION"
  | "CONFIRMED"
  | "FULL"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED";

export type Flexibility = "exact" | "plus_minus_15" | "plus_minus_30" | "plus_minus_60";

export type HomeCollectionEligibility =
  | "HOME_COLLECTION_ELIGIBLE"
  | "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE"
  | "HOME_COLLECTION_UNAVAILABLE";

export type PaymentStatus =
  | "PAYMENT_METHOD_PENDING"
  | "AUTHORISATION_PENDING"
  | "AUTHORISED"
  | "CAPTURE_PENDING"
  | "CAPTURED"
  | "AUTHORISATION_RELEASED"
  | "FAILED"
  | "REFUNDED";

export type WaitlistStatus = "WAITLISTED" | "OFFERED" | "ACCEPTED" | "EXPIRED";

export type PassengerBoardStatus = "NOT_CHECKED_IN" | "CHECKED_IN" | "BOARDED" | "NO_SHOW";

export type AuditEventType =
  | "JOURNEY_CREATED"
  | "PASSENGER_JOINED"
  | "PASSENGER_LEFT"
  | "PAYMENT_AUTHORISED"
  | "PAYMENT_FAILED"
  | "JOURNEY_FULL"
  | "EARLY_DEPARTURE_OFFERED"
  | "EARLY_DEPARTURE_ACCEPTED"
  | "JOURNEY_CONFIRMED"
  | "JOURNEY_EXPIRED"
  | "JOURNEY_CANCELLED"
  | "PASSENGER_CHECKED_IN"
  | "PASSENGER_NO_SHOW"
  | "VEHICLE_DEPARTED"
  | "JOURNEY_COMPLETED";

export type ShareAirport = {
  id: string;
  name: string;
  dropoffLabel: string;
  farePence: number;
  targetRevenuePence: number;
  estimatedDurationMinutes: number;
  flightSafetyBufferMinutes: number;
};

export type ShareMeetingPoint = {
  id: string;
  publicName: string;
};

export type ShareLuggageAllowance = {
  largeSuitcasesPerPassenger: number;
  cabinBagsPerPassenger: number;
  maxLargeSuitcasesPerVehicle: number;
  maxCabinBagsPerVehicle: number;
};

export type ShareConfig = {
  publicEnabled: boolean;
  /** Requires approval. Default false — Share is not launched. */
  requiresRegulatoryApproval: boolean;
  passengerCapacity: number;
  earlyDepartureThreshold: number;
  maxHomeCollectionsPerJourney: number;
  confirmationDeadlineHoursBeforeDeparture: number;
  checkInHoursBeforeDeparture: number;
  arriveBeforeDepartureMinutes: number;
  boardingClosesMinutesBeforeDeparture: number;
  matchingFlexibility: Flexibility[];
  waitlistEnabled: boolean;
  homeCollectionSurchargePence: number;
  luggage: ShareLuggageAllowance;
  meetingPoint: ShareMeetingPoint;
  airports: ShareAirport[];
};

export type LuggageDeclaration = {
  largeSuitcases: number;
  cabinBags: number;
  other: string;
};

export type ShareSearchRequest = {
  airportId: string;
  travelDate: string;
  preferredDepartureTime: string;
  flexibility: Flexibility;
  flightDepartureTime?: string;
  passengers: number;
  luggage: LuggageDeclaration;
};

export type PublicJourneyView = {
  id: string;
  airportId: string;
  airportName: string;
  meetingPointName: string;
  dropoffLabel: string;
  travelDate: string;
  departureTime: string;
  approximateArrival: string;
  occupiedSeats: number;
  remainingSeats: number;
  capacity: number;
  farePence: number;
  status: JourneyStatus;
  confirmed: boolean;
  warning?: string;
};

export type ShareJourney = {
  id: string;
  publicNumber: string;
  airportId: string;
  travelDate: string;
  departureTime: string;
  status: JourneyStatus;
  capacity: number;
  occupiedSeats: number;
  farePence: number;
  targetRevenuePence: number;
  earlyDepartureOffered: boolean;
  earlyDepartureAcceptedBookingIds: string[];
  homeCollectionCount: number;
  waitlistCount: number;
  confirmationDeadlineAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ShareBooking = {
  id: string;
  journeyId: string;
  passengers: number;
  name: string;
  mobile: string;
  email: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  flexibility: Flexibility;
  luggage: LuggageDeclaration;
  homePostcode?: string;
  homeCollection: HomeCollectionEligibility;
  homeCollectionSurchargePence: number;
  paymentId?: string;
  paymentStatus: PaymentStatus;
  boardStatus: PassengerBoardStatus;
  earlyDepartureAccepted: boolean;
  createdAt: string;
};

export type MockPayment = {
  id: string;
  bookingId: string;
  amountPence: number;
  status: PaymentStatus;
};

export const UNCONFIRMED_WARNING =
  "This journey is not yet confirmed. Do not rely on this transfer until you receive confirmation from Spires Share.";
