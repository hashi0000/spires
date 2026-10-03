export type JourneyStatus =
  | "GATHERING_INTEREST"
  | "READY_FOR_PAYMENT_SETUP"
  | "PAYMENT_WINDOW_OPEN"
  | "AWAITING_FINAL_PASSENGER"
  | "FOUR_PASSENGER_OPTION"
  | "SUPPLEMENT_PAYMENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "PROPOSED"
  | "FILLING"
  | "ALMOST_FULL"
  | "FULL"
  | "AWAITING_EARLY_DEPARTURE_DECISION"
  | "PAYMENT_ACTION_REQUIRED"
  | "AWAITING_DROPOFF_SELECTION"
  | "AWAITING_DROPOFF_ACCEPTANCE";

export type PublicJourneyStatus = "FILLING" | "ALMOST_FULL" | "FULL" | "CONFIRMED";

export type PublicGuarantee = "PROVISIONAL" | "CONFIRMED";

export type PaymentStageStatus = "NOT_CREATED" | "LINK_SAVED" | "OPEN" | "CLOSED";

export type ReservationStatus =
  | "PROVISIONAL"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PAYMENT_EXPIRED"
  | "CANCELLED"
  | "LATE_CANCELLED"
  | "NO_SHOW"
  | "DROP_OFF_DECLINED";

export type HostedPaymentStatus = "UNPAID" | "PAYMENT_PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "RETAINED";

export type CancellationCategory = "FREE" | "LATE_CANCELLATION" | "NO_SHOW" | "OPERATOR";

export type RefundStatus = "NONE" | "PENDING" | "REFUNDED" | "RETAINED" | "PARTIAL";

export type Flexibility = "exact" | "plus_minus_15" | "plus_minus_30" | "plus_minus_60";

export type HeathrowTerminal = "T2" | "T3" | "T4" | "T5";

export type FlightTerminal = HeathrowTerminal | "UNSURE";

export type DropoffMode = "per_passenger_terminal" | "common_dropoff";

export type JourneyType = "AIRPORT" | "CITY" | "EVENT" | "OTHER";

export type DestinationMatchQuality = "GOOD_MATCH" | "ACCEPTABLE_MATCH" | "POOR_MATCH" | "MANUAL_REVIEW";

export type SharedDropoffCustomerStatus = "NOT_SELECTED" | "PROPOSED" | "ACCEPTED" | "DECLINED";

export type LatLng = {
  lat: number;
  lng: number;
};

export type ShareDropoffHub = {
  id: string;
  hubId: string;
  name: string;
  city: string;
  displayName: string;
  address?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  enabled: boolean;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type HomeCollectionEligibility =
  | "HOME_COLLECTION_ELIGIBLE"
  | "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE"
  | "HOME_COLLECTION_UNAVAILABLE";

export type PaymentStatus =
  | "HOSTED_UNPAID"
  | "HOSTED_PENDING"
  | "HOSTED_PAID"
  | "HOSTED_EXPIRED"
  | "PAYMENT_METHOD_REQUIRED"
  | "PAYMENT_METHOD_VERIFIED"
  | "PAYMENT_ACTION_REQUIRED"
  | "AUTHORISATION_PENDING"
  | "AUTHORISED"
  | "CAPTURE_PENDING"
  | "CAPTURED"
  | "AUTHORISATION_RELEASED"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUNDED";

export type WaitlistStatus = "WAITLISTED" | "WAITING" | "OFFERED" | "ACCEPTED" | "EXPIRED" | "DECLINED" | "REMOVED";

export type PassengerBoardStatus = "NOT_CHECKED_IN" | "CHECKED_IN" | "BOARDED" | "NO_SHOW";

export type NotificationType =
  | "BOOKING_RECEIVED"
  | "JOURNEY_FILLING"
  | "JOURNEY_CONFIRMED"
  | "PAYMENT_PROBLEM"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_DEADLINE_APPROACHING"
  | "PAYMENT_EXPIRED"
  | "SUPPLEMENT_PAYMENT_REQUIRED"
  | "EARLY_DEPARTURE_OFFERED"
  | "DEPARTURE_TIME_CHANGED"
  | "JOURNEY_DID_NOT_FILL"
  | "JOURNEY_CANCELLED"
  | "TRAVEL_REMINDER"
  | "JOURNEY_REMINDER_24H"
  | "DEPARTURE_REMINDER"
  | "WAITLIST_OFFERED"
  | "PLACE_RELEASED"
  | "CANCELLATION_CONFIRMED"
  | "SHARED_DROPOFF_PROPOSED"
  | "SHARED_DROPOFF_CHANGED"
  | "INTEREST_RECEIVED"
  | "INTEREST_GROUP_READY"
  | "JOURNEY_PROPOSED_FROM_INTEREST"
  | "WAITLIST_PLACE_AVAILABLE"
  | "ADMIN_NEW_INTEREST"
  | "ADMIN_THRESHOLD_REACHED"
  | "ADMIN_ALL_PAYMENTS_RECEIVED"
  | "ADMIN_PAYMENT_WINDOW_EXPIRED"
  | "INTEREST_PROGRESS_ONE_MORE"
  | "INTEREST_EXPIRED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_WINDOW_EXPIRED_CUSTOMER"
  | "PAYMENT_DEADLINE_EXTENDED"
  | "DRIVER_MANIFEST"
  | "DRIVER_MANIFEST_UPDATED"
  | "DRIVER_MANIFEST_REMINDER";

export type AuditEventType =
  | "JOURNEY_CREATED"
  | "PASSENGER_JOINED"
  | "PASSENGER_LEFT"
  | "PAYMENT_LINK_SAVED"
  | "PAYMENT_WINDOW_OPENED"
  | "PAYMENT_STATUS_CHANGED"
  | "PAYMENT_METHOD_VERIFIED"
  | "PAYMENT_AUTHORISED"
  | "PAYMENT_FAILED"
  | "PAYMENT_ACTION_REQUIRED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_RELEASED"
  | "PAYMENT_REFUNDED"
  | "JOURNEY_FULL"
  | "EARLY_DEPARTURE_OFFERED"
  | "EARLY_DEPARTURE_ACCEPTED"
  | "EARLY_DEPARTURE_REJECTED"
  | "FOUR_PASSENGER_OFFERED"
  | "FOUR_PASSENGER_ACCEPTED"
  | "FOUR_PASSENGER_REJECTED"
  | "SUPPLEMENT_LINK_SAVED"
  | "SUPPLEMENT_WINDOW_OPENED"
  | "SUPPLEMENT_STATUS_CHANGED"
  | "JOURNEY_CONFIRMED"
  | "JOURNEY_EXPIRED"
  | "JOURNEY_CANCELLED"
  | "RESERVATION_EXPIRED"
  | "PASSENGER_CHECKED_IN"
  | "PASSENGER_NO_SHOW"
  | "VEHICLE_DEPARTED"
  | "JOURNEY_COMPLETED"
  | "WAITLIST_OFFERED"
  | "WAITLIST_ACCEPTED"
  | "WAITLIST_EXPIRED"
  | "IDEMPOTENT_REPLAY"
  | "DROPOFF_HUB_CREATED"
  | "DROPOFF_HUB_UPDATED"
  | "SHARED_DROPOFF_PROPOSED"
  | "SHARED_DROPOFF_CHANGED"
  | "SHARED_DROPOFF_ACCEPTED"
  | "SHARED_DROPOFF_DECLINED"
  | "INTEREST_CREATED"
  | "INTEREST_JOINED"
  | "INTEREST_CONVERTED"
  | "INTEREST_MERGED"
  | "INTEREST_CLOSED"
  | "WAITLIST_CLAIMED"
  | "WAITLIST_DECLINED"
  | "WAITLIST_PROMOTED"
  | "INTEREST_DEADLINE_CHANGED"
  | "PAYMENT_DEADLINE_CHANGED"
  | "INTEREST_EXPIRED"
  | "BOARDING_CODE_ISSUED"
  | "BOARDING_VERIFIED"
  | "DRIVER_MANIFEST_SENT"
  | "DRIVER_MANIFEST_UPDATED";

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
  requiresRegulatoryApproval: boolean;
  mvpAirportIds: string[];
  previewTesterEmails: string[];
  passengerCapacity: number;
  earlyDepartureThreshold: number;
  maxHomeCollectionsPerJourney: number;
  homeCollectionCustomerEnabled: boolean;
  confirmationDeadlineHoursBeforeDeparture: number;
  paymentActionHours: number;
  paymentWindowHours: number;
  paymentQuietHoursStart: string;
  paymentQuietHoursEnd: string;
  paymentJoinerMinimumMinutes: number;
  shareTermsVersion: string;
  waitlistOfferMinutes: number;
  checkInHoursBeforeDeparture: number;
  arriveBeforeDepartureMinutes: number;
  boardingClosesMinutesBeforeDeparture: number;
  matchingFlexibility: Flexibility[];
  waitlistEnabled: boolean;
  homeCollectionSurchargePence: number;
  dropoffMode: DropoffMode;
  heathrowTerminals: HeathrowTerminal[];
  luggage: ShareLuggageAllowance;
  meetingPoint: ShareMeetingPoint;
  airports: ShareAirport[];
  notificationsSend: boolean;
  cityMatchingPublicEnabled: boolean;
  interestRegistrationHours: number;
  paymentReminderMinutesBeforeDeadline: number;
  paymentFinalReminderMinutesBeforeDeadline: number;
  pilotDefaults: SharePilotDefaults;
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

export type SharePilotDefaults = {
  airportId: string;
  originLabel: string;
  departureLocation: string;
  destinationLabel: string;
  destinationTerminal: HeathrowTerminal;
  vehicleLabel: string;
  farePence: number;
  targetRevenuePence: number;
  capacity: number;
  minPassengerThreshold: number;
  confirmationDeadlineHoursBeforeDeparture: number;
};

export type PublicJourneyView = {
  publicNumber: string;
  airportId: string;
  airportName: string;
  originLabel: string;
  meetingPointName: string;
  destinationLabel: string;
  travelDate: string;
  departureTime: string;
  recommendedArrivalTime: string;
  graceUntilTime: string;
  approximateArrival: string;
  occupiedSeats: number;
  remainingSeats: number;
  capacity: number;
  farePence: number;
  publicStatus: PublicJourneyStatus;
  journeyStatus: JourneyStatus;
  guarantee: PublicGuarantee;
  warning?: string;
  journeyType: JourneyType;
  originCity?: string;
  destinationCity?: string;
  destinationMatchingEnabled: boolean;
  proposedSharedDropoffDisplayName?: string;
};

export type ShareJourney = {
  id: string;
  publicNumber: string;
  airportId: string;
  travelDate: string;
  departureTime: string;
  departureAt: string;
  confirmationDeadlineAt: string;
  status: JourneyStatus;
  capacity: number;
  occupiedSeats: number;
  farePence: number;
  targetRevenuePence: number;
  originLabel?: string;
  departureLocation?: string;
  destinationLabel?: string;
  destinationTerminal?: HeathrowTerminal;
  vehicleLabel?: string;
  minPassengerThreshold?: number;
  customerVisible?: boolean;
  adminNotes?: string;
  dropoffMode: DropoffMode;
  commonDropoffTerminal?: HeathrowTerminal;
  earlyDepartureOffered: boolean;
  earlyDepartureAcceptedBookingIds: string[];
  homeCollectionCount: number;
  waitlistCount: number;
  waitlistOfferOutstanding?: boolean;
  interestGroupId?: string;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  assignedDriverEmail?: string;
  driverStage?: string;
  driverManifestSentAt?: string;
  driverManifestFingerprint?: string;
  driverManifestVersion?: number;
  driverManifestReminderAt?: string;
  paymentLinkUrl?: string;
  paymentLinkAddedAt?: string;
  paymentWindowOpenedAt?: string;
  paymentDeadlineAt?: string;
  paymentStageStatus?: PaymentStageStatus;
  supplementPaymentLinkUrl?: string;
  supplementLinkAddedAt?: string;
  supplementWindowOpenedAt?: string;
  supplementDeadlineAt?: string;
  confirmedAt?: string;
  confirmationEmailSentAt?: string;
  paymentWindowExpiredNotifiedAt?: string;
  paymentActionRequired?: boolean;
  locked?: boolean;
  fourPassengerFallbackEnabled?: boolean;
  fallbackFarePerPassengerPence?: number;
  journeyType?: JourneyType;
  originCity?: string;
  destinationCity?: string;
  destinationMatchingEnabled?: boolean;
  destinationMatchingPublicEnabled?: boolean;
  suggestedSharedDropoffHubId?: string;
  suggestedSharedDropoffReason?: string;
  proposedSharedDropoffHubId?: string;
  proposedSharedDropoffDisplayName?: string;
  sharedDropoffProposalVersion?: number;
  sharedDropoffProposedAt?: string;
  sharedDropoffProposedBy?: string;
  confirmedSharedDropoffHubId?: string;
  sharedDropoffConfirmedAt?: string;
  sharedDropoffConfirmedBy?: string;
  destinationClusterId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShareBooking = {
  id: string;
  journeyId: string;
  publicNumber: string;
  uid?: string;
  passengers: number;
  name: string;
  mobile: string;
  email: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  dropoffTerminal?: HeathrowTerminal;
  departureTerminal?: FlightTerminal;
  flexibility: Flexibility;
  luggage: LuggageDeclaration;
  homePostcode?: string;
  homeCollection: HomeCollectionEligibility;
  homeCollectionSurchargePence: number;
  paymentId?: string;
  paymentMethodRef?: string;
  paymentStatus: PaymentStatus;
  hostedPaymentStatus?: HostedPaymentStatus;
  reservationStatus?: ReservationStatus;
  paidAmountPence?: number;
  paidAt?: string;
  paymentDeadlineAt?: string;
  paymentSubmittedAt?: string;
  supplementAmountDuePence?: number;
  supplementPaidPence?: number;
  supplementPaidAt?: string;
  fourPassengerAccepted?: boolean;
  fourPassengerAcceptedAt?: string;
  termsAcceptedAt?: string;
  termsVersion?: string;
  cancelledAt?: string;
  hoursBeforeDeparture?: number;
  cancellationCategory?: CancellationCategory;
  seatResold?: boolean;
  replacementBookingId?: string;
  refundStatus?: RefundStatus;
  amountRefundedPence?: number;
  amountRetainedPence?: number;
  adminNotes?: string;
  boardStatus: PassengerBoardStatus;
  boardingCode?: string;
  boardingCodeHash?: string;
  boardingCodeCreatedAt?: string;
  boardingVerifiedAt?: string;
  boardingVerifiedBy?: string;
  earlyDepartureAccepted: boolean;
  manageTokenHash: string;
  idempotencyKey: string;
  createdAt: string;
  paymentRequiredNotifiedAt?: string;
  paymentReminderNotifiedAt?: string;
  paymentFinalReminderNotifiedAt?: string;
  paymentReceivedNotifiedAt?: string;
  paymentExpiredNotifiedAt?: string;
  paymentWindowExpiredCustomerNotifiedAt?: string;
  reminder24hNotifiedAt?: string;
  departureReminderNotifiedAt?: string;
  waitlistId?: string;
  interestEntryId?: string;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  intendedDestinationLat?: number;
  intendedDestinationLng?: number;
  destinationEnteredAt?: string;
  sharedDropoffAcknowledgedAt?: string;
  sharedDropoffAcceptedAt?: string;
  sharedDropoffDeclinedAt?: string;
  acceptedDropoffProposalVersion?: number;
  destinationClusterId?: string;
  preferredDepartureTime?: string;
  flexibleMinutes?: number;
  earliestDepartureTime?: string;
  latestDepartureTime?: string;
};

export type SharePayment = {
  id: string;
  bookingId: string;
  journeyId: string;
  amountPence: number;
  currency: "GBP";
  status: PaymentStatus;
  paymentMethodRef?: string;
  provider: "mock" | "shift4_online" | "hosted_payment_link";
  providerRef?: string;
  failAuthorise?: boolean;
  failCapture?: boolean;
  updatedAt: string;
};

export type InterestGroupStatus =
  | "GATHERING_INTEREST"
  | "READY_FOR_REVIEW"
  | "CONVERTED_TO_JOURNEY"
  | "EXPIRED"
  | "CANCELLED";

export type CustomerShareStage =
  | "REGISTERING_INTEREST"
  | "ENOUGH_INTEREST"
  | "PAYMENT_REQUIRED"
  | "AWAITING_ALL_PAYMENTS"
  | "JOURNEY_CONFIRMED"
  | "NOT_ENOUGH_INTEREST"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED";

export type InterestEntryStatus = "ACTIVE" | "WITHDRAWN" | "CONVERTED" | "DECLINED_PROPOSAL";

export type ShareInterestGroup = {
  id: string;
  publicNumber: string;
  origin: string;
  destinationRegion: string;
  journeyType: JourneyType;
  destinationMatchingEnabled: boolean;
  travelDate: string;
  preferredDepartureTime?: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  interestedSeatCount: number;
  minPassengerThreshold: number;
  status: InterestGroupStatus;
  interestDeadlineAt?: string;
  expiryReason?: "INSUFFICIENT_INTEREST" | "CLOSED" | "PAYMENT_FAILED";
  thresholdReachedNotifiedAt?: string;
  oneMorePassengerNotifiedAt?: string;
  expiredNotifiedAt?: string;
  matchingUncertain?: boolean;
  convertedJourneyId?: string;
  proposedDepartureLocation?: string;
  proposedDepartureTime?: string;
  proposedFarePence?: number;
  proposedAt?: string;
  proposedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShareInterestEntry = {
  id: string;
  interestGroupId: string;
  uid?: string;
  passengers: number;
  name: string;
  email: string;
  mobile?: string;
  preferredDepartureTime?: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  flexibility: Flexibility;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  sharedDropoffAcknowledgedAt?: string;
  termsAcceptedAt?: string;
  status: InterestEntryStatus;
  convertedBookingId?: string;
  termsVersion?: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  departureTerminal?: FlightTerminal;
  dropoffTerminal?: HeathrowTerminal;
  createdAt: string;
};

export type PublicInterestGroupView = {
  publicNumber: string;
  origin: string;
  destinationRegion: string;
  travelDate: string;
  timeLabel: string;
  interestedSeatCount: number;
  status: InterestGroupStatus;
  journeyType: JourneyType;
  requiredSeats: number;
  remainingSeatsNeeded: number;
  enoughInterest: boolean;
  interestDeadlineAt?: string;
  customerStage: CustomerShareStage;
  customerStageLabel: string;
  placesLabel: string;
  neededLabel: string;
  neededHeadline: string;
  preferredDepartureTime?: string;
};

export type ShareWaitlistEntry = {
  id: string;
  journeyId: string;
  status: WaitlistStatus;
  passengers: number;
  name: string;
  email: string;
  mobile?: string;
  uid?: string;
  joinedWaitlistAt?: string;
  offeredAt?: string;
  claimedAt?: string;
  declinedAt?: string;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  sharedDropoffAcknowledgedAt?: string;
  termsAcceptedAt?: string;
  dropoffTerminal?: HeathrowTerminal;
  luggage?: LuggageDeclaration;
  flexibility?: Flexibility;
  offerExpiresAt?: string;
  offerTokenHash?: string;
  createdAt: string;
};

export type CustomerWaitlistView = {
  waitlistId: string;
  publicNumber: string;
  travelDate: string;
  departureTime: string;
  originLabel: string;
  destinationLabel: string;
  passengers: number;
  status: WaitlistStatus;
  waitlistPosition: number;
  offerExpiresAt?: string;
  canClaim: boolean;
  canDecline: boolean;
};

export type CustomerInterestView = {
  interestEntryId: string;
  publicNumber: string;
  origin: string;
  destinationRegion: string;
  travelDate: string;
  timeLabel: string;
  passengers: number;
  status: InterestEntryStatus;
  groupStatus: InterestGroupStatus;
  proposedDepartureLocation?: string;
  proposedDepartureTime?: string;
  proposedFarePence?: number;
  canAcceptProposal: boolean;
  canDeclineProposal: boolean;
  intendedDestinationText?: string;
  journeyType?: JourneyType;
  preferredDepartureTime?: string;
  flexibility?: Flexibility;
  canUpdate?: boolean;
  canWithdraw?: boolean;
  flightNumber?: string;
  flightDepartureTime?: string;
  departureTerminal?: FlightTerminal;
  interestedSeatCount?: number;
  requiredSeats?: number;
  remainingSeatsNeeded?: number;
  enoughInterest?: boolean;
  interestDeadlineAt?: string;
  customerStage?: CustomerShareStage;
  customerStageLabel?: string;
  placesLabel?: string;
  neededLabel?: string;
  paymentNotOpened?: boolean;
};

export type CustomerBookingView = {
  publicNumber: string;
  travelDate: string;
  departureTime: string;
  recommendedArrivalTime: string;
  graceUntilTime: string;
  meetingPointName: string;
  destinationLabel: string;
  dropoffTerminal?: HeathrowTerminal;
  passengers: number;
  farePence: number;
  amountDuePence: number;
  paidAmountPence: number;
  reservationStatus: ReservationStatus;
  hostedPaymentStatus: HostedPaymentStatus;
  publicStatus: PublicJourneyStatus;
  journeyStatus: JourneyStatus;
  guarantee: PublicGuarantee;
  occupiedSeats: number;
  remainingSeats: number;
  capacity: number;
  paidPassengerPlaces: number;
  requiredPaidPlaces: number;
  paymentDeadlineAt?: string;
  paymentLinkAvailable: boolean;
  fourPassengerOffer?: {
    available: boolean;
    currentPaidPence: number;
    additionalPence: number;
    totalPence: number;
    accepted?: boolean;
  };
  cancellationDeadlineAt?: string;
  warning?: string;
  paymentSubmittedNotice?: string;
  customerStatusLabel: string;
  originLabel: string;
  fillNotice?: string;
  confirmedNotice?: string;
  journeyType: JourneyType;
  destinationMatchingEnabled: boolean;
  destinationCity?: string;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  proposedSharedDropoffDisplayName?: string;
  sharedDropoffStatus?: SharedDropoffCustomerStatus;
  canAcceptSharedDropoff?: boolean;
  canDeclineSharedDropoff?: boolean;
  sharedDropoffNotice?: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  departureTerminal?: FlightTerminal;
  sharedDropoffLabel?: string;
  terminalTransferRequired?: boolean;
  terminalGuideUrl?: string;
  terminalGuideLabel?: string;
  terminalTransferWarning?: string;
  actionRequired?: string;
  fourPassengerFallbackEnabled?: boolean;
  customerStage?: CustomerShareStage;
  customerStageLabel?: string;
  paymentsReceived?: number;
  paymentsRequired?: number;
  remainingPaymentsNeeded?: number;
  ownPaymentReceived?: boolean;
  ownPaymentVerified?: boolean;
  confirmationGuardNotice?: string;
  travelPlansNotice?: string;
  boardingCode?: string;
  boardingNotice?: string;
  passengerName?: string;
};

export const UNCONFIRMED_WARNING =
  "Your place is currently provisional. We will contact you when enough passengers have registered and payment opens.";

export const INTEREST_NOTICE =
  "Registering interest does not confirm your journey and no payment is taken at this stage.";

export const FLIGHT_DISCLAIMER =
  "Flight times are used only as a safety check. Spires Share does not promise that you will catch your flight.";

export const STRICT_DEPARTURE_NOTICE =
  "Please arrive at least 15 minutes before departure. The vehicle leaves at the stated departure time. A short grace period of up to five minutes may be possible at the driver's discretion, but this is not guaranteed. Passengers should not rely on this.";

export const FILL_NOTICE =
  "We aim to confirm the journey with five passengers. If five passengers are not secured, Spires Taxis may offer the four passenger departure option. If the required passenger numbers are not reached, the shared journey will not operate and affected passengers will be contacted regarding their payment.";

export const CONFIRMED_NOTICE = "Your airport transfer is now confirmed.";

export const SHARED_JOURNEY_CONFIRMED_NOTICE = "Your shared journey is now confirmed.";

export const INTENDED_DESTINATION_HELP =
  "Tell us where you're ultimately travelling to. We use this information to help choose a practical shared drop off point for passengers travelling together. Your intended destination is used for matching and does not mean the vehicle will take you directly to that address.";

export const SHARED_DROPOFF_ACK_HELP =
  "We use this to help choose the most practical shared drop off point for everyone travelling. Your final destination is not necessarily where the shared vehicle will drop you.";

export const WAITING_FOR_MATCHING_LABEL = "Waiting for passenger matching";

export const REVIEW_PROPOSED_DROPOFF_LABEL = "Please review the proposed drop off";

export const DROPOFF_ACCEPTED_WAITING_PAYMENT_LABEL = "Drop off accepted — waiting for payment to open";

export const DROPOFF_DECLINED_LABEL = "Proposed drop off declined";

export const ROUTING_PROVIDER_NEEDED =
  "Accurate road distance and travel time scoring needs a routing provider such as Google Maps Directions or Mapbox Directions. Straight line distance is only used when coordinates already exist.";

export const GEOCODING_PROVIDER_NEEDED =
  "Turning addresses and postcodes into coordinates needs a geocoding provider such as Google Maps Geocoding or Mapbox Geocoding. No paid mapping API is enabled.";

export const PAID_AWAITING_CONFIRMATION = "Payment received — awaiting journey confirmation";

export const PROVISIONAL_PLACE_LABEL = "Provisional place";

export const PREVIOUS_SHARE_TERMS_VERSION = "share-heathrow-mvp-2026-09-28";

export const SHARE_TERMS_VERSION = "spires-share-pilot-2026-10";

export function isCurrentShareTermsVersion(version?: string): boolean {
  return version === SHARE_TERMS_VERSION;
}
