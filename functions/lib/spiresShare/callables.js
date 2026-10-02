"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledSpiresShareTick = exports.spiresShareRunTick = exports.spiresSharePublicList = exports.spiresSharePublicAccess = exports.spiresShareAdminAction = exports.spiresShareAcceptWaitlist = exports.spiresSharePreviewInterest = exports.spiresShareExpressInterest = exports.spiresShareCustomerAction = exports.spiresShareGetPaymentLink = exports.spiresShareGetMyBookings = exports.spiresShareGetMyBooking = exports.spiresShareProposeOrJoin = exports.spiresShareListDepartures = exports.spiresShareSearch = exports.spiresShareSaveConfig = exports.spiresShareGetState = exports.spiresShareSession = void 0;
exports.runShareDeadlineTick = runShareDeadlineTick;
const crypto = __importStar(require("crypto"));
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const defaults_1 = require("./defaults");
const logic_1 = require("./logic");
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const notifications_1 = require("./notifications");
const timezone_1 = require("./timezone");
const types_1 = require("./types");
const driverReminderEmail_1 = require("../driverReminderEmail");
const hostedPayment_1 = require("./hostedPayment");
const paymentDeadline_1 = require("./paymentDeadline");
const destinationMatching_1 = require("./destinationMatching");
const access_1 = require("./access");
const interestGroups_1 = require("./interestGroups");
const routePricing_1 = require("./routePricing");
const terminalGuide_1 = require("./terminalGuide");
function db() {
    return admin.firestore();
}
function publicBlocked() {
    throw new functions.https.HttpsError("not-found", "Spires Share is not available.");
}
function emailOf(context) {
    return (context.auth?.token.email || "").toString().trim().toLowerCase();
}
function isAdminEmail(email) {
    return (0, access_1.isAdminEmail)(email);
}
function currentFlags(config) {
    return {
        enabled: defaults_1.SPIRES_SHARE_PUBLIC_ENABLED,
        pilot: defaults_1.SPIRES_SHARE_PILOT_ENABLED,
        publicEnabled: config.publicEnabled,
    };
}
async function loadConfig() {
    const snap = await db().doc(defaults_1.COLLECTIONS.CONFIG).get();
    if (!snap.exists) {
        return {
            ...defaults_1.DEFAULT_SHARE_CONFIG,
            airports: [...defaults_1.DEFAULT_SHARE_CONFIG.airports],
            previewTesterEmails: [],
            pilotDefaults: { ...defaults_1.DEFAULT_SHARE_CONFIG.pilotDefaults },
        };
    }
    const data = snap.data();
    return {
        ...defaults_1.DEFAULT_SHARE_CONFIG,
        ...data,
        airports: data.airports || [...defaults_1.DEFAULT_SHARE_CONFIG.airports],
        mvpAirportIds: data.mvpAirportIds || defaults_1.DEFAULT_SHARE_CONFIG.mvpAirportIds,
        previewTesterEmails: (data.previewTesterEmails || []).map((row) => row.toLowerCase()),
        publicEnabled: false,
        requiresRegulatoryApproval: true,
        homeCollectionCustomerEnabled: false,
        notificationsSend: data.notificationsSend === true,
        cityMatchingPublicEnabled: data.cityMatchingPublicEnabled === true,
        pilotDefaults: { ...defaults_1.DEFAULT_SHARE_CONFIG.pilotDefaults, ...(data.pilotDefaults || {}) },
    };
}
async function assertShareAccess(context, config, mode) {
    const email = emailOf(context);
    if (mode === "admin") {
        if (!context.auth || !isAdminEmail(email)) {
            throw new functions.https.HttpsError("permission-denied", "Admin access required.");
        }
        return { role: "admin", email, uid: context.auth.uid };
    }
    if (context.auth && isAdminEmail(email))
        return { role: "admin", email, uid: context.auth.uid };
    if (context.auth && (0, access_1.isPreviewTester)(email, config)) {
        return { role: "preview", email, uid: context.auth.uid };
    }
    const flags = currentFlags(config);
    const allowed = (0, access_1.customerShareAccessAllowed)({
        flags,
        authenticated: Boolean(context.auth?.uid),
        isAdmin: false,
        isPreviewTester: false,
    });
    if (mode === "session") {
        return { role: allowed ? "customer" : "none", email, uid: context.auth?.uid };
    }
    if (allowed && context.auth)
        return { role: "customer", email, uid: context.auth.uid };
    publicBlocked();
}
async function writeAudit(type, actorEmail, refs) {
    await db().collection(defaults_1.COLLECTIONS.AUDIT).add({
        type,
        actorEmail,
        refs,
        at: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function queueNotification(config, type, to, journey, extra) {
    if (!to)
        return;
    const draft = (0, notifications_1.buildNotification)(type, to, journey, extra);
    const send = (0, notifications_1.shareNotificationsEnabled)(config);
    const doc = {
        type: draft.type,
        to: draft.to,
        subject: draft.subject,
        text: draft.text,
        journeyId: draft.journeyId || "",
        bookingId: extra?.bookingId || "",
        dryRun: !send,
        status: send ? "PENDING" : "DRY_RUN",
        at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db().collection(defaults_1.COLLECTIONS.NOTIFICATIONS).add(doc);
    if (!send)
        return;
    try {
        await (0, driverReminderEmail_1.getTransporter)().sendMail({
            from: (0, driverReminderEmail_1.mailFrom)(),
            to,
            bcc: driverReminderEmail_1.ADMIN_EMAIL,
            subject: draft.subject,
            text: draft.text,
            html: draft.html || `<p style="font-family:Arial,sans-serif;color:#002147;white-space:pre-wrap">${(0, driverReminderEmail_1.escapeHtml)(draft.text)}</p>`,
        });
        await db().collection(defaults_1.COLLECTIONS.NOTIFICATIONS).add({ ...doc, status: "SENT" });
    }
    catch (err) {
        functions.logger.warn("Share notification send failed", err);
    }
}
function asJourney(id, data) {
    return { id, ...data };
}
async function loadBookingsForJourney(tx, journeyId) {
    const query = db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", journeyId);
    const snap = tx ? await tx.get(query) : await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
function shareFail(err, fallback = "Spires Share request failed.") {
    if (err instanceof functions.https.HttpsError)
        throw err;
    throw new functions.https.HttpsError("failed-precondition", err?.message || fallback);
}
function asInterestGroup(id, data) {
    return { id, ...data };
}
function asWaitlist(id, data) {
    return { id, ...data };
}
function journeyStubFromInterest(group) {
    return {
        id: group.convertedJourneyId || group.id,
        publicNumber: group.publicNumber,
        airportId: group.destinationRegion === "Heathrow" ? "heathrow" : (0, destinationMatching_1.cityRouteKey)(group.origin, group.destinationRegion),
        travelDate: group.travelDate,
        departureTime: group.proposedDepartureTime || group.preferredDepartureTime || group.timeWindowStart,
        departureAt: "",
        confirmationDeadlineAt: "",
        status: "PROPOSED",
        capacity: 5,
        occupiedSeats: 0,
        farePence: group.proposedFarePence || 0,
        targetRevenuePence: 0,
        originLabel: group.origin,
        departureLocation: group.proposedDepartureLocation || "",
        destinationLabel: group.destinationRegion,
        vehicleLabel: "",
        minPassengerThreshold: group.minPassengerThreshold,
        customerVisible: false,
        dropoffMode: group.destinationMatchingEnabled ? "common_dropoff" : "per_passenger_terminal",
        journeyType: group.journeyType,
        destinationMatchingEnabled: group.destinationMatchingEnabled,
        earlyDepartureOffered: false,
        earlyDepartureAcceptedBookingIds: [],
        homeCollectionCount: 0,
        waitlistCount: 0,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
    };
}
function customerInterestView(entry, group) {
    return {
        interestEntryId: entry.id,
        publicNumber: group.publicNumber,
        origin: group.origin,
        destinationRegion: group.destinationRegion,
        travelDate: group.travelDate,
        timeLabel: (0, interestGroups_1.timeLabelForWindow)(group.timeWindowStart, group.timeWindowEnd),
        passengers: entry.passengers,
        status: entry.status,
        groupStatus: group.status,
        proposedDepartureLocation: group.proposedDepartureLocation,
        proposedDepartureTime: group.proposedDepartureTime,
        proposedFarePence: group.proposedFarePence,
        canAcceptProposal: entry.status === "ACTIVE" && group.status === "CONVERTED_TO_JOURNEY",
        canDeclineProposal: entry.status === "ACTIVE" && group.status === "CONVERTED_TO_JOURNEY",
        intendedDestinationText: entry.intendedDestinationText,
        journeyType: group.journeyType,
        preferredDepartureTime: entry.preferredDepartureTime,
        flexibility: entry.flexibility,
        canUpdate: entry.status === "ACTIVE" && group.status !== "CONVERTED_TO_JOURNEY",
        canWithdraw: entry.status === "ACTIVE" && group.status !== "CONVERTED_TO_JOURNEY",
        flightNumber: entry.flightNumber,
        flightDepartureTime: entry.flightDepartureTime,
        departureTerminal: entry.departureTerminal,
    };
}
function customerWaitlistView(entry, journey, siblings, now) {
    return {
        waitlistId: entry.id,
        publicNumber: journey.publicNumber,
        travelDate: journey.travelDate,
        departureTime: journey.departureTime,
        originLabel: journey.originLabel || journey.originCity || "Oxford",
        destinationLabel: journey.destinationLabel || journey.destinationCity || "",
        passengers: entry.passengers,
        status: entry.status,
        waitlistPosition: (0, interestGroups_1.derivedWaitlistPosition)(siblings, entry.id),
        offerExpiresAt: entry.offerExpiresAt,
        canClaim: entry.status === "OFFERED" && (!entry.offerExpiresAt || !(0, timezone_1.isPast)(entry.offerExpiresAt, now)),
        canDecline: entry.status === "OFFERED",
    };
}
async function recountInterestGroupDoc(groupRef, group) {
    const entries = await db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("interestGroupId", "==", group.id).get();
    const seats = entries.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((row) => row.status === "ACTIVE")
        .reduce((sum, row) => sum + Number(row.passengers || 0), 0);
    const now = new Date().toISOString();
    await groupRef.set({
        interestedSeatCount: seats,
        status: (0, interestGroups_1.interestGroupStatusFromCount)(seats, group.minPassengerThreshold || 4, group.status),
        updatedAt: now,
    }, { merge: true });
}
function attachPassengerWrites(tx, opts) {
    const { journey, journeyRef, existingBookings, config, passengers, now } = opts;
    if (journey.waitlistOfferOutstanding && !opts.claimingWaitlist) {
        throw new functions.https.HttpsError("failed-precondition", "A place is currently offered to someone on the waitlist.");
    }
    if (!(0, logic_1.canAddPassengers)(journey.occupiedSeats, passengers, journey.capacity)) {
        throw new functions.https.HttpsError("failed-precondition", "No remaining places.");
    }
    if (!(0, logic_1.luggageFitsVehicle)(existingBookings.filter((row) => (0, hostedPayment_1.reservationHoldsSeat)(row)).map((row) => row.luggage), opts.luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
        throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the vehicle allowance.");
    }
    const keepConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
    const stage = (0, bookingFlow_1.reservationStageForIncomingPassenger)(journey, config, now);
    const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc();
    const paymentId = `pay_${crypto.randomBytes(12).toString("hex")}`;
    const manageToken = (0, logic_1.newOpaqueToken)();
    const occupied = journey.occupiedSeats + passengers;
    const status = keepConfirmed
        ? "CONFIRMED"
        : (0, hostedPayment_1.journeyStatusFromOccupancy)(occupied, journey.capacity, journey.status === "PROPOSED" ? "GATHERING_INTEREST" : journey.status, journey.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(journey, [
            ...existingBookings,
            {
                id: bookingRef.id,
                journeyId: journey.id,
                passengers,
                reservationStatus: stage.reservationStatus,
                sharedDropoffAcceptedAt: undefined,
            },
        ]));
    const bookingPatch = {
        journeyId: journey.id,
        publicNumber: journey.publicNumber,
        passengers,
        name: opts.name,
        email: opts.email,
        mobile: opts.mobile || "",
        uid: opts.uid || "",
        flexibility: opts.flexibility || "plus_minus_30",
        luggage: opts.luggage,
        dropoffTerminal: opts.dropoffTerminal || journey.destinationTerminal || "",
        departureTerminal: (0, terminalGuide_1.parseFlightTerminal)(opts.departureTerminal || opts.dropoffTerminal || journey.destinationTerminal) || "",
        flightNumber: opts.flightNumber || "",
        flightDepartureTime: opts.flightDepartureTime || "",
        homeCollection: "HOME_COLLECTION_UNAVAILABLE",
        homeCollectionSurchargePence: 0,
        paymentId,
        paymentMethodRef: "hosted_payment_link",
        paymentStatus: (0, hostedPayment_1.paymentStatusFromReservation)(stage.reservationStatus),
        hostedPaymentStatus: stage.reservationStatus === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : "UNPAID",
        reservationStatus: stage.reservationStatus,
        paidAmountPence: 0,
        paymentDeadlineAt: stage.paymentDeadlineAt || "",
        termsAcceptedAt: now,
        termsVersion: types_1.SHARE_TERMS_VERSION,
        boardStatus: "NOT_CHECKED_IN",
        earlyDepartureAccepted: false,
        manageTokenHash: (0, logic_1.hashToken)(manageToken),
        idempotencyKey: opts.idempotencyKey || `join_${bookingRef.id}`,
        createdAt: now,
        waitlistId: opts.waitlistId || "",
        interestEntryId: opts.interestEntryId || "",
        ...(opts.destination ? (0, destinationMatching_1.destinationFieldsForBooking)(opts.destination, now) : {}),
    };
    tx.update(journeyRef, {
        occupiedSeats: occupied,
        status,
        waitlistOfferOutstanding: opts.claimingWaitlist ? false : journey.waitlistOfferOutstanding || false,
        updatedAt: now,
    });
    tx.set(bookingRef, bookingPatch);
    tx.set(db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(paymentId), {
        id: paymentId,
        bookingId: bookingRef.id,
        journeyId: journey.id,
        amountPence: journey.farePence * passengers,
        currency: "GBP",
        status: (0, hostedPayment_1.paymentStatusFromReservation)(stage.reservationStatus),
        paymentMethodRef: "hosted_payment_link",
        provider: "hosted_payment_link",
        updatedAt: now,
    });
    if (opts.idemRef) {
        tx.set(opts.idemRef, {
            bookingId: bookingRef.id,
            journeyId: journey.id,
            publicNumber: journey.publicNumber,
            occupiedSeats: occupied,
        });
    }
    return {
        bookingId: bookingRef.id,
        manageToken,
        occupied,
        reservationStatus: stage.reservationStatus,
        paymentDeadlineAt: stage.paymentDeadlineAt,
        paymentPending: stage.reservationStatus === "PAYMENT_PENDING",
        status,
    };
}
async function expressInterestForCustomer(config, access, data) {
    if (!access.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to register interest in a shared journey.");
    }
    if (data.termsAccepted !== true) {
        throw new functions.https.HttpsError("failed-precondition", "You must read and agree to the Spires Share terms before registering interest.");
    }
    const passengers = Number(data.passengers) || 0;
    try {
        (0, logic_1.assertPartyFitsCapacity)(passengers, config.passengerCapacity);
    }
    catch (err) {
        shareFail(err);
    }
    const name = String(data.name || "");
    const email = String(data.email || access.email || "");
    const mobile = String(data.mobile || "");
    if (!name || !email || !mobile) {
        throw new functions.https.HttpsError("invalid-argument", "Name, mobile and email are required.");
    }
    let origin = String(data.origin || "");
    let destinationRegion = String(data.destinationRegion || data.destination || "");
    let travelDate = String(data.travelDate || "");
    const publicNumber = String(data.publicNumber || data.interestPublicNumber || "");
    if (publicNumber) {
        const found = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).where("publicNumber", "==", publicNumber).limit(1).get();
        if (found.empty)
            throw new functions.https.HttpsError("not-found", "Interest group not found.");
        const group = asInterestGroup(found.docs[0].id, found.docs[0].data() || {});
        if (group.status !== "GATHERING_INTEREST" && group.status !== "READY_FOR_REVIEW") {
            throw new functions.https.HttpsError("failed-precondition", "This interest group is no longer open.");
        }
        origin = group.origin;
        destinationRegion = group.destinationRegion;
        travelDate = group.travelDate;
        if (!data.preferredDepartureTime)
            data.preferredDepartureTime = group.preferredDepartureTime || group.timeWindowStart;
        if (!data.timeWindowStart)
            data.timeWindowStart = group.timeWindowStart;
        if (!data.timeWindowEnd)
            data.timeWindowEnd = group.timeWindowEnd;
    }
    const originPlace = (0, interestGroups_1.normalizePlace)(origin);
    const destinationPlace = (0, interestGroups_1.normalizePlace)(destinationRegion);
    if (!originPlace.label || !destinationPlace.label) {
        throw new functions.https.HttpsError("invalid-argument", "Origin and destination are required.");
    }
    if (!travelDate)
        throw new functions.https.HttpsError("invalid-argument", "Travel date is required.");
    let window;
    try {
        window = (0, interestGroups_1.resolveInterestWindow)({
            origin: originPlace.label,
            destinationRegion: destinationPlace.label,
            travelDate,
            preferredDepartureTime: String(data.preferredDepartureTime || ""),
            flexibility: (data.flexibility || "plus_minus_30"),
            timeWindowStart: data.timeWindowStart ? String(data.timeWindowStart) : undefined,
            timeWindowEnd: data.timeWindowEnd ? String(data.timeWindowEnd) : undefined,
            passengers,
            intendedDestinationText: data.intendedDestinationText ? String(data.intendedDestinationText) : undefined,
            intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : undefined,
            sharedDropoffAcknowledged: data.sharedDropoffAcknowledged === true,
        });
    }
    catch (err) {
        shareFail(err);
    }
    if ((0, interestGroups_1.destinationMatchingForRegion)(destinationPlace.label)) {
        try {
            (0, destinationMatching_1.requireIntendedDestination)({
                intendedDestinationText: String(data.intendedDestinationText || ""),
                intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : undefined,
                sharedDropoffAcknowledged: data.sharedDropoffAcknowledged === true,
            }, destinationPlace.label);
        }
        catch (err) {
            shareFail(err);
        }
    }
    const matchingUncertain = !originPlace.known || !destinationPlace.known;
    const now = new Date().toISOString();
    const ownSnap = await db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("uid", "==", access.uid).limit(50).get();
    for (const doc of ownSnap.docs) {
        const entry = { id: doc.id, ...doc.data() };
        if (entry.status !== "ACTIVE")
            continue;
        const groupSnap = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(entry.interestGroupId).get();
        if (!groupSnap.exists)
            continue;
        const group = asInterestGroup(groupSnap.id, groupSnap.data() || {});
        if ((group.status === "GATHERING_INTEREST" || group.status === "READY_FOR_REVIEW") &&
            group.origin === originPlace.label &&
            group.destinationRegion === destinationPlace.label &&
            group.travelDate === travelDate) {
            return {
                ok: true,
                joinedExisting: true,
                publicNumber: group.publicNumber,
                interestGroupId: group.id,
                interestEntryId: entry.id,
                matchingUncertain: Boolean(group.matchingUncertain),
                public: (0, interestGroups_1.toPublicInterestGroup)(group),
            };
        }
    }
    const openSnap = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).limit(200).get();
    const openGroups = openSnap.docs.map((doc) => asInterestGroup(doc.id, doc.data() || {}));
    const compatible = publicNumber
        ? openGroups.find((row) => row.publicNumber === publicNumber) || null
        : (0, interestGroups_1.findCompatibleInterestGroup)(openGroups, {
            origin: originPlace.label,
            destinationRegion: destinationPlace.label,
            travelDate,
            timeWindowStart: window.start,
            timeWindowEnd: window.end,
        });
    let group = compatible;
    let groupRef;
    let joinedExisting = Boolean(compatible);
    if (!group) {
        groupRef = db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc();
        const created = {
            publicNumber: (0, interestGroups_1.interestPublicNumber)(originPlace.label, destinationPlace.label, travelDate, window.start, window.end),
            origin: originPlace.label,
            destinationRegion: destinationPlace.label,
            journeyType: (0, interestGroups_1.journeyTypeForRegion)(destinationPlace.label),
            destinationMatchingEnabled: (0, interestGroups_1.destinationMatchingForRegion)(destinationPlace.label),
            travelDate,
            preferredDepartureTime: window.preferred,
            timeWindowStart: window.start,
            timeWindowEnd: window.end,
            interestedSeatCount: 0,
            minPassengerThreshold: config.pilotDefaults.minPassengerThreshold,
            status: "GATHERING_INTEREST",
            matchingUncertain,
            createdAt: now,
            updatedAt: now,
        };
        await groupRef.set(created);
        group = { id: groupRef.id, ...created };
        await writeAudit("INTEREST_CREATED", access.email, { interestGroupId: groupRef.id });
    }
    else {
        groupRef = db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(group.id);
    }
    const entryRef = db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).doc();
    const entry = {
        interestGroupId: group.id,
        uid: access.uid,
        passengers,
        name,
        email,
        mobile,
        preferredDepartureTime: window.preferred,
        timeWindowStart: window.start,
        timeWindowEnd: window.end,
        flexibility: window.flexibility,
        intendedDestinationText: data.intendedDestinationText ? String(data.intendedDestinationText) : undefined,
        intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : undefined,
        sharedDropoffAcknowledgedAt: data.sharedDropoffAcknowledged === true ? now : undefined,
        termsAcceptedAt: now,
        termsVersion: types_1.SHARE_TERMS_VERSION,
        flightNumber: data.flightNumber ? String(data.flightNumber) : undefined,
        flightDepartureTime: data.flightDepartureTime ? String(data.flightDepartureTime) : undefined,
        departureTerminal: (0, terminalGuide_1.parseFlightTerminal)(data.departureTerminal || data.dropoffTerminal),
        dropoffTerminal: (0, logic_1.isHeathrowTerminal)(String(data.dropoffTerminal || ""), ["T2", "T3", "T4", "T5"])
            ? String(data.dropoffTerminal)
            : destinationPlace.label === "Heathrow"
                ? "T3"
                : undefined,
        status: "ACTIVE",
        createdAt: now,
    };
    await entryRef.set(entry);
    if (matchingUncertain)
        await groupRef.set({ matchingUncertain: true }, { merge: true });
    await recountInterestGroupDoc(groupRef, group);
    const live = asInterestGroup(group.id, (await groupRef.get()).data() || {});
    await queueNotification(config, "INTEREST_RECEIVED", email, journeyStubFromInterest(live));
    if (live.status === "READY_FOR_REVIEW") {
        await queueNotification(config, "INTEREST_GROUP_READY", email, journeyStubFromInterest(live));
    }
    await writeAudit(joinedExisting ? "INTEREST_JOINED" : "INTEREST_CREATED", access.email, {
        interestGroupId: group.id,
        entryId: entryRef.id,
    });
    return {
        ok: true,
        joinedExisting,
        publicNumber: live.publicNumber,
        interestGroupId: live.id,
        interestEntryId: entryRef.id,
        matchingUncertain: Boolean(live.matchingUncertain),
        public: (0, interestGroups_1.toPublicInterestGroup)(live),
    };
}
async function joinWaitlistForCustomer(config, access, data) {
    if (!config.waitlistEnabled) {
        throw new functions.https.HttpsError("failed-precondition", "The waitlist is not available.");
    }
    if (!access.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to join the waitlist.");
    }
    if (data.termsAccepted !== true) {
        throw new functions.https.HttpsError("failed-precondition", "You must read and agree to the Spires Share terms before joining the waitlist.");
    }
    const journeyId = String(data.journeyId || "");
    if (!journeyId)
        throw new functions.https.HttpsError("invalid-argument", "Journey is required.");
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journeyId).get();
    if (!journeySnap.exists)
        throw new functions.https.HttpsError("not-found", "Journey not found.");
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    const remaining = (0, logic_1.remainingSeats)(journey.occupiedSeats, journey.capacity);
    if (remaining > 0 && !journey.waitlistOfferOutstanding) {
        throw new functions.https.HttpsError("failed-precondition", "Places are still available.");
    }
    const passengers = Number(data.passengers) || 1;
    try {
        (0, logic_1.assertPartyFitsCapacity)(passengers, config.passengerCapacity);
    }
    catch (err) {
        shareFail(err);
    }
    const name = String(data.name || "");
    const email = String(data.email || access.email || "");
    const mobile = String(data.mobile || "");
    if (!name || !email || !mobile) {
        throw new functions.https.HttpsError("invalid-argument", "Name, mobile and email are required.");
    }
    if ((0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
        try {
            (0, destinationMatching_1.requireIntendedDestination)({
                intendedDestinationText: String(data.intendedDestinationText || ""),
                intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : undefined,
                sharedDropoffAcknowledged: data.sharedDropoffAcknowledged === true,
            }, journey.destinationCity || "London");
        }
        catch (err) {
            shareFail(err);
        }
    }
    const now = new Date().toISOString();
    const waitRef = db().collection(defaults_1.COLLECTIONS.WAITLIST).doc();
    await waitRef.set({
        journeyId,
        status: "WAITING",
        passengers,
        name,
        email,
        mobile,
        uid: access.uid,
        joinedWaitlistAt: now,
        createdAt: now,
        intendedDestinationText: data.intendedDestinationText ? String(data.intendedDestinationText) : "",
        intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : "",
        sharedDropoffAcknowledgedAt: data.sharedDropoffAcknowledged === true ? now : "",
        termsAcceptedAt: now,
        dropoffTerminal: data.dropoffTerminal ? String(data.dropoffTerminal) : journey.destinationTerminal || "",
        luggage: (0, bookingFlow_1.parseLuggage)(data, passengers),
        flexibility: data.flexibility || "plus_minus_30",
    });
    await journeySnap.ref.set({ waitlistCount: (journey.waitlistCount || 0) + 1, updatedAt: now }, { merge: true });
    return { ok: true, waitlistId: waitRef.id, status: "WAITING" };
}
async function claimWaitlistForCustomer(config, access, data) {
    if (!access.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to claim a waitlist place.");
    }
    let waitRef = null;
    const waitlistId = String(data.waitlistId || "");
    const offerToken = String(data.offerToken || "");
    if (waitlistId) {
        waitRef = db().collection(defaults_1.COLLECTIONS.WAITLIST).doc(waitlistId);
    }
    else if (offerToken) {
        const found = await db().collection(defaults_1.COLLECTIONS.WAITLIST).where("offerTokenHash", "==", (0, logic_1.hashToken)(offerToken)).limit(1).get();
        if (found.empty)
            throw new functions.https.HttpsError("not-found", "Waitlist offer not found.");
        waitRef = found.docs[0].ref;
    }
    if (!waitRef)
        throw new functions.https.HttpsError("invalid-argument", "Waitlist offer not found.");
    const result = await db().runTransaction(async (tx) => {
        const waitSnap = await tx.get(waitRef);
        if (!waitSnap.exists)
            throw new functions.https.HttpsError("not-found", "Waitlist offer not found.");
        const entry = asWaitlist(waitSnap.id, waitSnap.data() || {});
        if (entry.uid && entry.uid !== access.uid && access.role !== "admin") {
            throw new functions.https.HttpsError("not-found", "Waitlist offer not found.");
        }
        const now = new Date().toISOString();
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(entry.journeyId);
        const journeySnap = await tx.get(journeyRef);
        if (!journeySnap.exists)
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        if (entry.status !== "OFFERED") {
            throw new functions.https.HttpsError("failed-precondition", "This offer is no longer valid.");
        }
        if (entry.offerExpiresAt && (0, timezone_1.isPast)(entry.offerExpiresAt, now)) {
            tx.set(waitSnap.ref, { status: "EXPIRED" }, { merge: true });
            tx.update(journeyRef, { waitlistOfferOutstanding: false, updatedAt: now });
            return { expired: true, journeyId: journey.id };
        }
        if (!entry.termsAcceptedAt) {
            throw new functions.https.HttpsError("failed-precondition", "You must read and agree to the Spires Share terms before claiming a place.");
        }
        let destination = null;
        if ((0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
            destination = (0, destinationMatching_1.requireIntendedDestination)({
                intendedDestinationText: entry.intendedDestinationText || "",
                intendedDestinationPostcode: entry.intendedDestinationPostcode,
                sharedDropoffAcknowledged: Boolean(entry.sharedDropoffAcknowledgedAt),
            }, journey.destinationCity || "London");
        }
        const existingBookings = await loadBookingsForJourney(tx, journey.id);
        const attached = attachPassengerWrites(tx, {
            journey,
            journeyRef,
            existingBookings,
            config,
            passengers: entry.passengers,
            name: entry.name,
            email: entry.email,
            mobile: entry.mobile,
            uid: entry.uid || access.uid,
            luggage: entry.luggage || (0, bookingFlow_1.parseLuggage)({}, entry.passengers),
            dropoffTerminal: entry.dropoffTerminal,
            flexibility: entry.flexibility,
            destination,
            waitlistId: entry.id,
            claimingWaitlist: true,
            now,
        });
        tx.set(waitSnap.ref, { status: "ACCEPTED", claimedAt: now }, { merge: true });
        return { expired: false, journeyId: journey.id, email: entry.email, ...attached };
    });
    if (result.expired) {
        await offerNextWaitlist(config, result.journeyId);
        throw new functions.https.HttpsError("deadline-exceeded", "This waitlist offer has expired.");
    }
    await writeAudit("WAITLIST_CLAIMED", access.email, { journeyId: result.journeyId, waitlistId: waitRef.id, bookingId: String(result.bookingId || "") });
    await writeAudit("WAITLIST_PROMOTED", access.email, { journeyId: result.journeyId, waitlistId: waitRef.id, bookingId: String(result.bookingId || "") });
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(result.journeyId).get();
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    if (result.email) {
        await queueNotification(config, "BOOKING_RECEIVED", result.email, journey, { bookingId: String(result.bookingId || "") });
        if (result.paymentPending) {
            await queueNotification(config, "PAYMENT_REQUIRED", result.email, journey, {
                bookingId: String(result.bookingId || ""),
                amountPence: journey.farePence * Number((await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(String(result.bookingId)).get()).data()?.passengers || 1),
                paymentDeadlineAt: result.paymentDeadlineAt,
                paymentUrl: journey.paymentLinkUrl,
            });
        }
    }
    return { ok: true, ...result, message: "Place claimed. Complete any remaining acceptance and payment steps from your dashboard. You have not been charged automatically." };
}
async function declineWaitlistForCustomer(config, access, waitlistId) {
    if (!access.uid)
        throw new functions.https.HttpsError("unauthenticated", "Sign in to decline a waitlist offer.");
    const waitRef = db().collection(defaults_1.COLLECTIONS.WAITLIST).doc(waitlistId);
    const journeyId = await db().runTransaction(async (tx) => {
        const waitSnap = await tx.get(waitRef);
        if (!waitSnap.exists)
            throw new functions.https.HttpsError("not-found", "Waitlist offer not found.");
        const entry = asWaitlist(waitSnap.id, waitSnap.data() || {});
        if (entry.uid && entry.uid !== access.uid && access.role !== "admin") {
            throw new functions.https.HttpsError("not-found", "Waitlist offer not found.");
        }
        if (entry.status !== "OFFERED") {
            throw new functions.https.HttpsError("failed-precondition", "This offer is no longer valid.");
        }
        const now = new Date().toISOString();
        tx.set(waitRef, { status: "DECLINED", declinedAt: now }, { merge: true });
        tx.set(db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(entry.journeyId), { waitlistOfferOutstanding: false, updatedAt: now }, { merge: true });
        return entry.journeyId;
    });
    await writeAudit("WAITLIST_DECLINED", access.email, { journeyId, waitlistId });
    await offerNextWaitlist(config, journeyId);
    return { ok: true, status: "DECLINED" };
}
async function joinDestinationMatchingJourney(opts) {
    const { config, access, actor, data, journeyId } = opts;
    const passengers = Number(data.passengers) || 0;
    try {
        (0, logic_1.assertPartyFitsCapacity)(passengers, config.passengerCapacity);
    }
    catch (err) {
        throw new functions.https.HttpsError("invalid-argument", err.message);
    }
    const luggage = (0, bookingFlow_1.parseLuggage)(data, passengers);
    if (!(0, logic_1.luggageFitsPassengerAllowance)(luggage, passengers, config.luggage.largeSuitcasesPerPassenger, config.luggage.cabinBagsPerPassenger) ||
        !(0, logic_1.luggageFitsVehicle)([], luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
        throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the allowance.");
    }
    const idempotencyKey = String(data.idempotencyKey || "").trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
        throw new functions.https.HttpsError("invalid-argument", "idempotencyKey is required.");
    }
    if (!access.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to register or manage a Spires Share reservation.");
    }
    if (data.termsAccepted !== true) {
        throw new functions.https.HttpsError("failed-precondition", "You must read and agree to the Spires Share terms before registering interest.");
    }
    const contact = {
        name: String(data.name || ""),
        mobile: String(data.mobile || ""),
        email: String(data.email || access.email || ""),
        uid: access.uid,
        flexibility: (data.flexibility || "exact"),
    };
    if (!contact.name || !contact.mobile || !contact.email) {
        throw new functions.https.HttpsError("invalid-argument", "Name, mobile and email are required.");
    }
    const idemRef = db().collection(defaults_1.COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey);
    const result = await db().runTransaction(async (tx) => {
        const replaySnap = await tx.get(idemRef);
        if (replaySnap.exists)
            return { replay: true, ...replaySnap.data() };
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journeyId);
        const journeySnap = await tx.get(journeyRef);
        if (!journeySnap.exists)
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        if (!(0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "This journey does not use destination matching.");
        }
        if ((0, destinationMatching_1.cityMatchingPublicBlocked)(journey, config.cityMatchingPublicEnabled) && access.role === "customer") {
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        }
        if (access.role !== "admin" && access.role !== "preview" && !(0, access_1.isCustomerListableJourney)(journey, access.role, config.cityMatchingPublicEnabled)) {
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        }
        if (journey.waitlistOfferOutstanding) {
            throw new functions.https.HttpsError("failed-precondition", "A place is currently offered to someone on the waitlist.");
        }
        if (!(0, logic_1.canAddPassengers)(journey.occupiedSeats, passengers, journey.capacity)) {
            throw new functions.https.HttpsError("failed-precondition", "No remaining places.");
        }
        let destination;
        try {
            destination = (0, destinationMatching_1.requireIntendedDestination)({
                intendedDestinationText: String(data.intendedDestinationText || ""),
                intendedDestinationPostcode: data.intendedDestinationPostcode ? String(data.intendedDestinationPostcode) : undefined,
                intendedDestinationLat: data.intendedDestinationLat,
                intendedDestinationLng: data.intendedDestinationLng,
                sharedDropoffAcknowledged: data.sharedDropoffAcknowledged === true,
                preferredDepartureTime: data.preferredDepartureTime ? String(data.preferredDepartureTime) : undefined,
                flexibleMinutes: data.flexibleMinutes,
                earliestDepartureTime: data.earliestDepartureTime ? String(data.earliestDepartureTime) : undefined,
                latestDepartureTime: data.latestDepartureTime ? String(data.latestDepartureTime) : undefined,
            }, journey.destinationCity || "London");
        }
        catch (err) {
            throw new functions.https.HttpsError("invalid-argument", err.message);
        }
        const existingBookings = await loadBookingsForJourney(tx, journey.id);
        if (!(0, logic_1.luggageFitsVehicle)(existingBookings.filter((row) => (0, hostedPayment_1.reservationHoldsSeat)(row)).map((row) => row.luggage), luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
            throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the vehicle allowance.");
        }
        const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc();
        const paymentId = `pay_${crypto.randomBytes(12).toString("hex")}`;
        const manageToken = (0, logic_1.newOpaqueToken)();
        const occupied = journey.occupiedSeats + passengers;
        const now = new Date().toISOString();
        const keepConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
        const reservationStatus = "PROVISIONAL";
        const bookingPatch = {
            journeyId: journey.id,
            publicNumber: journey.publicNumber,
            passengers,
            ...contact,
            uid: contact.uid || "",
            luggage,
            homeCollection: "HOME_COLLECTION_UNAVAILABLE",
            homeCollectionSurchargePence: 0,
            paymentId,
            paymentMethodRef: "hosted_payment_link",
            paymentStatus: (0, hostedPayment_1.paymentStatusFromReservation)(reservationStatus),
            hostedPaymentStatus: "UNPAID",
            reservationStatus,
            paidAmountPence: 0,
            paymentDeadlineAt: "",
            termsAcceptedAt: now,
            termsVersion: types_1.SHARE_TERMS_VERSION,
            boardStatus: "NOT_CHECKED_IN",
            earlyDepartureAccepted: false,
            manageTokenHash: (0, logic_1.hashToken)(manageToken),
            idempotencyKey,
            createdAt: now,
            ...(0, destinationMatching_1.destinationFieldsForBooking)(destination, now),
        };
        const bookingForStatus = { id: bookingRef.id, ...bookingPatch };
        const status = keepConfirmed
            ? "CONFIRMED"
            : (0, hostedPayment_1.journeyStatusFromOccupancy)(occupied, journey.capacity, journey.status === "PROPOSED" ? "GATHERING_INTEREST" : journey.status, journey.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(journey, [...existingBookings, bookingForStatus]));
        tx.update(journeyRef, { occupiedSeats: occupied, status, updatedAt: now });
        tx.set(bookingRef, bookingPatch);
        tx.set(db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(paymentId), {
            id: paymentId,
            bookingId: bookingRef.id,
            journeyId: journey.id,
            amountPence: journey.farePence * passengers,
            currency: "GBP",
            status: (0, hostedPayment_1.paymentStatusFromReservation)(reservationStatus),
            paymentMethodRef: "hosted_payment_link",
            provider: "hosted_payment_link",
            updatedAt: now,
        });
        tx.set(idemRef, { bookingId: bookingRef.id, journeyId: journey.id, publicNumber: journey.publicNumber, occupiedSeats: occupied });
        return { ok: true, journeyId: journey.id, bookingId: bookingRef.id, occupiedSeats: occupied, status, publicNumber: journey.publicNumber, manageToken };
    });
    if (result.replay)
        return { ok: true, idempotentReplay: true, ...result };
    await writeAudit("PASSENGER_JOINED", actor, {
        journeyId: String(result.journeyId),
        bookingId: String(result.bookingId),
    });
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(String(result.journeyId)).get();
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    await queueNotification(config, "BOOKING_RECEIVED", contact.email, journey, { bookingId: String(result.bookingId) });
    return result;
}
exports.spiresShareSession = functions.https.onCall(async (_data, context) => {
    const config = await loadConfig();
    const flags = currentFlags(config);
    const email = emailOf(context);
    const available = (0, access_1.customerShareAccessAllowed)({
        flags,
        authenticated: Boolean(context.auth?.uid),
        isAdmin: Boolean(context.auth && isAdminEmail(email)),
        isPreviewTester: Boolean(context.auth && (0, access_1.isPreviewTester)(email, config)),
    });
    const heathrow = (0, logic_1.airportById)(config, "heathrow");
    const defaults = config.pilotDefaults;
    return {
        available,
        publicEnabled: false,
        pilot: (0, access_1.sharePilotActive)(flags),
        envFlag: defaults_1.SPIRES_SHARE_PUBLIC_ENABLED,
        envPilotFlag: defaults_1.SPIRES_SHARE_PILOT_ENABLED,
        mvpAirportId: "heathrow",
        meetingPointName: defaults.departureLocation || config.meetingPoint.publicName,
        originLabel: defaults.originLabel,
        destinationLabel: defaults.destinationLabel,
        vehicleLabel: defaults.vehicleLabel,
        farePence: defaults.farePence || heathrow?.farePence || 3500,
        targetRevenuePence: defaults.targetRevenuePence || heathrow?.targetRevenuePence || 17500,
        passengerCapacity: defaults.capacity || config.passengerCapacity,
        earlyDepartureThreshold: config.earlyDepartureThreshold,
        heathrowTerminals: config.heathrowTerminals,
        dropoffMode: config.dropoffMode,
        homeCollectionEnabled: false,
        gatwickEnabled: false,
        returnsEnabled: false,
        payments: "hosted_payment_link",
        shareTermsVersion: types_1.SHARE_TERMS_VERSION,
        shareTermsUrl: "https://www.spires-taxis.com/share-terms",
        interestNotice: types_1.INTEREST_NOTICE,
        fillNotice: types_1.FILL_NOTICE,
        warning: (0, access_1.sharePilotActive)(flags)
            ? "Spires Share is a pre booked shared private hire service. Registering interest does not confirm a journey and no payment is taken at that stage."
            : "Spires Share is not currently available.",
    };
});
exports.spiresShareGetState = functions.https.onCall(async (_data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "admin");
    const [journeysSnap, bookingsSnap, waitSnap, auditSnap, noteSnap, hubsSnap, interestSnap, interestEntrySnap] = await Promise.all([
        db().collection(defaults_1.COLLECTIONS.JOURNEYS).orderBy("travelDate", "asc").limit(200).get(),
        db().collection(defaults_1.COLLECTIONS.BOOKINGS).limit(500).get(),
        db().collection(defaults_1.COLLECTIONS.WAITLIST).limit(200).get(),
        db().collection(defaults_1.COLLECTIONS.AUDIT).orderBy("at", "desc").limit(100).get(),
        db().collection(defaults_1.COLLECTIONS.NOTIFICATIONS).orderBy("at", "desc").limit(50).get(),
        db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).limit(200).get(),
        db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).limit(200).get(),
        db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).limit(500).get(),
    ]);
    const journeys = journeysSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
    const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const waitlist = waitSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const interestGroups = interestSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const interestEntries = interestEntrySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return {
        actorEmail: access.email,
        publicEnabled: false,
        pilot: (0, access_1.sharePilotActive)(currentFlags(config)),
        envFlag: defaults_1.SPIRES_SHARE_PUBLIC_ENABLED,
        envPilotFlag: defaults_1.SPIRES_SHARE_PILOT_ENABLED,
        config,
        journeys,
        publicJourneys: journeys.filter((row) => (0, logic_1.isListableJourney)(row.status)).map((row) => (0, logic_1.toPublicJourney)(row, config)),
        bookings,
        hubs: hubsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        waitlist: (0, interestGroups_1.waitlistOrder)(waitlist).map((row) => ({
            ...row,
            waitlistPosition: (0, interestGroups_1.derivedWaitlistPosition)(waitlist.filter((item) => item.journeyId === row.journeyId), row.id),
            joinedWaitlistAt: (0, interestGroups_1.waitlistJoinedAt)(row),
        })),
        interestGroups: interestGroups.map((group) => ({
            ...group,
            destinationSpread: (0, interestGroups_1.adminInterestDestinations)(interestEntries.filter((row) => row.interestGroupId === group.id)),
            entries: interestEntries
                .filter((row) => row.interestGroupId === group.id)
                .map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                passengers: row.passengers,
                status: row.status,
                timeWindowStart: row.timeWindowStart,
                timeWindowEnd: row.timeWindowEnd,
                intendedDestinationText: row.intendedDestinationText || "",
                flightNumber: row.flightNumber || "",
                flightDepartureTime: row.flightDepartureTime || "",
                departureTerminal: row.departureTerminal || "",
            })),
        })),
        interestEntries,
        publicInterestGroups: interestGroups
            .filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")
            .map(interestGroups_1.toPublicInterestGroup),
        audit: auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        notifications: noteSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
});
exports.spiresShareSaveConfig = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    await assertShareAccess(context, config, "admin");
    const incoming = (data?.config || {});
    const next = {
        ...defaults_1.DEFAULT_SHARE_CONFIG,
        ...incoming,
        publicEnabled: false,
        requiresRegulatoryApproval: true,
        homeCollectionCustomerEnabled: false,
        notificationsSend: incoming.notificationsSend === true,
        cityMatchingPublicEnabled: false,
        mvpAirportIds: incoming.mvpAirportIds?.length ? incoming.mvpAirportIds : defaults_1.DEFAULT_SHARE_CONFIG.mvpAirportIds,
        pilotDefaults: { ...defaults_1.DEFAULT_SHARE_CONFIG.pilotDefaults, ...(incoming.pilotDefaults || {}) },
    };
    if (!next.passengerCapacity || next.passengerCapacity < 1) {
        throw new functions.https.HttpsError("invalid-argument", "passengerCapacity is required.");
    }
    await db().doc(defaults_1.COLLECTIONS.CONFIG).set(next, { merge: true });
    return { ok: true, config: next };
});
function searchRequestFrom(data, config) {
    const airportId = String(data?.airportId || "heathrow");
    const airport = (0, logic_1.airportById)(config, airportId);
    if (!airport)
        throw new functions.https.HttpsError("invalid-argument", "Unknown airport.");
    if (!(0, logic_1.isMvpAirport)(config, airport.id)) {
        throw new functions.https.HttpsError("failed-precondition", "This Spires Share route is not available yet.");
    }
    const passengers = Number(data?.passengers) || 0;
    const luggage = (0, bookingFlow_1.parseLuggage)(data, passengers);
    return {
        airport,
        request: {
            airportId: airport.id,
            travelDate: String(data?.travelDate || ""),
            preferredDepartureTime: String(data?.preferredDepartureTime || ""),
            flexibility: (data?.flexibility || "plus_minus_30"),
            flightDepartureTime: data?.flightDepartureTime ? String(data.flightDepartureTime) : undefined,
            passengers,
            luggage,
        },
    };
}
exports.spiresShareSearch = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    const { airport, request } = searchRequestFrom((data || {}), config);
    const journeysSnap = await db()
        .collection(defaults_1.COLLECTIONS.JOURNEYS)
        .where("airportId", "==", airport.id)
        .where("travelDate", "==", request.travelDate)
        .get();
    const journeys = journeysSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
    const bookingsSnap = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).get();
    const bookingsByJourney = {};
    bookingsSnap.docs.forEach((doc) => {
        const row = { id: doc.id, ...doc.data() };
        bookingsByJourney[row.journeyId] = bookingsByJourney[row.journeyId] || [];
        bookingsByJourney[row.journeyId].push(row);
    });
    const matches = (0, logic_1.matchJourneys)(request, journeys, config, bookingsByJourney).filter((row) => (0, access_1.isCustomerListableJourney)(row, access.role));
    return {
        matches: matches.map((row) => (0, logic_1.toPublicJourney)(row, config)),
        farePence: airport.farePence,
        capacity: config.passengerCapacity,
        meetingPointName: config.meetingPoint.publicName,
        originLabel: config.pilotDefaults.originLabel,
        destinationLabel: config.pilotDefaults.destinationLabel,
        homeCollection: { eligibility: "HOME_COLLECTION_UNAVAILABLE", message: "Home collection is not offered on this MVP." },
        warning: types_1.INTEREST_NOTICE,
        fillNotice: types_1.FILL_NOTICE,
        flightDisclaimer: "Flight times are used only as a safety check. Spires Share does not promise that you will catch your flight.",
    };
});
exports.spiresShareListDepartures = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    const airportId = String(data?.airportId || "");
    const snap = airportId && airportId !== "all"
        ? await db().collection(defaults_1.COLLECTIONS.JOURNEYS).where("airportId", "==", airportId).limit(100).get()
        : await db().collection(defaults_1.COLLECTIONS.JOURNEYS).limit(200).get();
    if (airportId && airportId !== "all" && !airportId.startsWith("city:") && !(0, logic_1.isMvpAirport)(config, airportId)) {
        throw new functions.https.HttpsError("failed-precondition", "This Spires Share route is not available yet.");
    }
    const journeys = snap.docs
        .map((doc) => asJourney(doc.id, doc.data()))
        .filter((row) => (0, access_1.isCustomerListableJourney)(row, access.role))
        .sort((a, b) => `${a.travelDate}T${a.departureTime}`.localeCompare(`${b.travelDate}T${b.departureTime}`));
    const defaults = config.pilotDefaults;
    return {
        farePence: defaults.farePence || (0, logic_1.airportById)(config, "heathrow")?.farePence || 3500,
        capacity: defaults.capacity || config.passengerCapacity,
        meetingPointName: defaults.departureLocation || config.meetingPoint.publicName,
        originLabel: defaults.originLabel,
        destinationLabel: defaults.destinationLabel,
        vehicleLabel: defaults.vehicleLabel,
        interestNotice: types_1.INTEREST_NOTICE,
        fillNotice: types_1.FILL_NOTICE,
        journeys: journeys.map((row) => (0, logic_1.toPublicJourney)(row, config)),
        interestGroups: (await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).limit(200).get()).docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")
            .map(interestGroups_1.toPublicInterestGroup),
    };
});
async function confirmHostedJourney(config, journey, bookings) {
    const five = (0, hostedPayment_1.fivePassengerConfirmReady)(bookings, journey.capacity);
    const four = (0, hostedPayment_1.fourPassengerConfirmReady)(bookings, config.earlyDepartureThreshold);
    if (!five.ok && !four.ok)
        return { ok: false, status: journey.status, failedBookingIds: [] };
    const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journey.id);
    const outcome = await db().runTransaction(async (tx) => {
        const live = await tx.get(journeyRef);
        if (!live.exists)
            return { alreadyConfirmed: true };
        const current = live.data();
        if (current.locked || current.confirmationEmailSentAt || current.status === "CONFIRMED") {
            return { alreadyConfirmed: true };
        }
        const now = new Date().toISOString();
        tx.update(journeyRef, {
            status: "CONFIRMED",
            locked: true,
            confirmedAt: now,
            confirmationEmailSentAt: now,
            updatedAt: now,
        });
        return { alreadyConfirmed: false };
    });
    if (outcome.alreadyConfirmed) {
        return { ok: true, status: "CONFIRMED", alreadyConfirmed: true, failedBookingIds: [] };
    }
    for (const booking of bookings.filter(hostedPayment_1.reservationHoldsSeat)) {
        await queueNotification(config, "JOURNEY_CONFIRMED", booking.email, { ...journey, status: "CONFIRMED" }, { bookingId: booking.id });
    }
    return { ok: true, status: "CONFIRMED", failedBookingIds: [] };
}
exports.spiresShareProposeOrJoin = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    const actor = access.email || "customer";
    const action = String(data?.action || "propose");
    let joinJourneyId = String(data?.journeyId || "");
    const joinPublicNumberEarly = String(data?.publicNumber || "");
    if (!joinJourneyId && joinPublicNumberEarly) {
        const found = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).where("publicNumber", "==", joinPublicNumberEarly).limit(1).get();
        joinJourneyId = found.docs[0]?.id || "";
    }
    if (action === "join" && joinJourneyId) {
        const probe = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(joinJourneyId).get();
        if (probe.exists && (0, destinationMatching_1.destinationMatchingEnabled)(asJourney(probe.id, probe.data() || {}))) {
            return joinDestinationMatchingJourney({
                config,
                access,
                actor,
                data: (data || {}),
                journeyId: joinJourneyId,
            });
        }
    }
    const { airport, request } = searchRequestFrom((data || {}), config);
    const passengers = request.passengers;
    try {
        (0, logic_1.assertPartyFitsCapacity)(passengers, config.passengerCapacity);
    }
    catch (err) {
        throw new functions.https.HttpsError("invalid-argument", err.message);
    }
    const luggage = request.luggage;
    if (!(0, logic_1.luggageFitsPassengerAllowance)(luggage, passengers, config.luggage.largeSuitcasesPerPassenger, config.luggage.cabinBagsPerPassenger) ||
        !(0, logic_1.luggageFitsVehicle)([], luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
        throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the allowance.");
    }
    let terminal;
    try {
        terminal = (0, bookingFlow_1.requireHeathrowTerminal)(config, airport.id, String(data?.dropoffTerminal || ""));
    }
    catch (err) {
        throw new functions.https.HttpsError("invalid-argument", err.message);
    }
    const idempotencyKey = String(data?.idempotencyKey || "").trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
        throw new functions.https.HttpsError("invalid-argument", "idempotencyKey is required.");
    }
    if (!access.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to register or manage a Spires Share reservation.");
    }
    if (data?.termsAccepted !== true) {
        throw new functions.https.HttpsError("failed-precondition", "You must read and agree to the Spires Share terms before registering interest.");
    }
    const contact = {
        name: String(data?.name || ""),
        mobile: String(data?.mobile || ""),
        email: String(data?.email || access.email || ""),
        flightNumber: data?.flightNumber ? String(data.flightNumber) : "",
        flightDepartureTime: request.flightDepartureTime || "",
        flexibility: request.flexibility,
        uid: access.uid,
    };
    if (!contact.name || !contact.mobile || !contact.email) {
        throw new functions.https.HttpsError("invalid-argument", "Name, mobile and email are required.");
    }
    if (action !== "join" && access.role === "customer") {
        throw new functions.https.HttpsError("failed-precondition", "Pilot journeys are created by Spires Taxis. Register interest on an available departure.");
    }
    const idemRef = db().collection(defaults_1.COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey);
    const existingIdem = await idemRef.get();
    if (existingIdem.exists) {
        const replay = existingIdem.data();
        await writeAudit("IDEMPOTENT_REPLAY", actor, { bookingId: replay.bookingId, journeyId: replay.journeyId });
        return { ok: true, idempotentReplay: true, ...replay };
    }
    if (action !== "join") {
        const travelDate = request.travelDate;
        const departureTime = request.preferredDepartureTime;
        if (!travelDate || !departureTime) {
            throw new functions.https.HttpsError("invalid-argument", "Date and departure time are required.");
        }
        if (contact.flightDepartureTime && !(0, logic_1.flightCompatible)(departureTime, airport.estimatedDurationMinutes, contact.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
            throw new functions.https.HttpsError("failed-precondition", "This departure would not meet the configured flight safety buffer.");
        }
        const existingSnap = await db()
            .collection(defaults_1.COLLECTIONS.JOURNEYS)
            .where("airportId", "==", airport.id)
            .where("travelDate", "==", travelDate)
            .get();
        const existingJourneys = existingSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
        const bookingsSnap = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).get();
        const bookingsByJourney = {};
        bookingsSnap.docs.forEach((doc) => {
            const row = { id: doc.id, ...doc.data() };
            bookingsByJourney[row.journeyId] = bookingsByJourney[row.journeyId] || [];
            bookingsByJourney[row.journeyId].push(row);
        });
        const matches = (0, logic_1.matchJourneys)(request, existingJourneys, config, bookingsByJourney);
        if (matches.length && data?.forcePropose !== true) {
            return {
                ok: false,
                needsChoice: true,
                matches: matches.map((row) => (0, logic_1.toPublicJourney)(row, config)),
                message: "There's already a Spires Share departure close to your requested time.",
            };
        }
        const result = await db().runTransaction(async (tx) => {
            const slotRef = db().collection(defaults_1.COLLECTIONS.SLOTS).doc((0, timezone_1.slotKey)(airport.id, travelDate, departureTime));
            const slotSnap = await tx.get(slotRef);
            const replaySnap = await tx.get(idemRef);
            if (replaySnap.exists)
                return { replay: true, ...replaySnap.data() };
            if (slotSnap.exists && data?.forcePropose !== true) {
                const existingId = String(slotSnap.data()?.journeyId || "");
                const existing = existingJourneys.find((row) => row.id === existingId);
                return {
                    needsChoice: true,
                    matches: (existing ? [existing, ...matches.filter((row) => row.id !== existing.id)] : matches).map((row) => (0, logic_1.toPublicJourney)(row, config)),
                };
            }
            const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc();
            const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc();
            const paymentId = `pay_${crypto.randomBytes(12).toString("hex")}`;
            const manageToken = (0, logic_1.newOpaqueToken)();
            const departureAt = (0, timezone_1.londonDateTimeToUtcIso)(travelDate, departureTime);
            const publicNumber = (0, logic_1.publicNumberFor)(travelDate, departureTime);
            const now = new Date().toISOString();
            tx.set(journeyRef, {
                publicNumber,
                airportId: airport.id,
                travelDate,
                departureTime,
                departureAt,
                confirmationDeadlineAt: (0, timezone_1.subtractHoursIso)(departureAt, config.confirmationDeadlineHoursBeforeDeparture),
                status: (0, hostedPayment_1.journeyStatusFromOccupancy)(passengers, config.passengerCapacity, "GATHERING_INTEREST"),
                capacity: config.passengerCapacity,
                occupiedSeats: passengers,
                farePence: airport.farePence,
                targetRevenuePence: airport.targetRevenuePence,
                originLabel: config.pilotDefaults.originLabel,
                departureLocation: config.pilotDefaults.departureLocation,
                destinationLabel: config.pilotDefaults.destinationLabel,
                destinationTerminal: config.pilotDefaults.destinationTerminal,
                vehicleLabel: config.pilotDefaults.vehicleLabel,
                minPassengerThreshold: config.pilotDefaults.minPassengerThreshold,
                customerVisible: false,
                dropoffMode: config.dropoffMode,
                earlyDepartureOffered: false,
                earlyDepartureAcceptedBookingIds: [],
                homeCollectionCount: 0,
                waitlistCount: 0,
                paymentStageStatus: "NOT_CREATED",
                createdAt: now,
                updatedAt: now,
            });
            const home = (0, logic_1.evaluateHomeCollection)("", 0, config.maxHomeCollectionsPerJourney, 0, false);
            tx.set(bookingRef, {
                journeyId: journeyRef.id,
                publicNumber,
                passengers,
                ...contact,
                uid: contact.uid || "",
                luggage,
                dropoffTerminal: terminal,
                homeCollection: home.eligibility,
                homeCollectionSurchargePence: 0,
                paymentId,
                paymentMethodRef: "hosted_payment_link",
                paymentStatus: "HOSTED_UNPAID",
                hostedPaymentStatus: "UNPAID",
                reservationStatus: "PROVISIONAL",
                paidAmountPence: 0,
                termsAcceptedAt: now,
                termsVersion: types_1.SHARE_TERMS_VERSION,
                boardStatus: "NOT_CHECKED_IN",
                earlyDepartureAccepted: false,
                manageTokenHash: (0, logic_1.hashToken)(manageToken),
                idempotencyKey,
                createdAt: now,
            });
            tx.set(db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(paymentId), {
                id: paymentId,
                bookingId: bookingRef.id,
                journeyId: journeyRef.id,
                amountPence: airport.farePence * passengers,
                currency: "GBP",
                status: "HOSTED_UNPAID",
                paymentMethodRef: "hosted_payment_link",
                provider: "hosted_payment_link",
                updatedAt: now,
            });
            tx.set(slotRef, { journeyId: journeyRef.id, airportId: airport.id, travelDate, departureTime });
            tx.set(idemRef, {
                bookingId: bookingRef.id,
                journeyId: journeyRef.id,
                publicNumber,
                occupiedSeats: passengers,
            });
            return { ok: true, journeyId: journeyRef.id, bookingId: bookingRef.id, publicNumber, occupiedSeats: passengers, manageToken };
        });
        if (result.needsChoice) {
            return { ok: false, needsChoice: true, matches: result.matches, message: "There's already a Spires Share departure close to your requested time." };
        }
        if (result.replay)
            return { ok: true, idempotentReplay: true, ...result };
        await writeAudit("JOURNEY_CREATED", actor, {
            journeyId: String(result.journeyId || ""),
            bookingId: String(result.bookingId || ""),
        });
        const created = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(String(result.journeyId)).get();
        await queueNotification(config, "BOOKING_RECEIVED", contact.email, asJourney(created.id, created.data() || {}), {
            bookingId: String(result.bookingId),
        });
        return result;
    }
    const result = await db().runTransaction(async (tx) => {
        const replaySnap = await tx.get(idemRef);
        if (replaySnap.exists)
            return { replay: true, ...replaySnap.data() };
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(joinJourneyId);
        const journeySnap = await tx.get(journeyRef);
        if (!journeySnap.exists)
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        if (access.role === "customer" && !(0, access_1.isCustomerListableJourney)(journey, access.role)) {
            throw new functions.https.HttpsError("not-found", "Journey not found.");
        }
        if (journey.waitlistOfferOutstanding) {
            throw new functions.https.HttpsError("failed-precondition", "A place is currently offered to someone on the waitlist.");
        }
        if (!(0, logic_1.canAddPassengers)(journey.occupiedSeats, passengers, journey.capacity)) {
            throw new functions.https.HttpsError("failed-precondition", "No remaining places.");
        }
        if (contact.flightDepartureTime &&
            !(0, logic_1.flightCompatible)(journey.departureTime, airport.estimatedDurationMinutes, contact.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
            throw new functions.https.HttpsError("failed-precondition", "This departure would not meet the configured flight safety buffer.");
        }
        const existingBookings = await loadBookingsForJourney(tx, journey.id);
        if (!(0, logic_1.luggageFitsVehicle)(existingBookings.filter((row) => (0, hostedPayment_1.reservationHoldsSeat)(row)).map((row) => row.luggage), luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
            throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the vehicle allowance.");
        }
        const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc();
        const paymentId = `pay_${crypto.randomBytes(12).toString("hex")}`;
        const manageToken = (0, logic_1.newOpaqueToken)();
        const occupied = journey.occupiedSeats + passengers;
        const now = new Date().toISOString();
        const keepConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
        const stage = (0, bookingFlow_1.reservationStageForIncomingPassenger)(journey, config, now);
        const reservationStatus = stage.reservationStatus;
        const status = keepConfirmed
            ? "CONFIRMED"
            : (0, hostedPayment_1.journeyStatusFromOccupancy)(occupied, journey.capacity, journey.status === "PROPOSED" ? "GATHERING_INTEREST" : journey.status, journey.paymentStageStatus || "NOT_CREATED");
        const joinerDeadline = stage.paymentDeadlineAt ? { deadlineAt: stage.paymentDeadlineAt } : null;
        tx.update(journeyRef, { occupiedSeats: occupied, status, updatedAt: now });
        tx.set(bookingRef, {
            journeyId: journey.id,
            publicNumber: journey.publicNumber,
            passengers,
            ...contact,
            uid: contact.uid || "",
            luggage,
            dropoffTerminal: terminal,
            homeCollection: "HOME_COLLECTION_UNAVAILABLE",
            homeCollectionSurchargePence: 0,
            paymentId,
            paymentMethodRef: "hosted_payment_link",
            paymentStatus: (0, hostedPayment_1.paymentStatusFromReservation)(reservationStatus),
            hostedPaymentStatus: reservationStatus === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : "UNPAID",
            reservationStatus,
            paidAmountPence: 0,
            paymentDeadlineAt: joinerDeadline?.deadlineAt || "",
            termsAcceptedAt: now,
            termsVersion: types_1.SHARE_TERMS_VERSION,
            boardStatus: "NOT_CHECKED_IN",
            earlyDepartureAccepted: false,
            manageTokenHash: (0, logic_1.hashToken)(manageToken),
            idempotencyKey,
            createdAt: now,
        });
        tx.set(db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(paymentId), {
            id: paymentId,
            bookingId: bookingRef.id,
            journeyId: journey.id,
            amountPence: journey.farePence * passengers,
            currency: "GBP",
            status: (0, hostedPayment_1.paymentStatusFromReservation)(reservationStatus),
            paymentMethodRef: "hosted_payment_link",
            provider: "hosted_payment_link",
            updatedAt: now,
        });
        tx.set(idemRef, { bookingId: bookingRef.id, journeyId: journey.id, publicNumber: journey.publicNumber, occupiedSeats: occupied });
        return { ok: true, journeyId: journey.id, bookingId: bookingRef.id, occupiedSeats: occupied, status, publicNumber: journey.publicNumber, manageToken, paymentPending: reservationStatus === "PAYMENT_PENDING" };
    });
    if (result.replay)
        return { ok: true, idempotentReplay: true, ...result };
    await writeAudit("PASSENGER_JOINED", actor, {
        journeyId: String(result.journeyId),
        bookingId: String(result.bookingId),
    });
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(String(result.journeyId)).get();
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    await queueNotification(config, "BOOKING_RECEIVED", contact.email, journey, { bookingId: String(result.bookingId) });
    if (result.paymentPending) {
        await queueNotification(config, "PAYMENT_REQUIRED", contact.email, journey, {
            bookingId: String(result.bookingId),
            amountPence: journey.farePence * passengers,
            passengers,
            paymentDeadlineAt: journey.paymentDeadlineAt,
            paymentUrl: journey.paymentLinkUrl,
        });
    }
    return result;
});
exports.spiresShareGetMyBooking = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    if (!access.uid && access.role !== "admin") {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to view your Spires Share reservation.");
    }
    const token = String(data?.manageToken || "");
    const bookingId = String(data?.bookingId || "");
    let booking = null;
    if (token) {
        const hash = (0, logic_1.hashToken)(token);
        const query = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("manageTokenHash", "==", hash).limit(1).get();
        if (!query.empty)
            booking = { id: query.docs[0].id, ...query.docs[0].data() };
    }
    else if (bookingId) {
        const snap = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId).get();
        if (snap.exists)
            booking = { id: snap.id, ...snap.data() };
    }
    if (!booking)
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    if (!(0, hostedPayment_1.canCustomerAccessBooking)(booking, {
        uid: access.uid,
        email: access.email,
        isAdmin: access.role === "admin",
    })) {
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    }
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(booking.journeyId).get();
    if (!journeySnap.exists)
        throw new functions.https.HttpsError("not-found", "Journey not found.");
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    const all = await loadBookingsForJourney(null, journey.id);
    const view = (0, hostedPayment_1.toCustomerBookingView)(journey, booking, all, config);
    return { ...view, bookingId: booking.id };
});
exports.spiresShareGetMyBookings = functions.https.onCall(async (_data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    if (!access.uid)
        throw new functions.https.HttpsError("unauthenticated", "Sign in to view your Spires Share dashboard.");
    const now = new Date().toISOString();
    const [bookingSnap, waitSnap, interestSnap] = await Promise.all([
        db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("uid", "==", access.uid).limit(50).get(),
        db().collection(defaults_1.COLLECTIONS.WAITLIST).where("uid", "==", access.uid).limit(50).get(),
        db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("uid", "==", access.uid).limit(50).get(),
    ]);
    const rows = [];
    for (const doc of bookingSnap.docs) {
        const booking = { id: doc.id, ...doc.data() };
        const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(booking.journeyId).get();
        if (!journeySnap.exists)
            continue;
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        const all = await loadBookingsForJourney(null, journey.id);
        rows.push({ bookingId: booking.id, ...(0, hostedPayment_1.toCustomerBookingView)(journey, booking, all, config) });
    }
    const waitlist = waitSnap.docs.map((doc) => asWaitlist(doc.id, doc.data() || {}));
    const waitlistViews = [];
    const waitByJourney = new Map();
    const allWaitForJourney = new Map();
    for (const entry of waitlist) {
        waitByJourney.set(entry.journeyId, [...(waitByJourney.get(entry.journeyId) || []), entry]);
    }
    for (const journeyId of waitByJourney.keys()) {
        const snap = await db().collection(defaults_1.COLLECTIONS.WAITLIST).where("journeyId", "==", journeyId).get();
        allWaitForJourney.set(journeyId, snap.docs.map((doc) => asWaitlist(doc.id, doc.data() || {})));
    }
    for (const entry of waitlist) {
        const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(entry.journeyId).get();
        if (!journeySnap.exists)
            continue;
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        waitlistViews.push(customerWaitlistView(entry, journey, allWaitForJourney.get(entry.journeyId) || [], now));
    }
    const interestViews = [];
    for (const doc of interestSnap.docs) {
        const entry = { id: doc.id, ...doc.data() };
        const groupSnap = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(entry.interestGroupId).get();
        if (!groupSnap.exists)
            continue;
        interestViews.push(customerInterestView(entry, asInterestGroup(groupSnap.id, groupSnap.data() || {})));
    }
    return { bookings: rows, waitlist: waitlistViews, interest: interestViews };
});
exports.spiresShareGetPaymentLink = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    if (!access.uid)
        throw new functions.https.HttpsError("unauthenticated", "Sign in to open the payment page.");
    const bookingId = String(data?.bookingId || "");
    const snap = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId).get();
    if (!snap.exists)
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    const booking = { id: snap.id, ...snap.data() };
    if (!(0, hostedPayment_1.canCustomerAccessBooking)(booking, {
        uid: access.uid,
        email: access.email,
        isAdmin: access.role === "admin",
    })) {
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    }
    const journeySnap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(booking.journeyId).get();
    if (!journeySnap.exists)
        throw new functions.https.HttpsError("not-found", "Journey not found.");
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    const link = (0, hostedPayment_1.hostedPaymentUrlForCustomer)(journey, booking);
    if (!link) {
        throw new functions.https.HttpsError("failed-precondition", "A payment link is not available for this reservation.");
    }
    return {
        url: link.url,
        amountPence: link.amountPence,
        kind: link.kind,
        notice: "Payment submitted? Payments are currently verified by Spires Taxis. Your booking will show as paid once your payment has been confirmed.",
    };
});
exports.spiresShareCustomerAction = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    if (!access.uid && access.role !== "admin") {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to manage your Spires Share reservation.");
    }
    const action = String(data?.action || "");
    const payload = (data || {});
    if (action === "join-waitlist") {
        return joinWaitlistForCustomer(config, access, payload);
    }
    if (action === "claim-waitlist") {
        return claimWaitlistForCustomer(config, access, payload);
    }
    if (action === "decline-waitlist") {
        return declineWaitlistForCustomer(config, access, String(payload.waitlistId || ""));
    }
    if (action === "accept-interest-proposal" || action === "decline-interest-proposal" || action === "withdraw-interest" || action === "update-interest") {
        const entryId = String(payload.interestEntryId || "");
        if (!entryId)
            throw new functions.https.HttpsError("invalid-argument", "Interest record not found.");
        const entryRef = db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).doc(entryId);
        const entrySnap = await entryRef.get();
        if (!entrySnap.exists)
            throw new functions.https.HttpsError("not-found", "Interest record not found.");
        const entry = { id: entrySnap.id, ...entrySnap.data() };
        if (entry.uid && entry.uid !== access.uid && access.role !== "admin") {
            throw new functions.https.HttpsError("not-found", "Interest record not found.");
        }
        if (entry.status !== "ACTIVE") {
            throw new functions.https.HttpsError("failed-precondition", "This interest record is no longer active.");
        }
        const groupRef = db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(entry.interestGroupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists)
            throw new functions.https.HttpsError("not-found", "Interest group not found.");
        const group = asInterestGroup(groupSnap.id, groupSnap.data() || {});
        const now = new Date().toISOString();
        if (action === "withdraw-interest") {
            await entryRef.set({ status: "WITHDRAWN" }, { merge: true });
            await recountInterestGroupDoc(groupRef, group);
            return { ok: true, status: "WITHDRAWN" };
        }
        if (action === "update-interest") {
            if (group.status === "CONVERTED_TO_JOURNEY") {
                throw new functions.https.HttpsError("failed-precondition", "This request cannot be changed after an exact journey has been proposed.");
            }
            const origin = (0, interestGroups_1.normalizePlace)(String(payload.origin || group.origin));
            const destination = (0, interestGroups_1.normalizePlace)(String(payload.destinationRegion || group.destinationRegion));
            const travelDate = String(payload.travelDate || group.travelDate);
            const window = (0, interestGroups_1.resolveInterestWindow)({
                origin: origin.label,
                destinationRegion: destination.label,
                travelDate,
                preferredDepartureTime: String(payload.preferredDepartureTime || entry.preferredDepartureTime || group.preferredDepartureTime || group.timeWindowStart),
                flexibility: (payload.flexibility || entry.flexibility || "plus_minus_30"),
                passengers: Number(payload.passengers || entry.passengers),
            });
            if ((0, interestGroups_1.destinationMatchingForRegion)(destination.label)) {
                (0, destinationMatching_1.requireIntendedDestination)({
                    intendedDestinationText: String(payload.intendedDestinationText || entry.intendedDestinationText || ""),
                    intendedDestinationPostcode: String(payload.intendedDestinationPostcode || entry.intendedDestinationPostcode || ""),
                    sharedDropoffAcknowledged: payload.sharedDropoffAcknowledged === true || Boolean(entry.sharedDropoffAcknowledgedAt),
                }, destination.label);
            }
            const patch = {
                preferredDepartureTime: window.preferred,
                timeWindowStart: window.start,
                timeWindowEnd: window.end,
                flexibility: window.flexibility,
                passengers: Number(payload.passengers || entry.passengers),
                intendedDestinationText: payload.intendedDestinationText != null ? String(payload.intendedDestinationText) : entry.intendedDestinationText,
                intendedDestinationPostcode: payload.intendedDestinationPostcode != null ? String(payload.intendedDestinationPostcode) : entry.intendedDestinationPostcode,
                flightNumber: payload.flightNumber != null ? String(payload.flightNumber) : entry.flightNumber,
                flightDepartureTime: payload.flightDepartureTime != null ? String(payload.flightDepartureTime) : entry.flightDepartureTime,
                departureTerminal: (0, terminalGuide_1.parseFlightTerminal)(payload.departureTerminal || entry.departureTerminal) || entry.departureTerminal || "",
            };
            const stillMatches = group.origin === origin.label &&
                group.destinationRegion === destination.label &&
                group.travelDate === travelDate &&
                group.timeWindowStart <= window.end &&
                group.timeWindowEnd >= window.start;
            if (stillMatches) {
                await entryRef.set(patch, { merge: true });
                await recountInterestGroupDoc(groupRef, group);
                return { ok: true, rematched: false, publicNumber: group.publicNumber, interestEntryId: entry.id };
            }
            await entryRef.set({ status: "WITHDRAWN" }, { merge: true });
            await recountInterestGroupDoc(groupRef, group);
            const moved = await expressInterestForCustomer(config, access, {
                ...payload,
                origin: origin.label,
                destinationRegion: destination.label,
                travelDate,
                preferredDepartureTime: window.preferred,
                flexibility: window.flexibility,
                passengers: Number(payload.passengers || entry.passengers),
                name: entry.name,
                email: entry.email,
                mobile: entry.mobile,
                termsAccepted: true,
                intendedDestinationText: patch.intendedDestinationText,
                intendedDestinationPostcode: patch.intendedDestinationPostcode,
                sharedDropoffAcknowledged: true,
            });
            return { ok: true, rematched: true, ...moved };
        }
        if (group.status !== "CONVERTED_TO_JOURNEY" || !group.convertedJourneyId) {
            throw new functions.https.HttpsError("failed-precondition", "A proposed journey is not ready to accept yet.");
        }
        if (action === "decline-interest-proposal") {
            await entryRef.set({ status: "DECLINED_PROPOSAL" }, { merge: true });
            await groupRef.set({ updatedAt: now }, { merge: true });
            return { ok: true, status: "DECLINED_PROPOSAL" };
        }
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(group.convertedJourneyId);
        const result = await db().runTransaction(async (tx) => {
            const live = await tx.get(journeyRef);
            if (!live.exists)
                throw new functions.https.HttpsError("not-found", "Proposed journey not found.");
            const journey = asJourney(live.id, live.data() || {});
            const existingBookings = await loadBookingsForJourney(tx, journey.id);
            let destination = null;
            if ((0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
                destination = (0, destinationMatching_1.requireIntendedDestination)({
                    intendedDestinationText: entry.intendedDestinationText || "",
                    intendedDestinationPostcode: entry.intendedDestinationPostcode,
                    sharedDropoffAcknowledged: Boolean(entry.sharedDropoffAcknowledgedAt),
                }, journey.destinationCity || group.destinationRegion);
            }
            const attached = attachPassengerWrites(tx, {
                journey,
                journeyRef,
                existingBookings,
                config,
                passengers: entry.passengers,
                name: entry.name,
                email: entry.email,
                mobile: entry.mobile,
                uid: entry.uid || access.uid,
                luggage: (0, bookingFlow_1.parseLuggage)({}, entry.passengers),
                flexibility: entry.flexibility,
                destination,
                interestEntryId: entry.id,
                dropoffTerminal: entry.dropoffTerminal,
                departureTerminal: entry.departureTerminal,
                flightNumber: entry.flightNumber,
                flightDepartureTime: entry.flightDepartureTime,
                now,
            });
            tx.set(entryRef, { status: "CONVERTED", convertedBookingId: attached.bookingId }, { merge: true });
            return attached;
        });
        await writeAudit("INTEREST_CONVERTED", access.email, { interestGroupId: group.id, bookingId: result.bookingId, journeyId: group.convertedJourneyId });
        const journeySnap = await journeyRef.get();
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        await queueNotification(config, "BOOKING_RECEIVED", entry.email, journey, { bookingId: result.bookingId });
        if (result.paymentPending) {
            await queueNotification(config, "PAYMENT_REQUIRED", entry.email, journey, {
                bookingId: result.bookingId,
                amountPence: journey.farePence * entry.passengers,
                paymentDeadlineAt: result.paymentDeadlineAt,
                paymentUrl: journey.paymentLinkUrl,
            });
        }
        return { ok: true, ...result, publicNumber: journey.publicNumber };
    }
    const token = String(data?.manageToken || "");
    const bookingId = String(data?.bookingId || "");
    let bookingDoc = null;
    if (token) {
        const hash = (0, logic_1.hashToken)(token);
        const query = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("manageTokenHash", "==", hash).limit(1).get();
        bookingDoc = query.docs[0] || null;
    }
    else if (bookingId) {
        bookingDoc = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId).get();
        if (!bookingDoc.exists)
            bookingDoc = null;
    }
    if (!bookingDoc)
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    const booking = { id: bookingDoc.id, ...bookingDoc.data() };
    if (!(0, hostedPayment_1.canCustomerAccessBooking)(booking, {
        uid: access.uid,
        email: access.email,
        isAdmin: access.role === "admin",
    })) {
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    }
    const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(booking.journeyId);
    const journeySnap = await journeyRef.get();
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    if (action === "accept-early-departure" || action === "reject-early-departure" || action === "accept-four-passenger" || action === "reject-four-passenger") {
        const accept = action === "accept-early-departure" || action === "accept-four-passenger";
        if (journey.status !== "FOUR_PASSENGER_OPTION" && journey.status !== "SUPPLEMENT_PAYMENT") {
            throw new functions.https.HttpsError("failed-precondition", "The four passenger option is not available on this journey.");
        }
        const now = new Date().toISOString();
        await bookingDoc.ref.set({
            earlyDepartureAccepted: accept,
            fourPassengerAccepted: accept,
            fourPassengerAcceptedAt: accept ? now : admin.firestore.FieldValue.delete(),
        }, { merge: true });
        const bookings = (await loadBookingsForJourney(null, journey.id)).map((row) => row.id === booking.id ? { ...row, fourPassengerAccepted: accept, earlyDepartureAccepted: accept } : row);
        const holding = bookings.filter(hostedPayment_1.reservationHoldsSeat);
        const accepted = holding.filter((row) => row.fourPassengerAccepted).reduce((sum, row) => sum + row.passengers, 0);
        const required = (0, hostedPayment_1.occupiedFromBookings)(holding);
        if (accept && accepted === required) {
            await journeyRef.set({ status: "SUPPLEMENT_PAYMENT", updatedAt: now }, { merge: true });
            for (const row of holding) {
                await queueNotification(config, "SUPPLEMENT_PAYMENT_REQUIRED", row.email, { ...journey, status: "SUPPLEMENT_PAYMENT" }, {
                    bookingId: row.id,
                    passengers: row.passengers,
                    amountPence: (0, hostedPayment_1.supplementDuePence)(row),
                });
            }
        }
        await writeAudit(accept ? "FOUR_PASSENGER_ACCEPTED" : "FOUR_PASSENGER_REJECTED", access.email, { journeyId: journey.id, bookingId: booking.id });
        return { ok: true, accepted, required, allAccepted: accept && accepted === required, confirmed: false };
    }
    if (action === "retry-payment" || action === "mark-paid") {
        throw new functions.https.HttpsError("permission-denied", "Only Spires Taxis can confirm a payment as received.");
    }
    if (action === "payment-submitted") {
        await bookingDoc.ref.set({ paymentSubmittedAt: new Date().toISOString() }, { merge: true });
        return {
            ok: true,
            paid: false,
            notice: "Payment submitted? Payments are currently verified by Spires Taxis. Your booking will show as paid once your payment has been confirmed.",
        };
    }
    if (action === "accept-shared-dropoff" || action === "decline-shared-dropoff") {
        if (!(0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "This journey does not use destination matching.");
        }
        if (!(0, destinationMatching_1.proposedHubId)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "A shared drop off has not been proposed yet.");
        }
        const now = new Date().toISOString();
        if (action === "decline-shared-dropoff") {
            if (booking.reservationStatus === "PAID" || (booking.paidAmountPence || 0) > 0) {
                throw new functions.https.HttpsError("failed-precondition", "A paid reservation cannot decline the shared drop off through this flow.");
            }
            await db().runTransaction(async (tx) => {
                const live = await tx.get(journeyRef);
                const liveBooking = await tx.get(bookingDoc.ref);
                if (!live.exists || !liveBooking.exists)
                    return;
                const liveJourney = asJourney(live.id, live.data() || {});
                const allSnap = await tx.get(db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", liveJourney.id));
                const remaining = allSnap.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() }))
                    .map((row) => (row.id === booking.id ? { ...row, reservationStatus: "DROP_OFF_DECLINED" } : row))
                    .filter(hostedPayment_1.reservationHoldsSeat);
                tx.update(bookingDoc.ref, {
                    reservationStatus: "DROP_OFF_DECLINED",
                    sharedDropoffDeclinedAt: now,
                    sharedDropoffAcceptedAt: admin.firestore.FieldValue.delete(),
                    acceptedDropoffProposalVersion: admin.firestore.FieldValue.delete(),
                    hostedPaymentStatus: "UNPAID",
                    paymentStatus: "HOSTED_UNPAID",
                });
                const occ = (0, hostedPayment_1.occupiedFromBookings)(remaining);
                tx.update(journeyRef, {
                    occupiedSeats: occ,
                    status: (0, hostedPayment_1.journeyStatusFromOccupancy)(occ, liveJourney.capacity, "GATHERING_INTEREST", liveJourney.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(liveJourney, remaining)),
                    updatedAt: now,
                });
            });
            await writeAudit("SHARED_DROPOFF_DECLINED", access.email, { bookingId: booking.id, journeyId: journey.id });
            await queueNotification(config, "PLACE_RELEASED", booking.email, journey, { bookingId: booking.id });
            await offerNextWaitlist(config, journey.id);
            return { ok: true, reservationStatus: "DROP_OFF_DECLINED" };
        }
        await db().runTransaction(async (tx) => {
            const live = await tx.get(journeyRef);
            const liveBooking = await tx.get(bookingDoc.ref);
            if (!live.exists || !liveBooking.exists)
                return;
            const liveJourney = asJourney(live.id, live.data() || {});
            const allSnap = await tx.get(db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", liveJourney.id));
            const all = allSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const nextBooking = {
                ...booking,
                sharedDropoffAcceptedAt: now,
                acceptedDropoffProposalVersion: Number(liveJourney.sharedDropoffProposalVersion || 1),
                sharedDropoffDeclinedAt: undefined,
                reservationStatus: liveJourney.paymentStageStatus === "OPEN" && booking.reservationStatus === "PROVISIONAL"
                    ? "PAYMENT_PENDING"
                    : booking.reservationStatus,
            };
            tx.update(bookingDoc.ref, {
                sharedDropoffAcceptedAt: now,
                acceptedDropoffProposalVersion: Number(liveJourney.sharedDropoffProposalVersion || 1),
                sharedDropoffDeclinedAt: admin.firestore.FieldValue.delete(),
                ...(liveJourney.paymentStageStatus === "OPEN" && booking.reservationStatus === "PROVISIONAL"
                    ? {
                        reservationStatus: "PAYMENT_PENDING",
                        hostedPaymentStatus: "PAYMENT_PENDING",
                        paymentStatus: "HOSTED_PENDING",
                        paymentDeadlineAt: liveJourney.paymentDeadlineAt,
                    }
                    : {}),
            });
            const nextAll = all.map((row) => (row.id === booking.id ? nextBooking : row));
            tx.update(journeyRef, {
                status: (0, hostedPayment_1.journeyStatusFromOccupancy)((0, hostedPayment_1.occupiedFromBookings)(nextAll), liveJourney.capacity, liveJourney.status, liveJourney.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(liveJourney, nextAll)),
                updatedAt: now,
            });
        });
        await writeAudit("SHARED_DROPOFF_ACCEPTED", access.email, { bookingId: booking.id, journeyId: journey.id });
        return { ok: true, accepted: true };
    }
    if (action === "cancel") {
        const now = new Date().toISOString();
        const hours = (0, hostedPayment_1.hoursBeforeIso)(journey.departureAt, now);
        const category = (0, hostedPayment_1.cancellationCategoryFor)(hours, journey.status === "CONFIRMED");
        const wasConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
        await db().runTransaction(async (tx) => {
            const live = await tx.get(journeyRef);
            const liveBooking = await tx.get(bookingDoc.ref);
            if (!live.exists || !liveBooking.exists)
                return;
            const liveJourney = asJourney(live.id, live.data() || {});
            const allSnap = await tx.get(db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", liveJourney.id));
            const all = allSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            tx.update(bookingDoc.ref, {
                cancelledAt: now,
                hoursBeforeDeparture: hours,
                cancellationCategory: category,
                reservationStatus: category === "LATE_CANCELLATION" ? "LATE_CANCELLED" : "CANCELLED",
                refundStatus: Number(liveBooking.data()?.paidAmountPence || 0) > 0 ? "PENDING" : "NONE",
                seatResold: false,
            });
            const remaining = all
                .map((row) => (row.id === booking.id ? { ...row, reservationStatus: "CANCELLED" } : row))
                .filter(hostedPayment_1.reservationHoldsSeat);
            const occ = (0, hostedPayment_1.occupiedFromBookings)(remaining);
            tx.update(journeyRef, {
                occupiedSeats: occ,
                status: wasConfirmed
                    ? liveJourney.status
                    : (0, hostedPayment_1.journeyStatusFromOccupancy)(occ, liveJourney.capacity, "GATHERING_INTEREST", liveJourney.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(liveJourney, remaining)),
                updatedAt: now,
            });
        });
        await writeAudit("PASSENGER_LEFT", access.email, { bookingId: booking.id, journeyId: journey.id, category });
        await queueNotification(config, "CANCELLATION_CONFIRMED", booking.email, journey, { bookingId: booking.id });
        await offerNextWaitlist(config, journey.id);
        return { ok: true, category, journeyStillConfirmed: wasConfirmed };
    }
    throw new functions.https.HttpsError("invalid-argument", "Unknown customer action.");
});
async function offerNextWaitlist(config, journeyId) {
    if (!config.waitlistEnabled)
        return;
    const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journeyId);
    const next = await db().runTransaction(async (tx) => {
        const live = await tx.get(journeyRef);
        if (!live.exists)
            return null;
        const occupied = Number(live.data()?.occupiedSeats || 0);
        const capacity = Number(live.data()?.capacity || 5);
        const remaining = (0, logic_1.remainingSeats)(occupied, capacity);
        if (remaining <= 0)
            return null;
        if (live.data()?.waitlistOfferOutstanding === true)
            return null;
        const waitSnap = await tx.get(db().collection(defaults_1.COLLECTIONS.WAITLIST).where("journeyId", "==", journeyId));
        const entries = waitSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const candidate = (0, logic_1.nextCompatibleWaitlistOffer)(entries, remaining);
        if (!candidate)
            return null;
        const token = (0, logic_1.newOpaqueToken)();
        const now = new Date().toISOString();
        tx.set(db().collection(defaults_1.COLLECTIONS.WAITLIST).doc(candidate.id), {
            status: "OFFERED",
            offeredAt: now,
            offerExpiresAt: (0, timezone_1.addMinutesIso)(now, config.waitlistOfferMinutes),
            offerTokenHash: (0, logic_1.hashToken)(token),
        }, { merge: true });
        tx.update(live.ref, { waitlistOfferOutstanding: true, updatedAt: now });
        return { ...candidate, token };
    });
    if (next?.email) {
        const journeySnap = await journeyRef.get();
        const journey = asJourney(journeySnap.id, journeySnap.data() || {});
        await queueNotification(config, "WAITLIST_PLACE_AVAILABLE", next.email, journey, { offerMinutes: config.waitlistOfferMinutes });
        await queueNotification(config, "WAITLIST_OFFERED", next.email, journey);
        await writeAudit("WAITLIST_OFFERED", "system", { journeyId, waitlistId: next.id });
    }
}
exports.spiresShareExpressInterest = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    return expressInterestForCustomer(config, access, (data || {}));
});
exports.spiresSharePreviewInterest = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    await assertShareAccess(context, config, "customer");
    const payload = (data || {});
    const origin = (0, interestGroups_1.normalizePlace)(String(payload.origin || ""));
    const destination = (0, interestGroups_1.normalizePlace)(String(payload.destinationRegion || payload.destination || ""));
    const travelDate = String(payload.travelDate || "");
    if (!origin.label || !destination.label || !travelDate) {
        return { match: null };
    }
    let window;
    try {
        window = (0, interestGroups_1.resolveInterestWindow)({
            origin: origin.label,
            destinationRegion: destination.label,
            travelDate,
            preferredDepartureTime: String(payload.preferredDepartureTime || ""),
            flexibility: (payload.flexibility || "plus_minus_30"),
            passengers: Number(payload.passengers) || 1,
        });
    }
    catch {
        return { match: null };
    }
    const openSnap = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).limit(200).get();
    const match = (0, interestGroups_1.previewCompatibleInterest)(openSnap.docs.map((doc) => asInterestGroup(doc.id, doc.data() || {})), {
        origin: origin.label,
        destinationRegion: destination.label,
        travelDate,
        preferredDepartureTime: window.preferred,
        flexibility: window.flexibility,
        timeWindowStart: window.start,
        timeWindowEnd: window.end,
        passengers: Number(payload.passengers) || 1,
    });
    return {
        match,
        journeyType: (0, interestGroups_1.journeyTypeForRegion)(destination.label),
        destinationMatchingEnabled: (0, interestGroups_1.destinationMatchingForRegion)(destination.label),
        matchingUncertain: !origin.known || !destination.known,
    };
});
exports.spiresShareAcceptWaitlist = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "customer");
    return claimWaitlistForCustomer(config, access, (data || {}));
});
exports.spiresShareAdminAction = functions.https.onCall(async (data, context) => {
    const config = await loadConfig();
    const access = await assertShareAccess(context, config, "admin");
    const actor = access.email;
    const action = String(data?.action || "");
    const payload = (data || {});
    if (action === "create-journey") {
        const defaults = config.pilotDefaults;
        const airportId = String(payload.airportId || defaults.airportId);
        if (!(0, logic_1.isMvpAirport)(config, airportId)) {
            throw new functions.https.HttpsError("failed-precondition", "This Spires Share route is not available yet.");
        }
        const airport = (0, logic_1.airportById)(config, airportId);
        if (!airport)
            throw new functions.https.HttpsError("invalid-argument", "Unknown airport.");
        const travelDate = String(payload.travelDate || "");
        const departureTime = String(payload.departureTime || "");
        if (!travelDate || !departureTime) {
            throw new functions.https.HttpsError("invalid-argument", "Date and departure time are required.");
        }
        const capacity = Number(payload.capacity) || defaults.capacity;
        if (capacity < 1 || capacity > 5) {
            throw new functions.https.HttpsError("invalid-argument", "Capacity must be between 1 and 5.");
        }
        const farePence = Number(payload.farePence) || defaults.farePence;
        const targetRevenuePence = Number(payload.targetRevenuePence) || farePence * capacity || defaults.targetRevenuePence;
        const minPassengerThreshold = Number(payload.minPassengerThreshold) || defaults.minPassengerThreshold;
        const deadlineHours = Number(payload.confirmationDeadlineHoursBeforeDeparture) ||
            defaults.confirmationDeadlineHoursBeforeDeparture ||
            config.confirmationDeadlineHoursBeforeDeparture;
        const departureAt = (0, timezone_1.londonDateTimeToUtcIso)(travelDate, departureTime);
        const now = new Date().toISOString();
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc();
        const destinationTerminal = String(payload.destinationTerminal || defaults.destinationTerminal || "T3");
        await journeyRef.set({
            publicNumber: (0, logic_1.publicNumberFor)(travelDate, departureTime),
            airportId,
            travelDate,
            departureTime,
            departureAt,
            confirmationDeadlineAt: (0, timezone_1.subtractHoursIso)(departureAt, deadlineHours),
            status: "GATHERING_INTEREST",
            capacity,
            occupiedSeats: 0,
            farePence,
            targetRevenuePence,
            originLabel: String(payload.originLabel || defaults.originLabel),
            departureLocation: String(payload.departureLocation || defaults.departureLocation),
            destinationLabel: String(payload.destinationLabel || defaults.destinationLabel),
            destinationTerminal,
            vehicleLabel: String(payload.vehicleLabel || defaults.vehicleLabel),
            minPassengerThreshold,
            customerVisible: payload.customerVisible === true,
            adminNotes: String(payload.notes || payload.adminNotes || ""),
            dropoffMode: config.dropoffMode,
            journeyType: "AIRPORT",
            destinationMatchingEnabled: false,
            earlyDepartureOffered: false,
            earlyDepartureAcceptedBookingIds: [],
            homeCollectionCount: 0,
            waitlistCount: 0,
            paymentStageStatus: "NOT_CREATED",
            createdAt: now,
            updatedAt: now,
        });
        await db()
            .collection(defaults_1.COLLECTIONS.SLOTS)
            .doc((0, timezone_1.slotKey)(airportId, travelDate, departureTime))
            .set({ journeyId: journeyRef.id, airportId, travelDate, departureTime }, { merge: true });
        await writeAudit("JOURNEY_CREATED", actor, { journeyId: journeyRef.id });
        return { ok: true, journeyId: journeyRef.id, publicNumber: (0, logic_1.publicNumberFor)(travelDate, departureTime), customerVisible: payload.customerVisible === true };
    }
    if (action === "create-city-journey") {
        const originCity = String(payload.originCity || "").trim();
        const destinationCity = String(payload.destinationCity || "").trim();
        const departureLocation = String(payload.departureLocation || "").trim();
        const travelDate = String(payload.travelDate || "");
        const departureTime = String(payload.departureTime || "");
        if (!originCity || !destinationCity || !departureLocation || !travelDate || !departureTime) {
            throw new functions.https.HttpsError("invalid-argument", "Origin city, destination city, departure location, date and time are required.");
        }
        const capacity = Number(payload.capacity) || config.pilotDefaults.capacity;
        if (capacity < 1 || capacity > 5) {
            throw new functions.https.HttpsError("invalid-argument", "Capacity must be between 1 and 5.");
        }
        const farePence = Number(payload.farePence) || config.pilotDefaults.farePence;
        const targetRevenuePence = Number(payload.targetRevenuePence) || farePence * capacity;
        const minPassengerThreshold = Number(payload.minPassengerThreshold) || config.pilotDefaults.minPassengerThreshold;
        const deadlineHours = Number(payload.confirmationDeadlineHoursBeforeDeparture) ||
            config.pilotDefaults.confirmationDeadlineHoursBeforeDeparture ||
            config.confirmationDeadlineHoursBeforeDeparture;
        const departureAt = (0, timezone_1.londonDateTimeToUtcIso)(travelDate, departureTime);
        const now = new Date().toISOString();
        const airportId = (0, destinationMatching_1.cityRouteKey)(originCity, destinationCity);
        const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc();
        await journeyRef.set({
            publicNumber: (0, logic_1.publicNumberFor)(travelDate, departureTime),
            airportId,
            travelDate,
            departureTime,
            departureAt,
            confirmationDeadlineAt: (0, timezone_1.subtractHoursIso)(departureAt, deadlineHours),
            status: "GATHERING_INTEREST",
            capacity,
            occupiedSeats: 0,
            farePence,
            targetRevenuePence,
            originLabel: originCity,
            originCity,
            destinationCity,
            destinationLabel: destinationCity,
            departureLocation,
            vehicleLabel: String(payload.vehicleLabel || config.pilotDefaults.vehicleLabel),
            minPassengerThreshold,
            customerVisible: false,
            adminNotes: String(payload.notes || payload.adminNotes || ""),
            dropoffMode: "common_dropoff",
            journeyType: "CITY",
            destinationMatchingEnabled: true,
            destinationMatchingPublicEnabled: false,
            sharedDropoffProposalVersion: 0,
            earlyDepartureOffered: false,
            earlyDepartureAcceptedBookingIds: [],
            homeCollectionCount: 0,
            waitlistCount: 0,
            paymentStageStatus: "NOT_CREATED",
            createdAt: now,
            updatedAt: now,
        });
        await db()
            .collection(defaults_1.COLLECTIONS.SLOTS)
            .doc((0, timezone_1.slotKey)(airportId, travelDate, departureTime))
            .set({ journeyId: journeyRef.id, airportId, travelDate, departureTime }, { merge: true });
        await writeAudit("JOURNEY_CREATED", actor, { journeyId: journeyRef.id });
        return { ok: true, journeyId: journeyRef.id, publicNumber: (0, logic_1.publicNumberFor)(travelDate, departureTime), customerVisible: false };
    }
    if (action === "create-dropoff-hub") {
        const name = String(payload.name || "").trim();
        const city = String(payload.city || "").trim();
        if (!name || !city)
            throw new functions.https.HttpsError("invalid-argument", "Hub name and city are required.");
        const now = new Date().toISOString();
        const hubRef = db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).doc();
        const hub = {
            hubId: hubRef.id,
            name,
            city,
            displayName: String(payload.displayName || name).trim(),
            address: String(payload.address || "").trim() || undefined,
            postcode: String(payload.postcode || "").trim() || undefined,
            latitude: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : undefined,
            longitude: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : undefined,
            enabled: payload.enabled === true,
            adminNotes: String(payload.adminNotes || "").trim() || undefined,
            createdAt: now,
            updatedAt: now,
        };
        await hubRef.set(hub);
        await writeAudit("DROPOFF_HUB_CREATED", actor, { hubId: hubRef.id });
        return { ok: true, hubId: hubRef.id };
    }
    if (action === "update-dropoff-hub") {
        const hubId = String(payload.hubId || "");
        const hubRef = db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).doc(hubId);
        const hubSnap = await hubRef.get();
        if (!hubSnap.exists)
            throw new functions.https.HttpsError("not-found", "Shared drop off hub not found.");
        const now = new Date().toISOString();
        await hubRef.set({
            enabled: payload.enabled === true,
            name: payload.name != null ? String(payload.name) : hubSnap.data()?.name,
            displayName: payload.displayName != null ? String(payload.displayName) : hubSnap.data()?.displayName,
            adminNotes: payload.adminNotes != null ? String(payload.adminNotes) : hubSnap.data()?.adminNotes,
            updatedAt: now,
        }, { merge: true });
        await writeAudit("DROPOFF_HUB_UPDATED", actor, { hubId });
        return { ok: true, hubId };
    }
    if (action === "propose-from-interest" || action === "merge-interest" || action === "close-interest") {
        const interestGroupId = String(payload.interestGroupId || "");
        if (!interestGroupId)
            throw new functions.https.HttpsError("invalid-argument", "Interest group is required.");
        const groupRef = db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(interestGroupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists)
            throw new functions.https.HttpsError("not-found", "Interest group not found.");
        const group = asInterestGroup(groupSnap.id, groupSnap.data() || {});
        const now = new Date().toISOString();
        if (action === "close-interest") {
            if (group.status === "CONVERTED_TO_JOURNEY") {
                throw new functions.https.HttpsError("failed-precondition", "A converted interest group cannot be closed this way.");
            }
            await groupRef.set({ status: "CANCELLED", updatedAt: now }, { merge: true });
            const entries = await db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("interestGroupId", "==", group.id).get();
            for (const doc of entries.docs) {
                if (doc.data()?.status === "ACTIVE")
                    await doc.ref.set({ status: "WITHDRAWN" }, { merge: true });
            }
            await writeAudit("INTEREST_CLOSED", actor, { interestGroupId: group.id });
            return { ok: true, status: "CANCELLED" };
        }
        if (action === "merge-interest") {
            const targetId = String(payload.targetInterestGroupId || "");
            if (!targetId || targetId === group.id) {
                throw new functions.https.HttpsError("invalid-argument", "Choose a different interest group to merge into.");
            }
            const targetRef = db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).doc(targetId);
            const targetSnap = await targetRef.get();
            if (!targetSnap.exists)
                throw new functions.https.HttpsError("not-found", "Interest group not found.");
            const target = asInterestGroup(targetSnap.id, targetSnap.data() || {});
            if (group.status === "CONVERTED_TO_JOURNEY" || target.status === "CONVERTED_TO_JOURNEY") {
                throw new functions.https.HttpsError("failed-precondition", "Converted interest groups cannot be merged.");
            }
            if (group.origin !== target.origin || group.destinationRegion !== target.destinationRegion || group.travelDate !== target.travelDate) {
                throw new functions.https.HttpsError("failed-precondition", "Only compatible interest groups can be merged.");
            }
            const entries = await db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("interestGroupId", "==", group.id).get();
            for (const doc of entries.docs) {
                if (doc.data()?.status === "ACTIVE")
                    await doc.ref.set({ interestGroupId: target.id }, { merge: true });
            }
            await groupRef.set({ status: "CANCELLED", updatedAt: now }, { merge: true });
            if (group.matchingUncertain)
                await targetRef.set({ matchingUncertain: true }, { merge: true });
            await recountInterestGroupDoc(targetRef, target);
            await writeAudit("INTEREST_MERGED", actor, { sourceInterestGroupId: group.id, interestGroupId: target.id });
            return { ok: true, interestGroupId: target.id };
        }
        if (group.status !== "GATHERING_INTEREST" && group.status !== "READY_FOR_REVIEW") {
            throw new functions.https.HttpsError("failed-precondition", "This interest group cannot be converted.");
        }
        const departureLocation = String(payload.departureLocation || "").trim();
        const departureTime = String(payload.departureTime || "").trim();
        if (!departureLocation || !departureTime) {
            throw new functions.https.HttpsError("invalid-argument", "Exact departure location and departure time are required.");
        }
        const capacity = Number(payload.capacity) || config.pilotDefaults.capacity;
        const airport = group.journeyType === "AIRPORT";
        const farePence = airport
            ? Number(payload.farePence) || config.pilotDefaults.farePence
            : (0, routePricing_1.cityJourneyRequiresOwnFare)(Number(payload.farePence) || undefined);
        const targetRevenuePence = farePence * capacity;
        const minPassengerThreshold = Number(payload.minPassengerThreshold) || group.minPassengerThreshold || config.pilotDefaults.minPassengerThreshold;
        const deadlineHours = config.pilotDefaults.confirmationDeadlineHoursBeforeDeparture || config.confirmationDeadlineHoursBeforeDeparture;
        const departureAt = (0, timezone_1.londonDateTimeToUtcIso)(group.travelDate, departureTime);
        const airportId = airport ? "heathrow" : (0, destinationMatching_1.cityRouteKey)(group.origin, group.destinationRegion);
        const customerVisible = payload.customerVisible === true || (payload.customerVisible !== false && airport);
        if (!airport && customerVisible) {
            throw new functions.https.HttpsError("failed-precondition", "City destination matching journeys are not publicly enabled.");
        }
        const journeyRefNew = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc();
        const hubId = String(payload.hubId || "");
        let hubName = "";
        if (hubId) {
            const hubSnap = await db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).doc(hubId).get();
            if (hubSnap.exists)
                hubName = String(hubSnap.data()?.displayName || hubSnap.data()?.name || "");
        }
        await journeyRefNew.set({
            publicNumber: (0, logic_1.publicNumberFor)(group.travelDate, departureTime),
            airportId,
            travelDate: group.travelDate,
            departureTime,
            departureAt,
            confirmationDeadlineAt: (0, timezone_1.subtractHoursIso)(departureAt, deadlineHours),
            status: "PROPOSED",
            capacity,
            occupiedSeats: 0,
            farePence,
            targetRevenuePence,
            originLabel: group.origin,
            originCity: group.origin,
            destinationCity: group.destinationRegion,
            destinationLabel: airport ? (group.destinationRegion === "Heathrow" ? "Heathrow Airport Terminal 3" : group.destinationRegion) : group.destinationRegion,
            destinationTerminal: airport ? "T3" : "",
            departureLocation,
            vehicleLabel: config.pilotDefaults.vehicleLabel,
            minPassengerThreshold,
            customerVisible,
            adminNotes: String(payload.notes || ""),
            dropoffMode: airport ? config.dropoffMode : "common_dropoff",
            journeyType: group.journeyType,
            destinationMatchingEnabled: group.destinationMatchingEnabled,
            destinationMatchingPublicEnabled: false,
            interestGroupId: group.id,
            proposedSharedDropoffHubId: hubId || "",
            proposedSharedDropoffDisplayName: hubName,
            sharedDropoffProposalVersion: hubId ? 1 : 0,
            earlyDepartureOffered: false,
            earlyDepartureAcceptedBookingIds: [],
            homeCollectionCount: 0,
            waitlistCount: 0,
            paymentStageStatus: "NOT_CREATED",
            fourPassengerFallbackEnabled: airport && group.destinationRegion === "Heathrow",
            fallbackFarePerPassengerPence: airport && group.destinationRegion === "Heathrow" ? 4375 : 0,
            createdAt: now,
            updatedAt: now,
        });
        await db()
            .collection(defaults_1.COLLECTIONS.SLOTS)
            .doc((0, timezone_1.slotKey)(airportId, group.travelDate, departureTime))
            .set({ journeyId: journeyRefNew.id, airportId, travelDate: group.travelDate, departureTime }, { merge: true });
        await groupRef.set({
            status: "CONVERTED_TO_JOURNEY",
            convertedJourneyId: journeyRefNew.id,
            proposedDepartureLocation: departureLocation,
            proposedDepartureTime: departureTime,
            proposedFarePence: farePence,
            proposedAt: now,
            proposedBy: actor,
            updatedAt: now,
        }, { merge: true });
        const entries = await db().collection(defaults_1.COLLECTIONS.INTEREST_ENTRIES).where("interestGroupId", "==", group.id).get();
        const proposed = asJourney(journeyRefNew.id, (await journeyRefNew.get()).data() || {});
        for (const doc of entries.docs) {
            const row = doc.data();
            if (row.status !== "ACTIVE" || !row.email)
                continue;
            await queueNotification(config, "JOURNEY_PROPOSED_FROM_INTEREST", row.email, proposed);
        }
        await writeAudit("INTEREST_CONVERTED", actor, { interestGroupId: group.id, journeyId: journeyRefNew.id });
        await writeAudit("JOURNEY_CREATED", actor, { journeyId: journeyRefNew.id });
        return { ok: true, journeyId: journeyRefNew.id, publicNumber: proposed.publicNumber, customerVisible };
    }
    const journeyId = String(payload.journeyId || "");
    const journeyRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journeyId);
    const snap = await journeyRef.get();
    if (!snap.exists)
        throw new functions.https.HttpsError("not-found", "Journey not found.");
    const journey = asJourney(snap.id, snap.data() || {});
    const bookingsSnap = await db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", journeyId).get();
    const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (action === "set-payment-link") {
        const url = (0, hostedPayment_1.validateHostedPaymentUrl)(String(data?.paymentLinkUrl || ""));
        const now = new Date().toISOString();
        await journeyRef.set({
            paymentLinkUrl: url,
            paymentLinkAddedAt: now,
            paymentStageStatus: journey.paymentStageStatus === "OPEN" ? "OPEN" : "LINK_SAVED",
            updatedAt: now,
        }, { merge: true });
        await writeAudit("PAYMENT_LINK_SAVED", actor, { journeyId });
        return { ok: true, emailed: false };
    }
    if (action === "open-payment-window") {
        if (!journey.paymentLinkUrl) {
            throw new functions.https.HttpsError("failed-precondition", "Add a hosted payment link before opening the payment window.");
        }
        try {
            (0, destinationMatching_1.assertCanOpenPaymentWindow)(journey, bookings);
        }
        catch (err) {
            throw new functions.https.HttpsError("failed-precondition", err.message);
        }
        const now = new Date().toISOString();
        const hours = Number(data?.paymentWindowHours);
        const deadline = (0, paymentDeadline_1.computePaymentDeadline)(now, Number.isFinite(hours) && hours > 0 ? hours : config.paymentWindowHours, config.paymentQuietHoursStart, config.paymentQuietHoursEnd);
        const eligible = bookings.filter((row) => (0, hostedPayment_1.reservationHoldsSeat)(row) && row.reservationStatus !== "PAID");
        const nextStatus = (0, hostedPayment_1.journeyStatusFromOccupancy)(journey.occupiedSeats, journey.capacity, journey.status, "OPEN");
        await journeyRef.set({
            paymentWindowOpenedAt: now,
            paymentDeadlineAt: deadline.deadlineAt,
            paymentStageStatus: "OPEN",
            status: nextStatus,
            updatedAt: now,
        }, { merge: true });
        for (const booking of eligible) {
            await db()
                .collection(defaults_1.COLLECTIONS.BOOKINGS)
                .doc(booking.id)
                .set({
                reservationStatus: "PAYMENT_PENDING",
                hostedPaymentStatus: "PAYMENT_PENDING",
                paymentStatus: "HOSTED_PENDING",
                paymentDeadlineAt: deadline.deadlineAt,
                paymentRequiredNotifiedAt: now,
            }, { merge: true });
            await queueNotification(config, "PAYMENT_REQUIRED", booking.email, { ...journey, paymentDeadlineAt: deadline.deadlineAt }, {
                bookingId: booking.id,
                amountPence: (0, hostedPayment_1.bookingAmountDuePence)(booking, journey.farePence),
                passengers: booking.passengers,
                paymentDeadlineAt: deadline.deadlineAt,
                paymentUrl: journey.paymentLinkUrl,
            });
        }
        await writeAudit("PAYMENT_WINDOW_OPENED", actor, { journeyId, deadlineAt: deadline.deadlineAt });
        return { ok: true, deadlineAt: deadline.deadlineAt, emailed: eligible.length, quietHoursApplied: deadline.quietHoursApplied };
    }
    if (action === "set-payment-deadline") {
        const deadlineAt = String(data?.paymentDeadlineAt || "");
        if (!deadlineAt)
            throw new functions.https.HttpsError("invalid-argument", "paymentDeadlineAt is required.");
        await journeyRef.set({ paymentDeadlineAt: deadlineAt, updatedAt: new Date().toISOString() }, { merge: true });
        return { ok: true, paymentDeadlineAt: deadlineAt };
    }
    if (action === "mark-paid" || action === "undo-payment") {
        const targetId = String(data?.bookingId || "");
        const booking = bookings.find((row) => row.id === targetId);
        if (!booking)
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        const now = new Date().toISOString();
        const paid = action === "mark-paid";
        if (!paid && (journey.locked || journey.status === "CONFIRMED")) {
            throw new functions.https.HttpsError("failed-precondition", "A confirmed journey cannot have payment undone automatically.");
        }
        const previousStatus = String(booking.reservationStatus || "PROVISIONAL");
        const newStatus = paid ? "PAID" : "PAYMENT_PENDING";
        const amount = paid ? (0, hostedPayment_1.bookingAmountDuePence)(booking, journey.farePence) : 0;
        await db()
            .collection(defaults_1.COLLECTIONS.BOOKINGS)
            .doc(booking.id)
            .set({
            reservationStatus: newStatus,
            hostedPaymentStatus: paid ? "PAID" : "PAYMENT_PENDING",
            paymentStatus: paid ? "HOSTED_PAID" : "HOSTED_PENDING",
            paidAmountPence: amount,
            paidAt: paid ? now : admin.firestore.FieldValue.delete(),
        }, { merge: true });
        if (booking.paymentId) {
            await db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(booking.paymentId).set({ status: paid ? "HOSTED_PAID" : "HOSTED_PENDING", updatedAt: now }, { merge: true });
        }
        await writeAudit("PAYMENT_STATUS_CHANGED", actor, {
            journeyId,
            bookingId: booking.id,
            amount: String(amount),
            previousStatus,
            newStatus,
            confirmedBy: actor,
            confirmedAt: now,
            paymentMethod: "hosted_payment_link",
        });
        const nextBookings = bookings.map((row) => row.id === booking.id
            ? {
                ...row,
                reservationStatus: newStatus,
                hostedPaymentStatus: paid ? "PAID" : "PAYMENT_PENDING",
                paidAmountPence: amount,
            }
            : row);
        const confirmed = paid ? await confirmHostedJourney(config, journey, nextBookings) : { ok: false, status: journey.status, failedBookingIds: [], alreadyConfirmed: false };
        if (confirmed.ok && !confirmed.alreadyConfirmed) {
            await writeAudit("JOURNEY_CONFIRMED", actor, { journeyId });
        }
        return { ok: true, ...(0, hostedPayment_1.adminPaymentSummary)(journey, nextBookings), confirmed: confirmed.ok, alreadyConfirmed: confirmed.alreadyConfirmed || false };
    }
    if (action === "set-supplement-link") {
        const url = (0, hostedPayment_1.validateHostedPaymentUrl)(String(data?.supplementPaymentLinkUrl || ""));
        await journeyRef.set({ supplementPaymentLinkUrl: url, supplementLinkAddedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
        await writeAudit("SUPPLEMENT_LINK_SAVED", actor, { journeyId });
        return { ok: true };
    }
    if (action === "mark-supplement-paid") {
        const targetId = String(data?.bookingId || "");
        const booking = bookings.find((row) => row.id === targetId);
        if (!booking)
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        const now = new Date().toISOString();
        const amount = (0, hostedPayment_1.supplementDuePence)(booking);
        await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(booking.id).set({ supplementPaidPence: amount, supplementPaidAt: now }, { merge: true });
        await writeAudit("SUPPLEMENT_STATUS_CHANGED", actor, {
            journeyId,
            bookingId: booking.id,
            amount: String(amount),
            previousStatus: "UNPAID",
            newStatus: "PAID",
            confirmedBy: actor,
            confirmedAt: now,
            paymentMethod: "hosted_payment_link",
        });
        const nextBookings = bookings.map((row) => (row.id === booking.id ? { ...row, supplementPaidPence: amount } : row));
        const confirmed = await confirmHostedJourney(config, journey, nextBookings);
        if (confirmed.ok && !confirmed.alreadyConfirmed)
            await writeAudit("JOURNEY_CONFIRMED", actor, { journeyId });
        return { ok: true, confirmed: confirmed.ok, alreadyConfirmed: confirmed.alreadyConfirmed || false };
    }
    if (action === "cancel") {
        await journeyRef.update({ status: "CANCELLED", updatedAt: new Date().toISOString() });
        for (const booking of bookings) {
            if (booking.paymentId && (0, paymentProvider_1.paymentCanRelease)(booking.paymentStatus)) {
                await db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(booking.paymentId).set({ status: "AUTHORISATION_RELEASED" }, { merge: true });
                await bookingsSnap.docs.find((doc) => doc.id === booking.id)?.ref.set({ paymentStatus: "AUTHORISATION_RELEASED" }, { merge: true });
            }
            await queueNotification(config, "JOURNEY_CANCELLED", booking.email, { ...journey, status: "CANCELLED" }, { bookingId: booking.id });
        }
        await writeAudit("JOURNEY_CANCELLED", actor, { journeyId });
        return { ok: true };
    }
    if (action === "confirm") {
        const result = await confirmHostedJourney(config, journey, bookings);
        if (!result.ok) {
            throw new functions.https.HttpsError("failed-precondition", "Journey is not eligible to confirm. Five paid passengers, or four paid passengers with unanimous acceptance and confirmed supplements, are required.");
        }
        if (!result.alreadyConfirmed)
            await writeAudit("JOURNEY_CONFIRMED", actor, { journeyId });
        return result;
    }
    if (action === "offer-early-departure" || action === "offer-four-passenger") {
        if (!(0, routePricing_1.fourPassengerFallbackEnabled)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "The four passenger option applies to the Heathrow Share pilot only unless this journey has it enabled.");
        }
        if (!(0, logic_1.earlyDepartureEligible)(journey.occupiedSeats, journey.capacity, config.earlyDepartureThreshold, journey.status === "CONFIRMED")) {
            throw new functions.https.HttpsError("failed-precondition", "Early confirmation is only available at 4/5 for this MVP.");
        }
        const fare = (0, logic_1.earlyDepartureFarePence)(journey.targetRevenuePence, journey.occupiedSeats);
        await journeyRef.update({
            earlyDepartureOffered: true,
            status: "FOUR_PASSENGER_OPTION",
            updatedAt: new Date().toISOString(),
        });
        for (const booking of bookings) {
            await queueNotification(config, "EARLY_DEPARTURE_OFFERED", booking.email, journey, {
                proposedFarePence: fare,
                bookingId: booking.id,
            });
        }
        await writeAudit("FOUR_PASSENGER_OFFERED", actor, { journeyId });
        return { ok: true, proposedFarePence: fare, requiresAllToAccept: true };
    }
    if (action === "accept-early-departure") {
        const bookingId = String(data?.bookingId || "");
        const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists || bookingSnap.data()?.journeyId !== journeyId) {
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        }
        await bookingRef.update({ earlyDepartureAccepted: true });
        await journeyRef.update({ earlyDepartureAcceptedBookingIds: admin.firestore.FieldValue.arrayUnion(bookingId) });
        await writeAudit("EARLY_DEPARTURE_ACCEPTED", actor, { journeyId, bookingId });
        const accepted = (0, logic_1.acceptedPassengerCount)(bookings.map((row) => (row.id === bookingId ? { ...row, earlyDepartureAccepted: true } : row)));
        return {
            ok: true,
            accepted,
            required: journey.occupiedSeats,
            confirmed: (0, logic_1.earlyDepartureConfirmed)(accepted, journey.occupiedSeats),
            proposedFarePence: (0, logic_1.earlyDepartureFarePence)(journey.targetRevenuePence, journey.occupiedSeats),
        };
    }
    if (action === "waitlist") {
        if ((0, logic_1.remainingSeats)(journey.occupiedSeats, journey.capacity) > 0 && !journey.waitlistOfferOutstanding) {
            throw new functions.https.HttpsError("failed-precondition", "Places are still available.");
        }
        const now = new Date().toISOString();
        await db().collection(defaults_1.COLLECTIONS.WAITLIST).add({
            journeyId,
            status: "WAITING",
            passengers: Number(data?.passengers) || 1,
            name: String(data?.name || ""),
            email: String(data?.email || ""),
            mobile: String(data?.mobile || ""),
            uid: String(data?.uid || ""),
            joinedWaitlistAt: now,
            createdAt: now,
            termsAcceptedAt: now,
            intendedDestinationText: String(data?.intendedDestinationText || ""),
            intendedDestinationPostcode: String(data?.intendedDestinationPostcode || ""),
            sharedDropoffAcknowledgedAt: data?.sharedDropoffAcknowledged === true ? now : "",
        });
        await journeyRef.update({ waitlistCount: (journey.waitlistCount || 0) + 1 });
        return { ok: true, status: "WAITING" };
    }
    if (action === "offer-waitlist") {
        await offerNextWaitlist(config, journeyId);
        return { ok: true, status: "OFFERED" };
    }
    if (action === "assign") {
        await journeyRef.update({
            assignedVehicleId: String(data?.vehicleId || ""),
            assignedDriverId: String(data?.driverId || ""),
            updatedAt: new Date().toISOString(),
        });
        return { ok: true };
    }
    if (action === "move-booking") {
        const bookingId = String(data?.bookingId || "");
        const targetJourneyId = String(data?.targetJourneyId || "");
        if (!bookingId || !targetJourneyId || targetJourneyId === journeyId) {
            throw new functions.https.HttpsError("invalid-argument", "Choose a different compatible departure.");
        }
        await db().runTransaction(async (tx) => {
            const targetRef = db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(targetJourneyId);
            const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId);
            const [sourceSnap, targetSnap, bookingSnap] = await Promise.all([tx.get(journeyRef), tx.get(targetRef), tx.get(bookingRef)]);
            if (!sourceSnap.exists || !targetSnap.exists || !bookingSnap.exists) {
                throw new functions.https.HttpsError("not-found", "Journey or booking not found.");
            }
            const source = asJourney(sourceSnap.id, sourceSnap.data() || {});
            const target = asJourney(targetSnap.id, targetSnap.data() || {});
            const booking = { id: bookingSnap.id, ...bookingSnap.data() };
            if (booking.journeyId !== source.id)
                throw new functions.https.HttpsError("failed-precondition", "Booking is not on the source journey.");
            if (source.airportId !== target.airportId || source.travelDate !== target.travelDate) {
                throw new functions.https.HttpsError("failed-precondition", "Journeys are not compatible.");
            }
            if (!(0, logic_1.canMovePassengers)(source.occupiedSeats, target.occupiedSeats, booking.passengers, target.capacity)) {
                throw new functions.https.HttpsError("failed-precondition", "The destination journey does not have enough places.");
            }
            const airport = (0, logic_1.airportById)(config, target.airportId);
            if (airport && booking.flightDepartureTime && !(0, logic_1.flightCompatible)(target.departureTime, airport.estimatedDurationMinutes, booking.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
                throw new functions.https.HttpsError("failed-precondition", "The destination departure would violate this passenger's flight safety buffer.");
            }
            const targetOccupied = target.occupiedSeats + booking.passengers;
            const sourceOccupied = source.occupiedSeats - booking.passengers;
            tx.update(journeyRef, {
                occupiedSeats: sourceOccupied,
                status: (0, logic_1.statusFromOccupancy)(sourceOccupied, source.capacity, source.status === "CONFIRMED" || source.status === "FULL" ? "FILLING" : source.status),
                updatedAt: new Date().toISOString(),
            });
            tx.update(targetRef, {
                occupiedSeats: targetOccupied,
                status: targetOccupied >= target.capacity ? "FULL" : (0, logic_1.statusFromOccupancy)(targetOccupied, target.capacity, target.status),
                updatedAt: new Date().toISOString(),
            });
            tx.update(bookingRef, { journeyId: target.id, publicNumber: target.publicNumber });
        });
        await writeAudit("PASSENGER_LEFT", actor, { journeyId, bookingId });
        await writeAudit("PASSENGER_JOINED", actor, { journeyId: targetJourneyId, bookingId });
        await offerNextWaitlist(config, journeyId);
        return { ok: true };
    }
    if (action === "driver") {
        const boardAction = String(data?.boardAction || "");
        const bookingId = String(data?.bookingId || "");
        if (bookingId) {
            const patch = {};
            if (boardAction === "CHECKED_IN")
                patch.boardStatus = "CHECKED_IN";
            if (boardAction === "BOARDED")
                patch.boardStatus = "BOARDED";
            if (boardAction === "NO_SHOW") {
                patch.boardStatus = "NO_SHOW";
                patch.reservationStatus = "NO_SHOW";
                patch.cancellationCategory = "NO_SHOW";
            }
            if (patch.boardStatus) {
                await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId).update(patch);
                await writeAudit(boardAction === "NO_SHOW" ? "PASSENGER_NO_SHOW" : "PASSENGER_CHECKED_IN", actor, { journeyId, bookingId });
            }
        }
        if (boardAction === "DEPARTED" || boardAction === "ARRIVED" || boardAction === "COMPLETED") {
            await journeyRef.update({
                status: boardAction === "COMPLETED" ? "COMPLETED" : journey.status,
                updatedAt: new Date().toISOString(),
                driverStage: boardAction,
            });
            if (boardAction === "COMPLETED")
                await writeAudit("JOURNEY_COMPLETED", actor, { journeyId });
            if (boardAction === "DEPARTED")
                await writeAudit("VEHICLE_DEPARTED", actor, { journeyId });
        }
        return { ok: true };
    }
    if (action === "change-time") {
        const nextTime = String(data?.departureTime || "");
        const airport = (0, logic_1.airportById)(config, journey.airportId);
        if (!airport || !nextTime)
            throw new functions.https.HttpsError("invalid-argument", "Departure time required.");
        for (const booking of bookings) {
            if (booking.flightDepartureTime && !(0, logic_1.flightCompatible)(nextTime, airport.estimatedDurationMinutes, booking.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
                throw new functions.https.HttpsError("failed-precondition", "New time would violate a passenger flight safety buffer.");
            }
        }
        const departureAt = (0, timezone_1.londonDateTimeToUtcIso)(journey.travelDate, nextTime);
        await journeyRef.update({
            departureTime: nextTime,
            departureAt,
            confirmationDeadlineAt: (0, timezone_1.subtractHoursIso)(departureAt, config.confirmationDeadlineHoursBeforeDeparture),
            updatedAt: new Date().toISOString(),
        });
        for (const booking of bookings) {
            await queueNotification(config, "DEPARTURE_TIME_CHANGED", booking.email, { ...journey, departureTime: nextTime }, { bookingId: booking.id });
        }
        return { ok: true };
    }
    if (action === "release-failed-payment") {
        const bookingId = String(data?.bookingId || "");
        const booking = bookings.find((row) => row.id === bookingId);
        if (!booking)
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        await db().runTransaction(async (tx) => {
            const live = await tx.get(journeyRef);
            const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId);
            const occ = Number(live.data()?.occupiedSeats || 0) - booking.passengers;
            tx.update(bookingRef, { paymentStatus: "AUTHORISATION_RELEASED" });
            tx.update(journeyRef, {
                occupiedSeats: Math.max(0, occ),
                status: (0, logic_1.statusFromOccupancy)(Math.max(0, occ), journey.capacity, "FILLING"),
                updatedAt: new Date().toISOString(),
            });
        });
        for (const other of bookings) {
            if (other.id === bookingId || !other.paymentId)
                continue;
            if (other.paymentStatus === "AUTHORISED") {
                await db().collection(defaults_1.COLLECTIONS.PAYMENTS).doc(other.paymentId).set({ status: "AUTHORISATION_RELEASED" }, { merge: true });
                await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(other.id).set({ paymentStatus: "PAYMENT_METHOD_VERIFIED" }, { merge: true });
            }
        }
        await offerNextWaitlist(config, journeyId);
        return { ok: true };
    }
    if (action === "publish-journey" || action === "unpublish-journey") {
        const customerVisible = action === "publish-journey";
        if (customerVisible && (0, destinationMatching_1.cityMatchingPublicBlocked)(journey, config.cityMatchingPublicEnabled)) {
            throw new functions.https.HttpsError("failed-precondition", "City destination matching journeys are not publicly enabled.");
        }
        await journeyRef.set({ customerVisible, updatedAt: new Date().toISOString() }, { merge: true });
        return { ok: true, customerVisible };
    }
    if (action === "record-refund") {
        const bookingId = String(payload.bookingId || "");
        const booking = bookings.find((row) => row.id === bookingId);
        if (!booking)
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        const refundStatus = String(payload.refundStatus || "PENDING");
        const allowed = ["NONE", "PENDING", "REFUNDED", "RETAINED", "PARTIAL"];
        if (!allowed.includes(refundStatus)) {
            throw new functions.https.HttpsError("invalid-argument", "Choose a valid refund status.");
        }
        await db()
            .collection(defaults_1.COLLECTIONS.BOOKINGS)
            .doc(bookingId)
            .set({
            refundStatus,
            amountRefundedPence: Math.max(0, Number(payload.amountRefundedPence) || 0),
            amountRetainedPence: Math.max(0, Number(payload.amountRetainedPence) || 0),
            adminNotes: payload.adminNotes != null ? String(payload.adminNotes) : booking.adminNotes || "",
        }, { merge: true });
        return { ok: true };
    }
    if (action === "add-admin-note") {
        const bookingId = String(payload.bookingId || "");
        const note = String(payload.adminNotes || payload.notes || "");
        if (bookingId) {
            const booking = bookings.find((row) => row.id === bookingId);
            if (!booking)
                throw new functions.https.HttpsError("not-found", "Booking not found.");
            await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId).set({ adminNotes: note }, { merge: true });
        }
        else {
            await journeyRef.set({ adminNotes: note, updatedAt: new Date().toISOString() }, { merge: true });
        }
        return { ok: true };
    }
    if (action === "set-proposed-dropoff" || action === "notify-dropoff-passengers") {
        if (!(0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "This journey does not use destination matching.");
        }
        const hubsSnap = await db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).limit(200).get();
        const hubs = hubsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (action === "notify-dropoff-passengers") {
            if (!(0, destinationMatching_1.proposedHubId)(journey)) {
                throw new functions.https.HttpsError("failed-precondition", "Select a shared drop off hub first.");
            }
            for (const booking of bookings.filter(hostedPayment_1.reservationHoldsSeat)) {
                await queueNotification(config, "SHARED_DROPOFF_PROPOSED", booking.email, journey, { bookingId: booking.id });
            }
            return { ok: true, notified: bookings.filter(hostedPayment_1.reservationHoldsSeat).length };
        }
        const hubId = String(payload.hubId || "");
        const hub = (0, destinationMatching_1.assertHubSelectable)(hubs.find((row) => row.id === hubId || row.hubId === hubId), hubId);
        if ((0, destinationMatching_1.paymentSensitiveForDropoffChange)(journey, bookings) && (0, destinationMatching_1.proposedHubId)(journey)) {
            throw new functions.https.HttpsError("failed-precondition", "The shared drop off cannot be changed after payment has opened. This needs exceptional manual intervention.");
        }
        const now = new Date().toISOString();
        const previousVersion = Number(journey.sharedDropoffProposalVersion || 0);
        const nextVersion = previousVersion + 1;
        const changed = Boolean((0, destinationMatching_1.proposedHubId)(journey) && (0, destinationMatching_1.proposedHubId)(journey) !== (hub.hubId || hub.id));
        const suggestion = (0, destinationMatching_1.applyMatchingSuggestion)(journey, (0, destinationMatching_1.rankSharedDropoffHubs)(bookings, hubs));
        await journeyRef.set({
            proposedSharedDropoffHubId: hub.hubId || hub.id,
            proposedSharedDropoffDisplayName: hub.displayName || hub.name,
            confirmedSharedDropoffHubId: hub.hubId || hub.id,
            sharedDropoffProposalVersion: nextVersion,
            sharedDropoffProposedAt: now,
            sharedDropoffProposedBy: actor,
            sharedDropoffConfirmedAt: now,
            sharedDropoffConfirmedBy: actor,
            suggestedSharedDropoffHubId: suggestion.suggestedSharedDropoffHubId,
            suggestedSharedDropoffReason: suggestion.suggestedSharedDropoffReason,
            status: (0, hostedPayment_1.journeyStatusFromOccupancy)((0, hostedPayment_1.occupiedFromBookings)(bookings), journey.capacity, journey.status, journey.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)({
                ...journey,
                proposedSharedDropoffHubId: hub.hubId || hub.id,
                confirmedSharedDropoffHubId: hub.hubId || hub.id,
                sharedDropoffProposalVersion: nextVersion,
            }, bookings.map((row) => (0, hostedPayment_1.reservationHoldsSeat)(row)
                ? { ...row, sharedDropoffAcceptedAt: undefined, acceptedDropoffProposalVersion: undefined, sharedDropoffDeclinedAt: undefined }
                : row))),
            updatedAt: now,
        }, { merge: true });
        for (const booking of bookings.filter(hostedPayment_1.reservationHoldsSeat)) {
            await db()
                .collection(defaults_1.COLLECTIONS.BOOKINGS)
                .doc(booking.id)
                .set({
                sharedDropoffAcceptedAt: admin.firestore.FieldValue.delete(),
                acceptedDropoffProposalVersion: admin.firestore.FieldValue.delete(),
                sharedDropoffDeclinedAt: admin.firestore.FieldValue.delete(),
            }, { merge: true });
            await queueNotification(config, changed ? "SHARED_DROPOFF_CHANGED" : "SHARED_DROPOFF_PROPOSED", booking.email, {
                ...journey,
                proposedSharedDropoffDisplayName: hub.displayName || hub.name,
            }, { bookingId: booking.id });
        }
        await writeAudit(changed ? "SHARED_DROPOFF_CHANGED" : "SHARED_DROPOFF_PROPOSED", actor, {
            journeyId,
            hubId: hub.hubId || hub.id,
        });
        return { ok: true, hubId: hub.hubId || hub.id, version: nextVersion, changed };
    }
    if (action === "destination-matching-summary") {
        const hubsSnap = await db().collection(defaults_1.COLLECTIONS.DROPOFF_HUBS).limit(200).get();
        const hubs = hubsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return { ok: true, summary: (0, destinationMatching_1.adminDestinationSummary)(journey, bookings, hubs) };
    }
    if (action === "release-booking") {
        const bookingId = String(payload.bookingId || "");
        const booking = bookings.find((row) => row.id === bookingId);
        if (!booking)
            throw new functions.https.HttpsError("not-found", "Booking not found.");
        const now = new Date().toISOString();
        const wasConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
        await db().runTransaction(async (tx) => {
            const live = await tx.get(journeyRef);
            const bookingRef = db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(bookingId);
            const liveBooking = await tx.get(bookingRef);
            if (!live.exists || !liveBooking.exists)
                return;
            const liveJourney = asJourney(live.id, live.data() || {});
            const allSnap = await tx.get(db().collection(defaults_1.COLLECTIONS.BOOKINGS).where("journeyId", "==", liveJourney.id));
            const remaining = allSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .map((row) => (row.id === bookingId ? { ...row, reservationStatus: "CANCELLED" } : row))
                .filter(hostedPayment_1.reservationHoldsSeat);
            tx.update(bookingRef, {
                reservationStatus: "CANCELLED",
                cancellationCategory: "OPERATOR",
                cancelledAt: now,
                refundStatus: Number(liveBooking.data()?.paidAmountPence || 0) > 0 ? "PENDING" : "NONE",
            });
            const occ = (0, hostedPayment_1.occupiedFromBookings)(remaining);
            tx.update(journeyRef, {
                occupiedSeats: occ,
                status: wasConfirmed
                    ? liveJourney.status
                    : (0, hostedPayment_1.journeyStatusFromOccupancy)(occ, liveJourney.capacity, "GATHERING_INTEREST", liveJourney.paymentStageStatus || "NOT_CREATED", (0, destinationMatching_1.matchingOccupancyContext)(liveJourney, remaining)),
                updatedAt: now,
            });
        });
        await writeAudit("PASSENGER_LEFT", actor, { journeyId, bookingId, category: "OPERATOR" });
        await offerNextWaitlist(config, journeyId);
        return { ok: true, journeyStillConfirmed: wasConfirmed };
    }
    throw new functions.https.HttpsError("invalid-argument", "Unknown admin action.");
});
function publicShareListPayload(config, journeys, interestGroups = []) {
    const defaults = config.pilotDefaults;
    const listed = journeys
        .filter((row) => (0, access_1.isCustomerListableJourney)(row, "customer"))
        .sort((a, b) => `${a.travelDate}T${a.departureTime}`.localeCompare(`${b.travelDate}T${b.departureTime}`))
        .map((row) => (0, logic_1.toPublicJourney)(row, config));
    const interest = interestGroups
        .filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")
        .sort((a, b) => `${a.travelDate}${a.timeWindowStart}`.localeCompare(`${b.travelDate}${b.timeWindowStart}`))
        .map(interestGroups_1.toPublicInterestGroup);
    return {
        available: true,
        publicEnabled: false,
        pilot: true,
        originLabel: defaults.originLabel,
        meetingPointName: defaults.departureLocation || config.meetingPoint.publicName,
        destinationLabel: defaults.destinationLabel,
        vehicleLabel: defaults.vehicleLabel,
        farePence: defaults.farePence,
        capacity: defaults.capacity,
        interestNotice: types_1.INTEREST_NOTICE,
        fillNotice: types_1.FILL_NOTICE,
        journeys: listed,
        interestGroups: interest,
    };
}
async function loadPublicInterestGroups() {
    const snap = await db().collection(defaults_1.COLLECTIONS.INTEREST_GROUPS).limit(200).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
exports.spiresSharePublicAccess = functions.https.onCall(async () => {
    const config = await loadConfig();
    const flags = currentFlags(config);
    if (!(0, access_1.publicSharePageAllowed)(flags))
        publicBlocked();
    const snap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).where("airportId", "==", config.pilotDefaults.airportId).limit(100).get();
    const journeys = snap.docs.map((doc) => asJourney(doc.id, doc.data()));
    return publicShareListPayload(config, journeys, await loadPublicInterestGroups());
});
const PUBLIC_LIST_ORIGINS = [
    "https://www.spires-taxis.com",
    "https://spires-taxis.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
];
exports.spiresSharePublicList = functions.https.onRequest(async (req, res) => {
    const origin = String(req.get("origin") || "");
    if (PUBLIC_LIST_ORIGINS.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
    }
    else {
        res.set("Access-Control-Allow-Origin", "https://www.spires-taxis.com");
    }
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.set("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ available: false, error: "Method not allowed." });
        return;
    }
    const config = await loadConfig();
    const flags = currentFlags(config);
    if (!(0, access_1.publicSharePageAllowed)(flags)) {
        res.status(404).json({ available: false });
        return;
    }
    const snap = await db().collection(defaults_1.COLLECTIONS.JOURNEYS).where("airportId", "==", config.pilotDefaults.airportId).limit(100).get();
    const journeys = snap.docs.map((doc) => asJourney(doc.id, doc.data()));
    res.status(200).json(publicShareListPayload(config, journeys, await loadPublicInterestGroups()));
});
async function runShareDeadlineTick() {
    const config = await loadConfig();
    const now = new Date().toISOString();
    const open = await db()
        .collection(defaults_1.COLLECTIONS.JOURNEYS)
        .where("status", "in", [
        "GATHERING_INTEREST",
        "READY_FOR_PAYMENT_SETUP",
        "PAYMENT_WINDOW_OPEN",
        "AWAITING_FINAL_PASSENGER",
        "FOUR_PASSENGER_OPTION",
        "SUPPLEMENT_PAYMENT",
        "PROPOSED",
        "FILLING",
        "ALMOST_FULL",
        "CONFIRMED",
        "AWAITING_DROPOFF_SELECTION",
        "AWAITING_DROPOFF_ACCEPTANCE",
    ])
        .get();
    let expired = 0;
    let waitlistExpired = 0;
    let reminders = 0;
    let unpaidExpired = 0;
    for (const doc of open.docs) {
        const journey = asJourney(doc.id, doc.data());
        const bookings = await loadBookingsForJourney(null, journey.id);
        for (const booking of bookings) {
            if (booking.reservationStatus === "PAYMENT_PENDING" && booking.paymentDeadlineAt && (0, timezone_1.isPast)(booking.paymentDeadlineAt, now)) {
                await db().runTransaction(async (tx) => {
                    const liveBooking = await tx.get(db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(booking.id));
                    const liveJourney = await tx.get(doc.ref);
                    if (!liveBooking.exists || !liveJourney.exists)
                        return;
                    const current = liveBooking.data();
                    if (current.reservationStatus !== "PAYMENT_PENDING")
                        return;
                    tx.update(liveBooking.ref, {
                        reservationStatus: "PAYMENT_EXPIRED",
                        hostedPaymentStatus: "EXPIRED",
                        paymentStatus: "HOSTED_EXPIRED",
                        paymentExpiredNotifiedAt: now,
                    });
                    const others = bookings
                        .map((row) => (row.id === booking.id ? { ...row, reservationStatus: "PAYMENT_EXPIRED" } : row))
                        .filter(hostedPayment_1.reservationHoldsSeat);
                    const occ = (0, hostedPayment_1.occupiedFromBookings)(others);
                    const liveData = liveJourney.data() || {};
                    const stillConfirmed = liveData.status === "CONFIRMED" || Boolean(liveData.locked);
                    const stage = stillConfirmed
                        ? liveData.paymentStageStatus || "OPEN"
                        : occ < config.earlyDepartureThreshold
                            ? "LINK_SAVED"
                            : liveData.paymentStageStatus || "OPEN";
                    tx.update(doc.ref, {
                        occupiedSeats: occ,
                        paymentStageStatus: stage,
                        status: stillConfirmed
                            ? liveData.status
                            : (0, hostedPayment_1.journeyStatusFromOccupancy)(occ, Number(liveData.capacity || 5), "GATHERING_INTEREST", stage),
                        updatedAt: now,
                    });
                });
                if (!booking.paymentExpiredNotifiedAt) {
                    await queueNotification(config, "PAYMENT_EXPIRED", booking.email, journey, { bookingId: booking.id });
                }
                await writeAudit("RESERVATION_EXPIRED", "system", { journeyId: journey.id, bookingId: booking.id });
                unpaidExpired += 1;
                await offerNextWaitlist(config, journey.id);
            }
            if (booking.reservationStatus === "PAYMENT_PENDING" &&
                booking.paymentDeadlineAt &&
                !booking.paymentReminderNotifiedAt &&
                new Date(booking.paymentDeadlineAt).getTime() - new Date(now).getTime() <= 30 * 60 * 1000 &&
                !(0, timezone_1.isPast)(booking.paymentDeadlineAt, now)) {
                await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(booking.id).set({ paymentReminderNotifiedAt: now }, { merge: true });
                await queueNotification(config, "PAYMENT_DEADLINE_APPROACHING", booking.email, journey, {
                    bookingId: booking.id,
                    paymentDeadlineAt: booking.paymentDeadlineAt,
                    amountPence: (0, hostedPayment_1.bookingAmountDuePence)(booking, journey.farePence),
                    passengers: booking.passengers,
                });
                reminders += 1;
            }
            if (journey.status === "CONFIRMED" && journey.departureAt && !booking.reminder24hNotifiedAt) {
                const reminderAt = (0, timezone_1.subtractHoursIso)(journey.departureAt, 24);
                if ((0, timezone_1.isPast)(reminderAt, now) && !(0, timezone_1.isPast)(journey.departureAt, now) && (0, hostedPayment_1.reservationHoldsSeat)(booking)) {
                    await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(booking.id).set({ reminder24hNotifiedAt: now }, { merge: true });
                    await queueNotification(config, "JOURNEY_REMINDER_24H", booking.email, journey, {
                        bookingId: booking.id,
                        terminalGuideUrl: (0, terminalGuide_1.isHeathrowShare)(journey) ? (0, terminalGuide_1.terminalGuideHref)((0, terminalGuide_1.flightTerminalOf)(booking)) : undefined,
                        terminalGuideLabel: (0, terminalGuide_1.isHeathrowShare)(journey) ? (0, terminalGuide_1.terminalGuideLinkText)((0, terminalGuide_1.flightTerminalOf)(booking)) : undefined,
                    });
                    reminders += 1;
                }
            }
            if (journey.status === "CONFIRMED" && journey.departureAt && !booking.departureReminderNotifiedAt) {
                const reminderAt = (0, timezone_1.subtractHoursIso)(journey.departureAt, 3);
                if ((0, timezone_1.isPast)(reminderAt, now) && !(0, timezone_1.isPast)(journey.departureAt, now) && (0, hostedPayment_1.reservationHoldsSeat)(booking)) {
                    await db().collection(defaults_1.COLLECTIONS.BOOKINGS).doc(booking.id).set({ departureReminderNotifiedAt: now }, { merge: true });
                    await queueNotification(config, "DEPARTURE_REMINDER", booking.email, journey, {
                        bookingId: booking.id,
                        terminalGuideUrl: (0, terminalGuide_1.isHeathrowShare)(journey) ? (0, terminalGuide_1.terminalGuideHref)((0, terminalGuide_1.flightTerminalOf)(booking)) : undefined,
                        terminalGuideLabel: (0, terminalGuide_1.isHeathrowShare)(journey) ? (0, terminalGuide_1.terminalGuideLinkText)((0, terminalGuide_1.flightTerminalOf)(booking)) : undefined,
                    });
                    reminders += 1;
                }
            }
        }
        if (["GATHERING_INTEREST", "PROPOSED", "FILLING", "READY_FOR_PAYMENT_SETUP"].includes(journey.status) &&
            journey.occupiedSeats < config.earlyDepartureThreshold &&
            (0, timezone_1.isPast)(journey.confirmationDeadlineAt, now)) {
            await doc.ref.update({ status: "EXPIRED", updatedAt: now });
            for (const booking of bookings.filter(hostedPayment_1.reservationHoldsSeat)) {
                await queueNotification(config, "JOURNEY_DID_NOT_FILL", booking.email, { ...journey, status: "EXPIRED" }, { bookingId: booking.id });
            }
            await writeAudit("JOURNEY_EXPIRED", "system", { journeyId: journey.id });
            expired += 1;
        }
    }
    const wait = await db().collection(defaults_1.COLLECTIONS.WAITLIST).where("status", "==", "OFFERED").get();
    const expiredJourneyIds = new Set();
    for (const doc of wait.docs) {
        const expires = String(doc.data()?.offerExpiresAt || "");
        if (expires && (0, timezone_1.isPast)(expires, now)) {
            const journeyId = String(doc.data()?.journeyId || "");
            await doc.ref.set({ status: "EXPIRED" }, { merge: true });
            if (journeyId) {
                await db().collection(defaults_1.COLLECTIONS.JOURNEYS).doc(journeyId).set({ waitlistOfferOutstanding: false, updatedAt: now }, { merge: true });
                expiredJourneyIds.add(journeyId);
            }
            waitlistExpired += 1;
            await writeAudit("WAITLIST_EXPIRED", "system", { waitlistId: doc.id });
        }
    }
    for (const journeyId of expiredJourneyIds) {
        await offerNextWaitlist(config, journeyId);
    }
    return { expired, waitlistExpired, reminders, unpaidExpired, publicEnabled: false };
}
exports.spiresShareRunTick = functions.https.onCall(async (_data, context) => {
    const config = await loadConfig();
    await assertShareAccess(context, config, "admin");
    return runShareDeadlineTick();
});
exports.scheduledSpiresShareTick = functions
    .pubsub.schedule("every 15 minutes")
    .timeZone("Europe/London")
    .onRun(async () => {
    await runShareDeadlineTick();
});
