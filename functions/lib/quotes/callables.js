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
exports.EMAIL_SETUP_MESSAGE = exports.submitWebsiteQuote = exports.quotePublic = exports.resendQuoteEmail = exports.retryEmailJob = exports.acceptQuote = exports.recordManualAcceptance = exports.recordManualPayment = exports.sendPaymentRequest = exports.savePaymentLink = exports.issueQuote = exports.saveQuoteDraft = exports.processEmailJob = exports.shouldSendConfirmation = exports.bookingMatchesStatusFilter = void 0;
exports.enqueueConfirmationIfNeeded = enqueueConfirmationIfNeeded;
exports.stampPromotionOnCreate = stampPromotionOnCreate;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const driverReminderEmail_1 = require("../driverReminderEmail");
const sendBookingReceipt_1 = require("../sendBookingReceipt");
const emails_1 = require("./emails");
const halfTerm_1 = require("./halfTerm");
const bookingTerms_1 = require("../terms/bookingTerms");
const paymentLink_1 = require("./paymentLink");
const quoteWorkflow_1 = require("./quoteWorkflow");
Object.defineProperty(exports, "bookingMatchesStatusFilter", { enumerable: true, get: function () { return quoteWorkflow_1.bookingMatchesStatusFilter; } });
Object.defineProperty(exports, "shouldSendConfirmation", { enumerable: true, get: function () { return quoteWorkflow_1.shouldSendConfirmation; } });
const db = () => admin.firestore();
function allowlist() {
    let extra = process.env.PAYMENT_LINK_HOST_ALLOWLIST || "";
    try {
        const configured = functions.config().payments?.hosts;
        if (!extra && configured)
            extra = String(configured);
    }
    catch {
        /* config is unavailable outside the functions runtime */
    }
    return (0, paymentLink_1.paymentLinkAllowlist)(extra);
}
function httpsError(code, message) {
    return new functions.https.HttpsError(code, message);
}
function requireAdmin(context) {
    if (!context.auth)
        throw httpsError("unauthenticated", "Sign in required.");
    const email = String(context.auth.token.email || "");
    if (!(0, quoteWorkflow_1.isQuoteAdmin)(email))
        throw httpsError("permission-denied", "Admin access required.");
    return email.trim().toLowerCase();
}
async function audit(bookingId, action, actorEmail, extra = {}) {
    await db().collection("bookings").doc(bookingId).collection("audit").add({
        action,
        actorEmail,
        at: admin.firestore.FieldValue.serverTimestamp(),
        ...extra,
    });
}
function str(value) {
    return typeof value === "string" ? value.trim() : "";
}
/** Office copies, not a hidden copy to the sending mailbox. */
function quoteCopyRecipients(actor, customerTo) {
    const customer = customerTo.trim().toLowerCase();
    const recipients = new Set();
    const actorEmail = actor.trim().toLowerCase();
    if (actorEmail.includes("@") && actorEmail !== customer)
        recipients.add(actorEmail);
    const office = driverReminderEmail_1.ADMIN_EMAIL.toLowerCase();
    if (office !== customer)
        recipients.add(office);
    return Array.from(recipients);
}
function journeyFrom(data) {
    return {
        source: str(data.source),
        bookingType: str(data.bookingType),
        returnTrip: data.returnTrip === true,
        pickup: str(data.pickup),
        pickupLocation: str(data.pickupLocation),
        destination: str(data.destination),
        returnPickupLocation: str(data.returnPickupLocation),
        returnDestination: str(data.returnDestination),
        airportCollection: data.airportCollection === true,
        returnAirportCollection: data.returnAirportCollection === true,
        vehicleType: str(data.vehicleType),
        otherOfferCode: str(data.otherOfferCode),
        service: str(data.service),
    };
}
function customerEmail(data) {
    return str(data.hirerEmail) || str(data.email);
}
function customerName(data) {
    return str(data.hirerName) || str(data.name) || "Customer";
}
function finalFarePence(data) {
    const quote = data.issuedQuote && typeof data.issuedQuote === "object" ? data.issuedQuote : null;
    if (quote && Number.isFinite(Number(quote.finalFarePence)))
        return Number(quote.finalFarePence);
    const fare = Number(data.actualFare);
    return Number.isFinite(fare) ? Math.round(fare * 100) : 0;
}
async function enqueueJob(input) {
    const mode = input.mode || "auto";
    const jobId = (0, quoteWorkflow_1.emailJobDocId)(input.bookingId, input.event, input.version, input.resend || 0);
    const ref = db().collection("emailJobs").doc(jobId);
    return db().runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        const decision = (0, quoteWorkflow_1.emailEnqueueDecision)(existing.exists ? existing.data() || {} : null, mode);
        if (decision === "skip")
            return { jobId, state: "skipped" };
        const payload = {
            bookingId: input.bookingId, event: input.event, version: input.version,
            kind: input.kind, to: input.to, subject: input.subject, html: input.html,
            copyTo: input.copyTo || [], status: "queued",
            queuedAt: admin.firestore.FieldValue.serverTimestamp(), error: admin.firestore.FieldValue.delete(),
        };
        tx.set(ref, payload, { merge: true });
        return { jobId, state: decision === "requeue" ? "requeued" : "queued" };
    });
}
exports.processEmailJob = functions.firestore.document("emailJobs/{jobId}").onWrite(async (change) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after || after.status !== "queued")
        return;
    const ref = change.after.ref;
    const claimed = await db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.data()?.status !== "queued")
            return false;
        tx.update(ref, { status: "sending", sendingAt: admin.firestore.FieldValue.serverTimestamp() });
        return true;
    });
    if (!claimed)
        return;
    try {
        const currentSnap = await db().collection("bookings").doc(String(after.bookingId)).get();
        const current = currentSnap.data() || {};
        const versionedMessage = ["quote", "acceptance_customer", "acceptance_admin"].includes(after.kind);
        const staleQuote = versionedMessage && Number(after.version) !== Number(current.quoteIssuedVersion);
        const staleWaiting = after.event === "acceptance_waiting" && current.quoteAcceptanceSubstatus !== "awaiting_payment";
        const staleConfirmation = after.kind === "booking_confirmed" && !["confirmed", "allocated", "completed", "paid"].includes(current.status || current.adminStatus || current.customerStatus);
        if (!currentSnap.exists || (current.status === "cancelled" && after.kind !== "payment_receipt") || staleQuote || staleWaiting || staleConfirmation) {
            await ref.set({ status: "skipped", skipReason: "Booking removed, cancelled or quote replaced." }, { merge: true });
            return;
        }
        if (after.kind === "booking_confirmed" || after.kind === "payment_receipt") {
            const bookingSnap = await db().collection("bookings").doc(String(after.bookingId)).get();
            if (!bookingSnap.exists)
                throw new Error("Booking no longer exists.");
            await (0, sendBookingReceipt_1.sendBookingReceipt)(bookingSnap.data(), after.kind === "payment_receipt" ? "payment" : "confirmation", String(after.bookingId), { throwOnError: true });
            await ref.set({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp(), providerAccepted: true }, { merge: true });
            const stamp = after.kind === "payment_receipt"
                ? { paymentReceiptEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), paymentReceiptEmailStatus: "sent" }
                : { confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), confirmationEmailStatus: "sent" };
            await bookingSnap.ref.set(stamp, { merge: true });
            return;
        }
        const copyTo = Array.isArray(after.copyTo)
            ? after.copyTo.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
        const info = await (0, emails_1.sendHtmlEmail)({
            to: String(after.to || ""),
            subject: String(after.subject || "Spires Taxis"),
            html: String(after.html || ""),
            bccAdmin: after.kind !== "acceptance_admin" && copyTo.length === 0,
        });
        if (after.kind === "quote") {
            const note = `<p style="font-family:Georgia,serif;color:#1a2332;">This copy confirms the quote was sent to ${(0, driverReminderEmail_1.escapeHtml)(String(after.to || ""))}.</p>`;
            for (const copy of copyTo) {
                try {
                    await (0, emails_1.sendHtmlEmail)({
                        to: copy,
                        subject: `Copy: ${String(after.subject || "Spires Taxis quote")} sent to ${String(after.to || "")}`,
                        html: note + String(after.html || ""),
                        bccAdmin: false,
                    });
                }
                catch (copyErr) {
                    const copyMessage = copyErr instanceof Error ? copyErr.message : "Quote copy failed";
                    functions.logger.error("quote copy failed", { to: copy, message: copyMessage });
                }
            }
        }
        await ref.set({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            providerAccepted: true,
            providerMessageId: info.messageId || "",
        }, { merge: true });
        if (after.kind === "payment_request") {
            await db().collection("bookings").doc(String(after.bookingId)).set({
                paymentLinkEmailStatus: "sent",
                emailError: admin.firestore.FieldValue.delete(),
                paymentLinkSentAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        if (after.kind === "quote") {
            await db().collection("bookings").doc(String(after.bookingId)).set({ quoteEmailStatus: "sent", quoteEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), emailError: admin.firestore.FieldValue.delete() }, { merge: true });
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Email failed";
        functions.logger.error("email job failed", { jobId: change.after.id, bookingId: after.bookingId, message });
        await ref.set({ status: "failed", failedAt: admin.firestore.FieldValue.serverTimestamp(), error: message.slice(0, 500) }, { merge: true });
        if (["quote", "payment_request", "booking_confirmed", "payment_receipt"].includes(after.kind)) {
            const fields = { quote: "quoteEmailStatus", payment_request: "paymentLinkEmailStatus", booking_confirmed: "confirmationEmailStatus", payment_receipt: "paymentReceiptEmailStatus" };
            const field = fields[after.kind];
            await db()
                .collection("bookings")
                .doc(String(after.bookingId))
                .set({ [field]: "failed", emailError: message.slice(0, 300) }, { merge: true });
        }
    }
});
async function enqueueConfirmationIfNeeded(before, after, bookingId) {
    if (!(0, quoteWorkflow_1.shouldSendConfirmation)(before, after))
        return;
    const to = customerEmail(after);
    if (!to)
        return;
    await enqueueJob({
        bookingId,
        event: "booking_confirmed",
        version: "1",
        to,
        subject: `Your Spires Taxis booking is confirmed`,
        html: "",
        kind: "booking_confirmed",
    });
}
function quoteModel(data, token) {
    const quote = (data.issuedQuote || {});
    const paymentUrl = str(data.paymentLinkUrl);
    let safePay = "";
    if (paymentUrl && data.paymentStatus !== "paid") {
        try {
            safePay = (0, paymentLink_1.validatePaymentLinkUrl)(paymentUrl, allowlist());
        }
        catch {
            safePay = "";
        }
    }
    const requirement = str(quote.paymentRequirement) === "advance" ? "advance" : "later";
    return {
        bookingNumber: str(data.bookingNumber) || "Quote",
        customerName: customerName(data),
        vehicleLabel: (0, emails_1.vehicleLabel)(str(quote.vehicleType) || str(data.vehicleType)),
        outbound: `${str(quote.pickup) || str(data.pickupLocation) || str(data.pickup)} to ${str(quote.destination) || str(data.destination)} at ${str(quote.dateTime) || str(data.dateTime) || str(data.pickupTime)}`,
        returnLeg: str(quote.bookingType) === "return" || data.bookingType === "return"
            ? `${str(quote.returnPickupLocation) || str(data.returnPickupLocation)} to ${str(quote.returnDestination) || str(data.returnDestination)} at ${str(quote.returnPickupTime) || str(data.returnPickupTime)}`
            : "",
        normalFare: (0, emails_1.moneyOrZero)(Number(quote.normalFarePence) || 0),
        discount: (0, emails_1.moneyOrZero)(Number(quote.discountPence) || 0),
        finalFare: (0, emails_1.moneyOrZero)(Number(quote.finalFarePence) || 0),
        validUntil: str(quote.validUntil),
        paymentRequirement: requirement,
        paymentDescription: str(quote.paymentDescription) === "deposit" ? "Deposit" : "Full payment",
        amountRequested: (0, emails_1.moneyOrZero)(Number(quote.amountRequestedPence) || Number(quote.finalFarePence) || 0),
        quoteUrl: `${emails_1.QUOTE_PAGE_ORIGIN}?t=${encodeURIComponent(token)}`,
        paymentUrl: safePay,
        terms: str(quote.terms),
    };
}
function readQuoteInput(data, booking) {
    const normalFarePence = (0, halfTerm_1.poundsToPence)(String(data.normalFarePounds ?? ""));
    const bookingType = str(data.bookingType) || str(booking.bookingType);
    const merged = {
        ...journeyFrom(booking),
        bookingType,
        returnTrip: bookingType === "return",
        pickup: str(data.pickup) || str(booking.pickup),
        pickupLocation: str(data.pickup) || str(booking.pickupLocation),
        destination: str(data.destination) || str(booking.destination),
        returnPickupLocation: str(data.returnPickupLocation) || str(booking.returnPickupLocation),
        returnDestination: str(data.returnDestination) || str(booking.returnDestination),
        vehicleType: str(data.vehicleType) || str(booking.vehicleType),
        airportCollection: data.airportCollection === true || booking.airportCollection === true,
        returnAirportCollection: data.returnAirportCollection === true || booking.returnAirportCollection === true,
        service: str(booking.service),
        source: str(booking.source),
        otherOfferCode: str(booking.otherOfferCode),
    };
    const promotion = (booking.promotion || {});
    const totals = (0, halfTerm_1.quoteTotals)({
        normalFarePence,
        promotionEligible: promotion.eligible === true,
        stillQualifyingReturn: (0, halfTerm_1.qualifyingReturnNow)(merged),
    });
    const paymentRequirement = str(data.paymentRequirement) === "advance" ? "advance" : "later";
    const paymentDescription = str(data.paymentDescription) === "deposit" ? "deposit" : "full";
    let amountRequestedPence = totals.finalFarePence;
    if (str(data.amountRequestedPounds))
        amountRequestedPence = (0, halfTerm_1.poundsToPence)(String(data.amountRequestedPounds));
    if (paymentDescription === "full")
        amountRequestedPence = totals.finalFarePence;
    if (paymentRequirement === "advance" && (amountRequestedPence <= 0 || amountRequestedPence > totals.finalFarePence)) {
        throw httpsError("invalid-argument", "The advance payment must be greater than zero and no more than the total fare.");
    }
    if (str(data.validUntil) && !Number.isFinite(Date.parse(str(data.validUntil)))) {
        throw httpsError("invalid-argument", "Enter a valid quote expiry date and time.");
    }
    let paymentLinkUrl = "";
    if (str(data.paymentLinkUrl))
        paymentLinkUrl = (0, paymentLink_1.validatePaymentLinkUrl)(str(data.paymentLinkUrl), allowlist());
    const validUntil = str(data.validUntil);
    const terms = str(data.terms) ||
        (totals.discountPence > 0
            ? "This quote is not a confirmed booking. The half term offer is £5 off this complete airport return and is not combined with other offers. One way bookings are not discounted. The journeys are subject to availability."
            : "This quote is not a confirmed booking. The journeys are subject to availability.");
    return { merged, totals, paymentRequirement, paymentDescription, amountRequestedPence, paymentLinkUrl, validUntil, terms };
}
function journeyPatch(input, raw, booking) {
    const bookingType = input.merged.bookingType === "return" ? "return" : "one_way";
    return {
        bookingType,
        returnTrip: bookingType === "return",
        pickup: str(raw.pickup) || str(input.merged.pickup),
        pickupLocation: str(raw.pickup) || str(input.merged.pickupLocation),
        destination: str(raw.destination) || str(input.merged.destination),
        dateTime: str(raw.dateTime),
        pickupTime: str(raw.dateTime),
        returnPickupTime: bookingType === "return" ? str(raw.returnPickupTime) : "",
        returnPickupLocation: bookingType === "return" ? str(raw.returnPickupLocation) : "",
        returnDestination: bookingType === "return" ? str(raw.returnDestination) : "",
        returnDateTime: bookingType === "return" ? str(raw.returnPickupTime) : "",
        vehicleType: str(raw.vehicleType) || str(input.merged.vehicleType),
        flightNumber: str(raw.flightNumber ?? booking.flightNumber),
        returnFlightNumber: bookingType === "return" ? str(raw.returnFlightNumber ?? booking.returnFlightNumber) : "",
        airportCollection: raw.airportCollection === undefined ? booking.airportCollection === true : raw.airportCollection === true,
        returnAirportCollection: bookingType === "return" && (raw.returnAirportCollection === undefined ? booking.returnAirportCollection === true : raw.returnAirportCollection === true),
        passengers: Number(raw.passengers) || undefined,
    };
}
function quoteInputError(err) {
    if (err instanceof functions.https.HttpsError)
        throw err;
    const message = err instanceof Error && err.message ? err.message : "Could not save the quote.";
    throw httpsError("invalid-argument", message);
}
async function saveDraftOrIssue(data, context, issue) {
    const actor = requireAdmin(context);
    const bookingId = str(data.bookingId);
    if (!bookingId)
        throw httpsError("invalid-argument", "bookingId is required.");
    const ref = db().collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists)
        throw httpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    let parsed;
    try {
        const fare = str(data.normalFarePounds) || String(booking.actualFare ?? "").trim();
        parsed = readQuoteInput({ ...data, normalFarePounds: fare }, booking);
    }
    catch (err) {
        quoteInputError(err);
    }
    const patch = journeyPatch(parsed, data, booking);
    const draft = {
        ...parsed.totals,
        ...patch,
        paymentRequirement: parsed.paymentRequirement,
        paymentDescription: parsed.paymentDescription,
        amountRequestedPence: parsed.amountRequestedPence,
        paymentLinkUrl: parsed.paymentLinkUrl,
        validUntil: parsed.validUntil,
        terms: parsed.terms,
        updatedAt: new Date().toISOString(),
    };
    if (!issue) {
        await ref.set({ quoteDraft: draft, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await audit(bookingId, "quote_draft_saved", actor, { finalFarePence: parsed.totals.finalFarePence });
        return { ok: true, emailed: false, ...parsed.totals, formatted: {
                normal: (0, halfTerm_1.formatPence)(parsed.totals.normalFarePence),
                discount: (0, halfTerm_1.formatPence)(parsed.totals.discountPence),
                final: (0, halfTerm_1.formatPence)(parsed.totals.finalFarePence),
            } };
    }
    const gate = (0, quoteWorkflow_1.canIssueQuote)(str(booking.status), data.reissue === true);
    if (!gate.ok)
        throw httpsError("failed-precondition", gate.reason || "Quote cannot be issued.");
    const version = Number(booking.quoteIssuedVersion || 0) + 1;
    const token = (0, emails_1.newQuoteToken)();
    const issuedQuote = { ...draft, version, issuedAt: new Date().toISOString() };
    const quotes = Array.isArray(booking.quotes) ? booking.quotes.slice(-19) : [];
    quotes.push(issuedQuote);
    const buckets = (0, quoteWorkflow_1.paymentBuckets)({
        finalFarePence: parsed.totals.finalFarePence,
        amountReceivedPence: Number(booking.amountReceivedPence) || 0,
        paymentRequirement: parsed.paymentRequirement,
        hasPaymentLink: Boolean(parsed.paymentLinkUrl || booking.paymentLinkUrl),
    });
    await db().runTransaction(async (tx) => {
        const latest = await tx.get(ref);
        if (!latest.exists || !latest.updateTime?.isEqual(snap.updateTime)) {
            throw httpsError("aborted", "This booking changed while you were preparing the quote. Review the latest booking and try again.");
        }
        tx.set(ref, {
            ...patch,
            quoteDraft: draft,
            issuedQuote,
            quotes,
            quoteIssuedVersion: version,
            quoteAcceptedVersion: admin.firestore.FieldValue.delete(),
            quoteAcceptedAt: admin.firestore.FieldValue.delete(),
            quoteAcceptanceSubstatus: admin.firestore.FieldValue.delete(),
            quoteAcceptedBy: admin.firestore.FieldValue.delete(),
            status: "awaiting_customer_confirmation",
            customerStatus: "awaiting_customer_confirmation",
            adminStatus: "awaiting_customer_confirmation",
            actualFare: parsed.totals.finalFarePence / 100,
            normalFarePence: parsed.totals.normalFarePence,
            discountPence: parsed.totals.discountPence,
            finalFarePence: parsed.totals.finalFarePence,
            paymentRequirement: parsed.paymentRequirement,
            paymentDescription: parsed.paymentDescription,
            amountRequestedPence: parsed.amountRequestedPence,
            outstandingPence: buckets.outstandingPence,
            paymentVerified: Number(booking.amountReceivedPence || 0) >= parsed.amountRequestedPence && parsed.amountRequestedPence > 0,
            depositRequired: parsed.paymentRequirement === "advance" && parsed.paymentDescription === "deposit",
            depositAmount: parsed.paymentDescription === "deposit" ? parsed.amountRequestedPence / 100 : 0,
            depositStatus: parsed.paymentDescription === "deposit" && parsed.paymentRequirement === "advance"
                ? (Number(booking.amountReceivedPence || 0) >= parsed.amountRequestedPence ? "paid" : "pending") : "not_required",
            paymentLinkUrl: parsed.paymentLinkUrl || str(booking.paymentLinkUrl) || admin.firestore.FieldValue.delete(),
            paymentStatus: buckets.stored,
            quoteEmailStatus: "queued",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const expiresAt = parsed.validUntil ? new Date(parsed.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        tx.set(db().collection("quoteTokens").doc(token.hash), {
            bookingId,
            version,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    const fresh = { ...booking, ...patch, issuedQuote, bookingNumber: booking.bookingNumber, paymentLinkUrl: parsed.paymentLinkUrl || booking.paymentLinkUrl, paymentStatus: buckets.stored };
    const model = quoteModel(fresh, token.token);
    const to = customerEmail(booking);
    let emailState = "skipped";
    if (!to) {
        emailState = "failed";
        await ref.set({ quoteEmailStatus: "failed", emailError: "No customer email on the booking." }, { merge: true });
    }
    else {
        try {
            const queued = await enqueueJob({
                bookingId,
                event: "quote",
                version: String(version),
                to,
                subject: `Your Spires Taxis quote ${model.bookingNumber}`,
                html: (0, emails_1.quoteEmailHtml)(model),
                kind: "quote",
                copyTo: quoteCopyRecipients(actor, to),
            });
            emailState = queued.state === "skipped" ? "skipped" : "queued";
        }
        catch (err) {
            emailState = "failed";
            await ref.set({ quoteEmailStatus: "failed", emailError: err instanceof Error ? err.message : "Could not queue email" }, { merge: true });
        }
    }
    await audit(bookingId, "quote_issued", actor, { version, discountPence: parsed.totals.discountPence, emailState });
    return {
        ok: true,
        version,
        emailState,
        ...parsed.totals,
        formatted: {
            normal: (0, halfTerm_1.formatPence)(parsed.totals.normalFarePence),
            discount: (0, halfTerm_1.formatPence)(parsed.totals.discountPence),
            final: (0, halfTerm_1.formatPence)(parsed.totals.finalFarePence),
        },
    };
}
exports.saveQuoteDraft = functions.https.onCall(async (data, context) => {
    return saveDraftOrIssue((data || {}), context, false);
});
exports.issueQuote = functions.https.onCall(async (data, context) => {
    return saveDraftOrIssue((data || {}), context, true);
});
exports.savePaymentLink = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const body = (data || {});
    const bookingId = str(body.bookingId);
    if (!bookingId)
        throw httpsError("invalid-argument", "bookingId is required.");
    const ref = db().collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists)
        throw httpsError("not-found", "Booking not found.");
    const clear = body.clear === true || !str(body.paymentLinkUrl);
    let paymentLinkUrl = "";
    let amountRequestedPence = 0;
    try {
        if (!clear)
            paymentLinkUrl = (0, paymentLink_1.validatePaymentLinkUrl)(str(body.paymentLinkUrl), allowlist());
        amountRequestedPence = str(body.amountRequestedPounds) ? (0, halfTerm_1.poundsToPence)(String(body.amountRequestedPounds)) : Number(snap.data()?.amountRequestedPence) || finalFarePence(snap.data() || {});
        if (!clear && (amountRequestedPence <= 0 || amountRequestedPence > finalFarePence(snap.data() || {}))) {
            throw new Error("The amount requested must be greater than zero and no more than the total fare.");
        }
    }
    catch (err) {
        quoteInputError(err);
    }
    const paymentDescription = str(body.paymentDescription) === "deposit" ? "deposit" : "full";
    await ref.set({
        paymentLinkUrl: clear ? admin.firestore.FieldValue.delete() : paymentLinkUrl,
        amountRequestedPence,
        paymentDescription,
        paymentLinkUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await audit(bookingId, clear ? "payment_link_removed" : "payment_link_saved", actor, {
        amountRequestedPence,
        paymentDescription,
    });
    return { ok: true, saved: !clear };
});
exports.sendPaymentRequest = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const bookingId = str(data?.bookingId);
    const ref = db().collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists)
        throw httpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    let url;
    try {
        url = (0, paymentLink_1.validatePaymentLinkUrl)(str(booking.paymentLinkUrl), allowlist());
    }
    catch (err) {
        quoteInputError(err);
    }
    const to = customerEmail(booking);
    if (!to)
        throw httpsError("failed-precondition", "This booking has no customer email.");
    const amount = Number(booking.amountRequestedPence) || finalFarePence(booking);
    const description = str(booking.paymentDescription) === "deposit" ? "Deposit" : "Full payment";
    const confirmed = str(booking.status) === "confirmed" || str(booking.adminStatus) === "confirmed";
    const version = String(booking.paymentLinkUpdatedAt?.toMillis?.() || booking.quoteIssuedVersion || Date.now());
    await ref.set({ paymentLinkEmailStatus: "queued" }, { merge: true });
    const queued = await enqueueJob({
        bookingId,
        event: "payment_request",
        version,
        to,
        subject: `Payment request for Spires Taxis booking ${str(booking.bookingNumber)}`,
        html: (0, emails_1.paymentRequestHtml)({
            bookingNumber: str(booking.bookingNumber),
            customerName: customerName(booking),
            amount: (0, halfTerm_1.formatPence)(amount),
            description,
            paymentUrl: url,
            bookingUrl: emails_1.QUOTE_PAGE_ORIGIN,
            confirmed,
        }),
        kind: "payment_request",
    });
    await audit(bookingId, "payment_request_queued", actor, { emailState: queued.state });
    return { ok: true, emailState: queued.state };
});
exports.recordManualPayment = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const body = (data || {});
    const bookingId = str(body.bookingId);
    if (!bookingId || bookingId.includes("/"))
        throw httpsError("invalid-argument", "A booking ID is required.");
    let amountReceivedPence;
    try {
        amountReceivedPence = (0, halfTerm_1.poundsToPence)(String(body.amountReceivedPounds ?? ""));
    }
    catch {
        throw httpsError("invalid-argument", "Enter the total received so far in pounds and pence.");
    }
    const method = str(body.method) || "bank transfer";
    const ref = db().collection("bookings").doc(bookingId);
    const auditRef = ref.collection("audit").doc();
    return db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw httpsError("not-found", "Booking not found.");
        const booking = snap.data() || {};
        if (booking.status === "cancelled")
            throw httpsError("failed-precondition", "This booking is cancelled. Review its payments before making changes.");
        if (finalFarePence(booking) <= 0)
            throw httpsError("failed-precondition", "Set the fare before recording payment.");
        const buckets = (0, quoteWorkflow_1.paymentBuckets)({
            finalFarePence: finalFarePence(booking), amountReceivedPence,
            paymentRequirement: str(booking.paymentRequirement),
            substatus: str(booking.quoteAcceptanceSubstatus), hasPaymentLink: Boolean(booking.paymentLinkUrl),
        });
        const required = Number(booking.issuedQuote?.amountRequestedPence) || Number(booking.amountRequestedPence) || finalFarePence(booking);
        const paymentVerified = amountReceivedPence >= required && required > 0;
        const move = (0, quoteWorkflow_1.shouldMoveToConfirmedAfterPayment)({
            acceptedVersion: Number(booking.quoteAcceptedVersion) || null,
            issuedVersion: Number(booking.quoteIssuedVersion) || null,
            paymentVerified, status: str(booking.status),
        });
        const patch = {
            amountReceivedPence, outstandingPence: buckets.outstandingPence,
            paymentMethod: method, paymentStatus: buckets.stored, paymentVerified,
            depositStatus: booking.depositRequired ? (paymentVerified ? "paid" : "pending") : (booking.depositStatus || "not_required"),
            paymentRecordedAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentRecordedBy: actor, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            paidAt: buckets.stored === "paid" ? (booking.paidAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.delete(),
        };
        if (move) {
            patch.status = "confirmed";
            patch.customerStatus = "confirmed";
            patch.adminStatus = "confirmed";
            patch.quoteAcceptanceSubstatus = admin.firestore.FieldValue.delete();
        }
        // Cumulative total, not an additional charge. Repeating the same record never adds money twice.
        if (Number(booking.amountReceivedPence || 0) !== amountReceivedPence || booking.paymentMethod !== method || move) {
            tx.set(ref, patch, { merge: true });
            tx.set(auditRef, {
                action: "payment_recorded", actorEmail: actor, at: admin.firestore.FieldValue.serverTimestamp(),
                previousAmountReceivedPence: Number(booking.amountReceivedPence || 0), amountReceivedPence,
                outstandingPence: buckets.outstandingPence, method, paymentStatus: buckets.stored, movedToConfirmed: move,
            });
        }
        return { ok: true, label: buckets.label, paymentStatus: buckets.stored, confirmed: move };
    });
});
exports.recordManualAcceptance = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const bookingId = str(data?.bookingId);
    const ref = db().collection("bookings").doc(bookingId);
    const result = await applyAcceptance(ref, {
        authorised: true,
        actor: actor,
        onBehalf: true,
    });
    return result;
});
async function applyAcceptance(ref, input) {
    const outcome = await db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw httpsError("not-found", "Booking not found.");
        const booking = snap.data() || {};
        const issued = Number(booking.quoteIssuedVersion) || 0;
        const requested = input.version || issued;
        const issuedQuote = (booking.issuedQuote || {});
        const validUntil = str(issuedQuote.validUntil);
        const decision = (0, quoteWorkflow_1.decideAcceptance)({
            status: str(booking.status),
            customerStatus: str(booking.customerStatus),
            quoteIssuedVersion: issued,
            quoteAcceptedVersion: Number(booking.quoteAcceptedVersion) || null,
            validUntilMs: validUntil ? new Date(validUntil).getTime() : null,
            nowMs: Date.now(),
            requestedVersion: requested,
            paymentRequirement: str(issuedQuote.paymentRequirement || booking.paymentRequirement),
            authorised: input.authorised,
            advancePaymentSatisfied: Number(booking.amountReceivedPence || 0) >= (Number(issuedQuote.amountRequestedPence) || Number(booking.amountRequestedPence) || finalFarePence(booking)) && (Number(issuedQuote.amountRequestedPence) || Number(booking.amountRequestedPence) || finalFarePence(booking)) > 0,
        });
        if (!decision.ok) {
            const messages = {
                forbidden: "You cannot accept this quote.",
                cancelled: "This quote has been cancelled.",
                not_issued: "There is no quote to accept yet.",
                stale: "This quote has been replaced. Open the latest quote email.",
                expired: "This quote has expired.",
            };
            throw httpsError("failed-precondition", messages[decision.code]);
        }
        let mail = null;
        if (!decision.already || (decision.nextStatus === "confirmed" && !["confirmed", "allocated", "completed"].includes(str(booking.status)))) {
            const patch = {
                quoteAcceptedVersion: issued,
                quoteAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
                quoteAcceptedBy: input.onBehalf ? `admin:${input.actor}` : input.actor || "customer",
                status: decision.nextStatus,
                customerStatus: decision.nextStatus,
                adminStatus: decision.nextStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (decision.substatus)
                patch.quoteAcceptanceSubstatus = decision.substatus;
            else
                patch.quoteAcceptanceSubstatus = admin.firestore.FieldValue.delete();
            tx.set(ref, patch, { merge: true });
            mail = {
                to: customerEmail(booking),
                confirmed: decision.nextStatus === "confirmed",
                bookingNumber: str(booking.bookingNumber),
                name: customerName(booking),
                final: (0, halfTerm_1.formatPence)(finalFarePence(booking)),
                bookingId: ref.id,
                version: issued,
            };
        }
        return { decision, mail };
    });
    const row = outcome.mail;
    if (row && !outcome.decision.already) {
        if (row.to) {
            await enqueueJob({
                bookingId: row.bookingId,
                event: row.confirmed ? "acceptance_confirmed" : "acceptance_waiting",
                version: String(row.version),
                to: row.to,
                subject: row.confirmed
                    ? `Your Spires Taxis booking ${row.bookingNumber} is confirmed`
                    : `Quote accepted, awaiting payment · ${row.bookingNumber}`,
                html: (0, emails_1.acceptanceCustomerHtml)({
                    bookingNumber: row.bookingNumber,
                    customerName: row.name,
                    confirmed: row.confirmed,
                    finalFare: row.final,
                }),
                kind: "acceptance_customer",
            });
        }
        await enqueueJob({
            bookingId: row.bookingId,
            event: "acceptance_admin",
            version: String(row.version),
            to: "bookings@spires-taxis.com",
            subject: `Quote accepted · ${row.bookingNumber}`,
            html: (0, emails_1.acceptanceAdminHtml)({
                bookingNumber: row.bookingNumber,
                customerName: row.name,
                outcome: row.confirmed ? "The booking is confirmed." : "Quote accepted and awaiting payment.",
            }),
            kind: "acceptance_admin",
        });
        await audit(row.bookingId, input.onBehalf ? "acceptance_recorded_by_admin" : "quote_accepted", input.actor, {
            version: row.version,
            confirmed: row.confirmed,
        });
    }
    return {
        ok: true,
        already: outcome.decision.already,
        status: outcome.decision.nextStatus,
        substatus: outcome.decision.substatus,
    };
}
exports.acceptQuote = functions.https.onCall(async (data, context) => {
    const body = (data || {});
    if (body.token) {
        return acceptWithToken(body.token);
    }
    if (!context.auth)
        throw httpsError("unauthenticated", "Sign in required.");
    const bookingId = str(body.bookingId);
    const ref = db().collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists)
        throw httpsError("not-found", "Booking not found.");
    const allowed = (0, quoteWorkflow_1.canCustomerAccept)({
        authUid: context.auth.uid,
        bookingUid: str(snap.data()?.uid),
        tokenValid: false,
    });
    if (!allowed)
        throw httpsError("permission-denied", "You cannot accept this quote.");
    return applyAcceptance(ref, { authorised: true, actor: context.auth.uid });
});
async function acceptWithToken(token) {
    const hash = (0, emails_1.hashQuoteToken)(token);
    const tokenSnap = await db().collection("quoteTokens").doc(hash).get();
    if (!tokenSnap.exists)
        throw httpsError("permission-denied", "This quote link is not valid.");
    const row = tokenSnap.data() || {};
    const expires = row.expiresAt?.toDate?.();
    if (expires && expires.getTime() < Date.now())
        throw httpsError("failed-precondition", "This quote link has expired.");
    const ref = db().collection("bookings").doc(str(row.bookingId));
    return applyAcceptance(ref, { authorised: true, actor: "quote_link", version: Number(row.version) || undefined });
}
exports.retryEmailJob = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const body = (data || {});
    const bookingId = str(body.bookingId);
    const jobId = str(body.jobId);
    if ((!bookingId && !jobId) || bookingId.includes("/") || jobId.includes("/")) {
        throw httpsError("invalid-argument", "A booking ID or email job ID is required.");
    }
    const candidates = bookingId
        ? (await db().collection("emailJobs").where("bookingId", "==", bookingId).get()).docs
        : [await db().collection("emailJobs").doc(jobId).get()];
    let retried = 0;
    for (const candidate of candidates) {
        if (!candidate.exists || candidate.data()?.status !== "failed")
            continue;
        const changed = await db().runTransaction(async (tx) => {
            const snap = await tx.get(candidate.ref);
            if (snap.data()?.status !== "failed")
                return false;
            tx.update(candidate.ref, { status: "queued", queuedAt: admin.firestore.FieldValue.serverTimestamp(), error: admin.firestore.FieldValue.delete() });
            return true;
        });
        if (changed) {
            retried++;
            await audit(str(candidate.data()?.bookingId), "email_retried", actor, { jobId: candidate.id });
        }
    }
    return { ok: true, state: retried ? "requeued" : "skipped", retried };
});
exports.resendQuoteEmail = functions.https.onCall(async (data, context) => {
    const actor = requireAdmin(context);
    const body = (data || {});
    const bookingId = str(body.bookingId);
    const snap = await db().collection("bookings").doc(bookingId).get();
    if (!snap.exists)
        throw httpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    const version = Number(booking.quoteIssuedVersion) || 0;
    if (!version)
        throw httpsError("failed-precondition", "Send the quote before resending it.");
    const to = customerEmail(booking);
    if (!to)
        throw httpsError("failed-precondition", "This booking has no customer email.");
    const token = (0, emails_1.newQuoteToken)();
    const expires = str(booking.issuedQuote?.validUntil);
    await db().collection("quoteTokens").doc(token.hash).set({
        bookingId,
        version,
        expiresAt: admin.firestore.Timestamp.fromDate(expires ? new Date(expires) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const resend = Number(booking.quoteResendCount || 0) + 1;
    const model = quoteModel(booking, token.token);
    const queued = await enqueueJob({
        bookingId,
        event: "quote",
        version: String(version),
        mode: "resend",
        resend,
        to,
        subject: `Your Spires Taxis quote ${model.bookingNumber}`,
        html: (0, emails_1.quoteEmailHtml)(model),
        kind: "quote",
        copyTo: quoteCopyRecipients(actor, to),
    });
    await snap.ref.set({ quoteResendCount: resend, quoteEmailStatus: "queued" }, { merge: true });
    await audit(bookingId, "quote_resent", actor, { version, resend });
    return { ok: true, emailState: queued.state, version };
});
function publicView(data, id) {
    const quote = (data.issuedQuote || {});
    let paymentUrl = "";
    if (str(data.paymentLinkUrl) && data.paymentStatus !== "paid") {
        try {
            paymentUrl = (0, paymentLink_1.validatePaymentLinkUrl)(str(data.paymentLinkUrl), allowlist());
        }
        catch {
            paymentUrl = "";
        }
    }
    const buckets = (0, quoteWorkflow_1.paymentBuckets)({
        finalFarePence: Number(quote.finalFarePence) || 0,
        amountReceivedPence: Number(data.amountReceivedPence) || 0,
        paymentRequirement: str(quote.paymentRequirement),
        substatus: str(data.quoteAcceptanceSubstatus),
        hasPaymentLink: Boolean(paymentUrl),
    });
    return {
        bookingId: id,
        bookingNumber: str(data.bookingNumber),
        status: str(data.status),
        substatus: str(data.quoteAcceptanceSubstatus),
        customerName: customerName(data),
        vehicle: (0, emails_1.vehicleLabel)(str(quote.vehicleType) || str(data.vehicleType)),
        pickup: str(quote.pickup) || str(data.pickupLocation) || str(data.pickup),
        destination: str(quote.destination) || str(data.destination),
        dateTime: str(quote.dateTime) || str(data.dateTime),
        returnPickupLocation: str(quote.returnPickupLocation) || str(data.returnPickupLocation),
        returnDestination: str(quote.returnDestination) || str(data.returnDestination),
        returnPickupTime: str(quote.returnPickupTime) || str(data.returnPickupTime),
        bookingType: str(quote.bookingType) || str(data.bookingType),
        normalFare: (0, halfTerm_1.formatPence)(Number(quote.normalFarePence) || 0),
        discount: (0, halfTerm_1.formatPence)(Number(quote.discountPence) || 0),
        finalFare: (0, halfTerm_1.formatPence)(Number(quote.finalFarePence) || 0),
        validUntil: str(quote.validUntil),
        terms: str(quote.terms),
        paymentRequirement: str(quote.paymentRequirement) || "later",
        paymentDescription: str(quote.paymentDescription) === "deposit" ? "Deposit" : "Full payment",
        amountRequested: (0, halfTerm_1.formatPence)(Number(quote.amountRequestedPence) || Number(quote.finalFarePence) || 0),
        paymentLabel: buckets.label,
        paymentUrl,
        paymentLinkPending: !paymentUrl && str(quote.paymentRequirement) === "advance" && buckets.stored !== "paid",
        accepted: Number(data.quoteAcceptedVersion) > 0 && Number(data.quoteAcceptedVersion) === Number(data.quoteIssuedVersion),
    };
}
function setCors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
}
exports.quotePublic = functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST." });
        return;
    }
    try {
        const action = str(req.body?.action);
        const token = str(req.body?.token);
        if (!token) {
            res.status(400).json({ error: "A quote link is required." });
            return;
        }
        const tokenSnap = await db().collection("quoteTokens").doc((0, emails_1.hashQuoteToken)(token)).get();
        if (!tokenSnap.exists) {
            res.status(403).json({ error: "This quote link is not valid." });
            return;
        }
        const tokenRow = tokenSnap.data() || {};
        const bookingSnap = await db().collection("bookings").doc(str(tokenRow.bookingId)).get();
        if (!bookingSnap.exists) {
            res.status(404).json({ error: "Booking not found." });
            return;
        }
        if (action === "view") {
            res.json({ ok: true, quote: publicView(bookingSnap.data() || {}, bookingSnap.id) });
            return;
        }
        if (action === "accept") {
            const result = await acceptWithToken(token);
            const fresh = await bookingSnap.ref.get();
            res.json({ ...result, quote: publicView(fresh.data() || {}, fresh.id) });
            return;
        }
        res.status(400).json({ error: "Unknown action." });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Could not update the quote.";
        res.status(400).json({ error: message });
    }
});
exports.submitWebsiteQuote = functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST." });
        return;
    }
    try {
        const body = req.body || {};
        if (str(body._gotcha)) {
            res.json({ ok: true });
            return;
        }
        const name = str(body.name);
        const email = str(body.email);
        const phone = str(body.phone);
        const pickup = str(body.pickup);
        const destination = str(body.destination);
        const date = str(body.date);
        const time = str(body.time);
        if (!name || !email || !phone || !pickup || !destination || !date || !time) {
            res.status(400).json({ error: "Name, email, phone, pickup, destination, date and time are required." });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ error: "Enter a valid email address." });
            return;
        }
        const terms = (0, bookingTerms_1.onlineTermsAcceptance)({
            termsAccepted: body.termsAccepted === true,
            termsVersion: str(body.termsVersion),
            channel: "website",
        });
        if (!terms.ok) {
            res.status(400).json({ error: terms.error });
            return;
        }
        const bookingType = str(body.bookingType) === "return" ? "return" : "one_way";
        const vehicleType = str(body.vehicleType) === "8_seater" ? "8_seater" : str(body.vehicleType) === "standard" ? "standard" : "";
        const now = Date.now();
        const journey = {
            source: "website",
            bookingType,
            returnTrip: bookingType === "return",
            pickup,
            pickupLocation: pickup,
            destination,
            returnPickupLocation: str(body.returnPickupLocation),
            returnDestination: str(body.returnDestination),
            vehicleType,
            airportCollection: body.airportCollection === true || str(body.service).includes("airport"),
            returnAirportCollection: body.returnAirportCollection === true,
            service: str(body.service),
            otherOfferCode: "",
        };
        const promotion = (0, halfTerm_1.decideHalfTermPromotion)(journey, now);
        const bookingNumber = `SP${String(now).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
        const ref = db().collection("bookings").doc();
        await ref.set({
            source: "website",
            createdByFunction: true,
            bookingNumber,
            bookingMethod: "internet",
            name,
            hirerName: name,
            email,
            hirerEmail: email,
            phone,
            hirerPhone: phone,
            pickup,
            pickupLocation: pickup,
            destination,
            dateTime: `${date}T${time}`,
            pickupTime: `${date}T${time}`,
            bookingType,
            returnTrip: bookingType === "return",
            returnPickupLocation: bookingType === "return" ? str(body.returnPickupLocation) : "",
            returnDestination: bookingType === "return" ? str(body.returnDestination) : "",
            returnPickupTime: bookingType === "return" ? str(body.returnDateTime) : "",
            returnDateTime: bookingType === "return" ? str(body.returnDateTime) : "",
            vehicleType,
            passengers: Number(body.passengers) || 1,
            service: str(body.service),
            notes: str(body.message).slice(0, 2000),
            flightNumber: str(body.flightNumber),
            status: "pending",
            customerStatus: "pending",
            adminStatus: "pending",
            paymentStatus: "pending",
            promotion,
            termsAccepted: true,
            termsVersion: terms.version,
            termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            acceptanceMethod: "website",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info("website quote stored", { bookingId: ref.id, eligible: promotion.eligible });
        await audit(ref.id, "terms_accepted", email, { termsVersion: terms.version, acceptanceMethod: "website" });
        res.json({ ok: true, bookingNumber, promotion: promotion.eligible ? promotion.code : "" });
    }
    catch (err) {
        functions.logger.error("website quote failed", err);
        res.status(500).json({ error: "We could not save your quote request. Please call or WhatsApp us." });
    }
});
async function stampPromotionOnCreate(snap) {
    const data = snap.data() || {};
    const source = str(data.source) || (data.uid ? "customer_app" : "");
    const journey = journeyFrom({ ...data, source });
    const promotion = (0, halfTerm_1.decideHalfTermPromotion)(journey, snap.createTime?.toMillis?.() || Date.now());
    const patch = { promotion };
    if (!data.source && data.uid)
        patch.source = "customer_app";
    const customerClientWrite = (source === "customer_app" || source === "website") && data.createdByFunction !== true;
    if (customerClientWrite) {
        patch.quoteAcceptedAt = admin.firestore.FieldValue.delete();
        patch.quoteAcceptedVersion = admin.firestore.FieldValue.delete();
        patch.paymentLinkUrl = admin.firestore.FieldValue.delete();
        patch.amountReceivedPence = admin.firestore.FieldValue.delete();
        if (data.paymentStatus && data.paymentStatus !== "pending")
            patch.paymentStatus = "pending";
        const terms = (0, bookingTerms_1.onlineTermsAcceptance)({
            termsAccepted: data.termsAccepted,
            termsVersion: data.termsVersion,
            channel: source === "website" ? "website" : "customer_portal",
        });
        if (!terms.ok || data.acceptanceMethod !== terms.method) {
            patch.termsAccepted = false;
            patch.termsVersion = admin.firestore.FieldValue.delete();
            patch.termsAcceptedAt = admin.firestore.FieldValue.delete();
            patch.acceptanceMethod = admin.firestore.FieldValue.delete();
        }
        else {
            patch.termsAccepted = true;
            patch.termsVersion = bookingTerms_1.CURRENT_BOOKING_TERMS.version;
            patch.acceptanceMethod = terms.method;
            patch.termsAcceptedAt = admin.firestore.FieldValue.serverTimestamp();
        }
    }
    await snap.ref.set(patch, { merge: true });
}
exports.EMAIL_SETUP_MESSAGE = emails_1.EMAIL_CONFIG_HELP;
