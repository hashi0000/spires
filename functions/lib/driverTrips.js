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
exports.driverTripAction = exports.listDriverTrips = void 0;
exports.touchDriverJobVersions = touchDriverJobVersions;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const driverAccess_1 = require("./driverAccess");
const driverTripLogic_1 = require("./driverTripLogic");
const paymentAmount_1 = require("./paymentAmount");
const fareMath_1 = require("./quotes/fareMath");
const error = (code, message) => { throw new functions.https.HttpsError(code, message); };
const stamp = () => admin.firestore.FieldValue.serverTimestamp();
function serialise(value) {
    if (value?.toDate)
        return value.toDate().toISOString();
    if (Array.isArray(value))
        return value.map(serialise);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialise(entry)]));
    return value;
}
exports.listDriverTrips = functions.https.onCall(async (data, context) => {
    const driverId = await (0, driverAccess_1.requireDriver)(context);
    const db = admin.firestore();
    const versionSnap = await db.collection("driverJobVersions").doc(driverId).get();
    const version = Number(versionSnap.data()?.version || 0);
    if (data?.version != null && Number(data.version) === version)
        return { unchanged: true, version };
    const snapshots = await Promise.all(["driverId", "returnDriverId"].map(field => db.collection("bookings").where(field, "==", driverId).get()));
    const rows = new Map();
    const vehicleIds = new Set();
    snapshots.forEach(snap => snap.docs.forEach(doc => {
        const row = (0, driverTripLogic_1.driverBooking)(doc.data(), driverId, doc.id);
        rows.set(doc.id, serialise(row));
        [row.vehicleId, row.returnVehicleId].filter(Boolean).forEach(value => vehicleIds.add(value));
    }));
    const driver = (await db.collection("drivers").doc(driverId).get()).data() || {};
    const vehicles = await Promise.all([...vehicleIds].map(async (vehicleId) => {
        const vehicle = (await db.collection("vehicles").doc(vehicleId).get()).data() || {};
        return { id: vehicleId, registration: vehicle.registration || vehicle.registrationNumber || "", make: vehicle.make || "", model: vehicle.model || "" };
    }));
    return { driverId, bookings: [...rows.values()], drivers: [{ id: driverId, name: driver.name || "Driver" }], vehicles,
        version, truncated: false };
});
exports.driverTripAction = functions.https.onCall(async (data, context) => {
    const driverId = await (0, driverAccess_1.requireDriver)(context);
    const bookingId = String(data?.bookingId || "");
    const requestId = String(data?.requestId || "");
    const leg = data?.leg;
    if (!/^[\w-]{1,128}$/.test(bookingId) || !/^[\w-]{8,100}$/.test(requestId) || !["outbound", "return"].includes(leg))
        error("invalid-argument", "A booking, leg and request id are required.");
    const db = admin.firestore();
    const ref = db.collection("bookings").doc(bookingId);
    const actionRef = ref.collection("driverActions").doc(requestId);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = await tx.get(actionRef);
        const booking = serialise(snap.data() || {});
        if (!snap.exists || !(0, driverTripLogic_1.assignedLegs)(booking, driverId).includes(leg))
            error("permission-denied", "This trip is not assigned to you.");
        if (existing.exists) {
            if (existing.data()?.actorUid !== context.auth.uid)
                error("permission-denied", "This request belongs to another session.");
            return { duplicate: true, booking: (0, driverTripLogic_1.driverBooking)(booking, driverId, bookingId) };
        }
        if (Number(data.expectedRevision) !== Number(booking.revision || 0))
            error("aborted", "This booking changed. Reload before saving; your changes have not been applied.");
        if (booking.status === "cancelled" || booking[leg + "Status"] === "cancelled")
            error("failed-precondition", "This trip is cancelled.");
        if (booking.vehicleType === "executive" && booking.executiveAvailability !== "accepted")
            error("failed-precondition", "Executive availability has not been accepted.");
        const action = String(data.action || "");
        if (["finalise", "payment"].includes(action) && booking.paymentStatus === "paid" && Number(booking.amountReceivedPence || 0) === 0 && (0, paymentAmount_1.agreedFarePence)(booking) > 0)
            error("failed-precondition", "The office must review this older paid record before any further collection.");
        if (booking[leg + "ChargesFinalisedAt"] && action !== "payment")
            error("failed-precondition", "Charges are finalised. Ask the office to correct the timing record.");
        const patch = {};
        const timings = { driver_ready: leg + "DriverReadyAt", passenger_ready: leg + "PassengerReadyAt", onboard: leg + "PassengerOnboardAt", departed: leg + "DepartedAt" };
        const reason = String(data.reason || "").trim().slice(0, 300);
        if (timings[action] || action === "landing" || action === "complete") {
            const at = new Date(String(data.at || "")).getTime();
            if (!Number.isFinite(at) || at > Date.now() + 60000)
                error("invalid-argument", "Enter a valid event time, not a future time.");
            const value = new Date(at).toISOString();
            if (action === 'complete' && booking[leg + 'DriverReadyAt'] && at < Date.parse(booking[leg + 'DriverReadyAt']))
                error('invalid-argument', 'The finish time cannot be before the driver was ready.');
            if (timings[action]) {
                const field = timings[action];
                if (booking[field] && reason.length < 3)
                    error("failed-precondition", "A correction needs a reason.");
                patch[field] = value;
            }
            else if (action === "landing") {
                if (!(leg === "return" ? booking.returnAirportCollection : booking.airportCollection))
                    error("failed-precondition", "This is not an airport collection.");
                const prefix = leg === "return" ? "return" : "";
                const field = prefix ? "returnVerifiedLandingAt" : "verifiedLandingAt";
                if (booking[field] && reason.length < 3)
                    error("failed-precondition", "A landing correction needs a reason.");
                const source = String(data.source || "").trim().slice(0, 160);
                if (!source)
                    error("invalid-argument", "Record the source of the actual landing time.");
                patch[field] = value;
                patch[prefix ? "returnLandingStatus" : "landingStatus"] = "actual";
                patch[prefix ? "returnVerifiedLandingSource" : "verifiedLandingSource"] = source;
            }
            else {
                const prior = booking[leg + "Status"] || booking.status;
                if (!["confirmed", "allocated"].includes(prior))
                    error("failed-precondition", "Only a confirmed trip can be completed.");
                patch[leg + "Status"] = "completed";
                patch[leg + "CompletedAt"] = value;
                patch[leg + "CompletedByUid"] = context.auth.uid;
                const hasReturn = booking.bookingType === "return" || booking.returnTrip || booking.openReturn || booking.returnPickupTime || booking.returnDateTime;
                const other = leg === "return" ? "outbound" : "return";
                const otherStatus = booking[other + "Status"] || booking.status;
                const allDone = !hasReturn || ["completed", "cancelled"].includes(otherStatus);
                patch.status = allDone ? "completed" : "confirmed";
                patch.adminStatus = patch.status;
                patch.customerStatus = patch.status;
            }
        }
        else if (action === "finalise") {
            if (!booking[leg + "CompletedAt"])
                error("failed-precondition", "Record the finish time first.");
            if (!booking[leg + "DriverReadyAt"])
                error("failed-precondition", "Record when the driver was ready before calculating additional time.");
            const airport = leg === "return" ? booking.returnAirportCollection : booking.airportCollection;
            if (airport && !booking[leg + "PassengerReadyAt"])
                error("failed-precondition", "Record the customer's ready call or message time first.");
            const fixed = Boolean(booking.waitingPolicyVersion) && ((leg === "return" ? booking.returnCollectionArrangement : booking.collectionArrangement) === "fixed_time" || (leg === "return" ? booking.returnCollectionLocationKind : booking.collectionLocationKind) === 'hotel');
            if (airport && !fixed && (!(leg === "return" ? booking.returnVerifiedLandingAt : booking.verifiedLandingAt) || (leg === 'return' ? booking.returnLandingStatus : booking.landingStatus) !== 'actual'))
                error("failed-precondition", "Verify the actual landing time first.");
            const excluded = Number(data.excludedMinutes || 0);
            if (!Number.isFinite(excluded) || excluded < 0 || (excluded > 0 && reason.length < 3))
                error("invalid-argument", "Excluded delay needs valid minutes and a reason.");
            const chargeId = `trip-time-${leg}`;
            const charges = Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [];
            if (booking[leg + "ChargesFinalisedAt"] || charges.some((row) => row.id === chargeId))
                error("failed-precondition", "Time charges were already finalised. Ask the office to review corrections.");
            const pounds = (0, driverTripLogic_1.tripCharge)({ ...booking, [leg + "ExcludedMinutes"]: excluded }, leg);
            patch[leg + "ExcludedMinutes"] = excluded;
            patch[leg + "ChargesFinalisedAt"] = new Date().toISOString();
            patch.additionalCharges = charges.concat(pounds > 0 ? [{ id: chargeId, amountPence: Math.round(pounds * 100), leg, reason: `Additional ${booking.timedHire ? "hire time" : "airport waiting"} (${leg})`, at: new Date().toISOString() }] : []);
            const total = (0, paymentAmount_1.agreedFarePence)({ ...booking, ...patch });
            const position = (0, fareMath_1.paymentPosition)(total, Number(booking.amountReceivedPence || 0), "");
            patch.outstandingPence = position.outstandingPence;
            patch.paymentStatus = position.stored;
        }
        else if (action === "payment") {
            const timed = booking.timedHire || (leg === "return" ? booking.returnAirportCollection : booking.airportCollection);
            if (timed && !booking[leg + "ChargesFinalisedAt"])
                error("failed-precondition", "Finalise the trip time charges before recording the final payment.");
            const amount = Number(data.amountPence);
            const method = String(data.method || "");
            if (!Number.isSafeInteger(amount) || amount <= 0 || !["cash", "card", "bank transfer"].includes(method))
                error("invalid-argument", "Enter the payment amount and method.");
            const total = (0, paymentAmount_1.agreedFarePence)(booking);
            const received = Number(booking.amountReceivedPence || 0);
            if (!total || amount > Math.max(0, total - received))
                error("failed-precondition", "The payment exceeds the outstanding balance. Ask the office to review.");
            const position = (0, fareMath_1.paymentPosition)(total, received + amount, "");
            patch.amountReceivedPence = received + amount;
            patch.outstandingPence = position.outstandingPence;
            patch.paymentStatus = position.stored;
            patch.paymentMethod = method;
            patch.lastPaymentSource = "driver_hub";
            patch.paymentEntries = (booking.paymentEntries || []).concat([{ clientRequestId: requestId, leg, mode: "add", amountPence: amount, method, at: new Date().toISOString(), actorUid: context.auth.uid, note: "Recorded in Driver Hub", paidOn: new Date().toISOString().slice(0, 10), reason: "" }]);
            const recipient = booking.hirerEmail || booking.email;
            if (recipient)
                tx.create(db.collection("emailJobs").doc(`driver_receipt__${bookingId}__${requestId}`), {
                    bookingId, event: "payment_receipt", kind: "payment_receipt", version: requestId,
                    to: recipient, subject: "Your Spires Taxis payment receipt", html: "", status: "queued", queuedAt: stamp(),
                });
        }
        else
            error("invalid-argument", "Unknown trip action.");
        patch.revision = Number(booking.revision || 0) + 1;
        patch.updatedAt = stamp();
        tx.update(ref, patch);
        tx.create(actionRef, { actorUid: context.auth.uid, driverId, action, leg, at: stamp(), reason });
        tx.create(ref.collection("audit").doc(), { actorUid: context.auth.uid, driverId, action: `driver_${action}`, leg, eventAt: data.at || null, reason, at: stamp() });
        const result = { ...booking, ...patch };
        delete result.updatedAt;
        return { booking: (0, driverTripLogic_1.driverBooking)(result, driverId, bookingId) };
    });
});
/** Invalidate each affected driver's private list without repeatedly reading every booking. */
async function touchDriverJobVersions(before, after) {
    const ids = new Set([before?.driverId, before?.returnDriverId, after.driverId, after.returnDriverId].filter(value => typeof value === 'string' && value && !value.includes('/')));
    await Promise.all([...ids].map(driverId => admin.firestore().collection('driverJobVersions').doc(driverId).set({ version: admin.firestore.FieldValue.increment(1), updatedAt: stamp() }, { merge: true })));
}
