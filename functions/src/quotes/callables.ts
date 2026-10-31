import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { ADMIN_EMAIL, escapeHtml } from "../driverReminderEmail";
import { sendBookingReceipt } from "../sendBookingReceipt";
import {
  acceptanceAdminHtml,
  acceptanceCustomerHtml,
  EMAIL_CONFIG_HELP,
  hashQuoteToken,
  moneyOrZero,
  newQuoteToken,
  paymentRequestHtml,
  QUOTE_PAGE_ORIGIN,
  quoteEmailHtml,
  sendHtmlEmail,
  vehicleLabel,
} from "./emails";
import { decideHalfTermPromotion, formatPence, poundsToPence, qualifyingReturnNow, quoteTotals, JourneyShape } from "./halfTerm";
import { onlineTermsAcceptance, CURRENT_BOOKING_TERMS } from "../terms/bookingTerms";
import { paymentLinkAllowlist, paymentStatusAfterCustomerAction, validatePaymentLinkUrl } from "./paymentLink";
import {
  bookingMatchesStatusFilter,
  canCustomerAccept,
  canIssueQuote,
  decideAcceptance,
  emailEnqueueDecision,
  emailJobDocId,
  isQuoteAdmin,
  paymentBuckets,
  shouldMoveToConfirmedAfterPayment,
  shouldSendConfirmation,
} from "./quoteWorkflow";

export { bookingMatchesStatusFilter, shouldSendConfirmation };

const db = () => admin.firestore();

function allowlist(): string[] {
  let extra = process.env.PAYMENT_LINK_HOST_ALLOWLIST || "";
  try {
    const configured = functions.config().payments?.hosts;
    if (!extra && configured) extra = String(configured);
  } catch {
    /* config is unavailable outside the functions runtime */
  }
  return paymentLinkAllowlist(extra);
}

function httpsError(code: functions.https.FunctionsErrorCode, message: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, message);
}

function requireAdmin(context: functions.https.CallableContext): string {
  if (!context.auth) throw httpsError("unauthenticated", "Sign in required.");
  const email = String(context.auth.token.email || "");
  if (!isQuoteAdmin(email)) throw httpsError("permission-denied", "Admin access required.");
  return email.trim().toLowerCase();
}

async function audit(bookingId: string, action: string, actorEmail: string, extra: Record<string, unknown> = {}) {
  await db().collection("bookings").doc(bookingId).collection("audit").add({
    action,
    actorEmail,
    at: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Office copies, not a hidden copy to the sending mailbox. */
function quoteCopyRecipients(actor: string, customerTo: string): string[] {
  const customer = customerTo.trim().toLowerCase();
  const recipients = new Set<string>();
  const actorEmail = actor.trim().toLowerCase();
  if (actorEmail.includes("@") && actorEmail !== customer) recipients.add(actorEmail);
  const office = ADMIN_EMAIL.toLowerCase();
  if (office !== customer) recipients.add(office);
  return Array.from(recipients);
}

function journeyFrom(data: FirebaseFirestore.DocumentData): JourneyShape {
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

function customerEmail(data: FirebaseFirestore.DocumentData): string {
  return str(data.hirerEmail) || str(data.email);
}

function customerName(data: FirebaseFirestore.DocumentData): string {
  return str(data.hirerName) || str(data.name) || "Customer";
}

function finalFarePence(data: FirebaseFirestore.DocumentData): number {
  const quote = data.issuedQuote && typeof data.issuedQuote === "object" ? data.issuedQuote : null;
  if (quote && Number.isFinite(Number(quote.finalFarePence))) return Number(quote.finalFarePence);
  const fare = Number(data.actualFare);
  return Number.isFinite(fare) ? Math.round(fare * 100) : 0;
}

async function enqueueJob(input: {
  bookingId: string;
  event: string;
  version: string;
  mode?: "auto" | "retry" | "resend";
  resend?: number;
  to: string;
  subject: string;
  html: string;
  kind: string;
  copyTo?: string[];
}): Promise<{ jobId: string; state: "queued" | "skipped" | "requeued" }> {
  const mode = input.mode || "auto";
  const jobId = emailJobDocId(input.bookingId, input.event, input.version, input.resend || 0);
  const ref = db().collection("emailJobs").doc(jobId);
  const existing = await ref.get();
  const decision = emailEnqueueDecision(existing.exists ? existing.data() || {} : null, mode);
  if (decision === "skip") return { jobId, state: "skipped" };
  const payload = {
    bookingId: input.bookingId,
    event: input.event,
    version: input.version,
    kind: input.kind,
    to: input.to,
    subject: input.subject,
    html: input.html,
    copyTo: input.copyTo || [],
    status: "queued",
    queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: admin.firestore.FieldValue.delete(),
  };
  if (decision === "create" && existing.exists && mode !== "resend") return { jobId, state: "skipped" };
  await ref.set(payload, { merge: true });
  return { jobId, state: decision === "requeue" ? "requeued" : "queued" };
}

export const processEmailJob = functions.firestore.document("emailJobs/{jobId}").onWrite(async (change) => {
  const after = change.after.exists ? change.after.data() : null;
  if (!after || after.status !== "queued") return;
  const ref = change.after.ref;
  const claimed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.status !== "queued") return false;
    tx.update(ref, { status: "sending", sendingAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;
  try {
    if (after.kind === "booking_confirmed" || after.kind === "payment_receipt") {
      const bookingSnap = await db().collection("bookings").doc(String(after.bookingId)).get();
      if (!bookingSnap.exists) throw new Error("Booking no longer exists.");
      await sendBookingReceipt(
        bookingSnap.data(),
        after.kind === "payment_receipt" ? "payment" : "confirmation",
        String(after.bookingId),
        { throwOnError: true }
      );
      await ref.set(
        { status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp(), providerAccepted: true },
        { merge: true }
      );
      const stamp =
        after.kind === "payment_receipt"
          ? { paymentReceiptEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), paymentReceiptEmailStatus: "sent" }
          : { confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), confirmationEmailStatus: "sent" };
      await bookingSnap.ref.set(stamp, { merge: true });
      return;
    }
    const copyTo = Array.isArray(after.copyTo)
      ? after.copyTo.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : [];
    const info = await sendHtmlEmail({
      to: String(after.to || ""),
      subject: String(after.subject || "Spires Taxis"),
      html: String(after.html || ""),
      bccAdmin: after.kind !== "acceptance_admin" && copyTo.length === 0,
    });
    if (after.kind === "quote") {
      const note = `<p style="font-family:Georgia,serif;color:#1a2332;">This copy confirms the quote was sent to ${escapeHtml(String(after.to || ""))}.</p>`;
      for (const copy of copyTo) {
        try {
          await sendHtmlEmail({
            to: copy,
            subject: `Copy: ${String(after.subject || "Spires Taxis quote")} sent to ${String(after.to || "")}`,
            html: note + String(after.html || ""),
            bccAdmin: false,
          });
        } catch (copyErr) {
          const copyMessage = copyErr instanceof Error ? copyErr.message : "Quote copy failed";
          functions.logger.error("quote copy failed", { to: copy, message: copyMessage });
        }
      }
    }
    await ref.set(
      {
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        providerAccepted: true,
        providerMessageId: info.messageId || "",
      },
      { merge: true }
    );
    if (after.kind === "payment_request") {
      await db().collection("bookings").doc(String(after.bookingId)).set(
        {
          paymentLinkEmailStatus: "sent",
          paymentLinkSentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    if (after.kind === "quote") {
      await db().collection("bookings").doc(String(after.bookingId)).set(
        { quoteEmailStatus: "sent", quoteEmailSentAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed";
    functions.logger.error("email job failed", { jobId: change.after.id, bookingId: after.bookingId, message });
    await ref.set(
      { status: "failed", failedAt: admin.firestore.FieldValue.serverTimestamp(), error: message.slice(0, 500) },
      { merge: true }
    );
    if (after.kind === "quote" || after.kind === "payment_request") {
      const field = after.kind === "quote" ? "quoteEmailStatus" : "paymentLinkEmailStatus";
      await db()
        .collection("bookings")
        .doc(String(after.bookingId))
        .set({ [field]: "failed", emailError: message.slice(0, 300) }, { merge: true });
    }
  }
});

export async function enqueueConfirmationIfNeeded(
  before: FirebaseFirestore.DocumentData | null,
  after: FirebaseFirestore.DocumentData,
  bookingId: string
): Promise<void> {
  if (!shouldSendConfirmation(before, after)) return;
  const to = customerEmail(after);
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

function quoteModel(data: FirebaseFirestore.DocumentData, token: string) {
  const quote = (data.issuedQuote || {}) as Record<string, unknown>;
  const paymentUrl = str(data.paymentLinkUrl);
  let safePay = "";
  if (paymentUrl && data.paymentStatus !== "paid") {
    try {
      safePay = validatePaymentLinkUrl(paymentUrl, allowlist());
    } catch {
      safePay = "";
    }
  }
  const requirement = str(quote.paymentRequirement) === "advance" ? "advance" : "later";
  return {
    bookingNumber: str(data.bookingNumber) || "Quote",
    customerName: customerName(data),
    vehicleLabel: vehicleLabel(str(quote.vehicleType) || str(data.vehicleType)),
    outbound: `${str(quote.pickup) || str(data.pickupLocation) || str(data.pickup)} to ${str(quote.destination) || str(data.destination)} at ${str(quote.dateTime) || str(data.dateTime) || str(data.pickupTime)}`,
    returnLeg:
      str(quote.bookingType) === "return" || data.bookingType === "return"
        ? `${str(quote.returnPickupLocation) || str(data.returnPickupLocation)} to ${str(quote.returnDestination) || str(data.returnDestination)} at ${str(quote.returnPickupTime) || str(data.returnPickupTime)}`
        : "",
    normalFare: moneyOrZero(Number(quote.normalFarePence) || 0),
    discount: moneyOrZero(Number(quote.discountPence) || 0),
    finalFare: moneyOrZero(Number(quote.finalFarePence) || 0),
    validUntil: str(quote.validUntil),
    paymentRequirement: requirement as "advance" | "later",
    paymentDescription: str(quote.paymentDescription) === "deposit" ? "Deposit" : "Full payment",
    amountRequested: moneyOrZero(Number(quote.amountRequestedPence) || Number(quote.finalFarePence) || 0),
    quoteUrl: `${QUOTE_PAGE_ORIGIN}?t=${encodeURIComponent(token)}`,
    paymentUrl: safePay,
    terms: str(quote.terms),
  };
}

function readQuoteInput(data: Record<string, unknown>, booking: FirebaseFirestore.DocumentData) {
  const normalFarePence = poundsToPence(String(data.normalFarePounds ?? ""));
  const bookingType = str(data.bookingType) || str(booking.bookingType);
  const merged: JourneyShape = {
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
  const promotion = (booking.promotion || {}) as { eligible?: boolean };
  const totals = quoteTotals({
    normalFarePence,
    promotionEligible: promotion.eligible === true,
    stillQualifyingReturn: qualifyingReturnNow(merged),
  });
  const paymentRequirement = str(data.paymentRequirement) === "advance" ? "advance" : "later";
  const paymentDescription = str(data.paymentDescription) === "deposit" ? "deposit" : "full";
  let amountRequestedPence = totals.finalFarePence;
  if (str(data.amountRequestedPounds)) amountRequestedPence = poundsToPence(String(data.amountRequestedPounds));
  if (paymentDescription === "full") amountRequestedPence = totals.finalFarePence;
  let paymentLinkUrl = "";
  if (str(data.paymentLinkUrl)) paymentLinkUrl = validatePaymentLinkUrl(str(data.paymentLinkUrl), allowlist());
  const validUntil = str(data.validUntil);
  const terms =
    str(data.terms) ||
    (totals.discountPence > 0
      ? "This quote is not a confirmed booking. The half term offer is £5 off this complete airport return and is not combined with other offers. One way bookings are not discounted. The journeys are subject to availability."
      : "This quote is not a confirmed booking. The journeys are subject to availability.");
  return { merged, totals, paymentRequirement, paymentDescription, amountRequestedPence, paymentLinkUrl, validUntil, terms };
}

function journeyPatch(input: ReturnType<typeof readQuoteInput>, raw: Record<string, unknown>) {
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
    flightNumber: str(raw.flightNumber),
    returnFlightNumber: str(raw.returnFlightNumber),
    airportCollection: raw.airportCollection === true,
    returnAirportCollection: raw.returnAirportCollection === true,
    passengers: Number(raw.passengers) || undefined,
  };
}

function quoteInputError(err: unknown): never {
  if (err instanceof functions.https.HttpsError) throw err;
  const message = err instanceof Error && err.message ? err.message : "Could not save the quote.";
  throw httpsError("invalid-argument", message);
}

async function saveDraftOrIssue(data: Record<string, unknown>, context: functions.https.CallableContext, issue: boolean) {
  const actor = requireAdmin(context);
  const bookingId = str(data.bookingId);
  if (!bookingId) throw httpsError("invalid-argument", "bookingId is required.");
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  let parsed: ReturnType<typeof readQuoteInput>;
  try {
    const fare = str(data.normalFarePounds) || String(booking.actualFare ?? "").trim();
    parsed = readQuoteInput({ ...data, normalFarePounds: fare }, booking);
  } catch (err) {
    quoteInputError(err);
  }
  const patch = journeyPatch(parsed, data);
  const draft = {
    ...parsed.totals,
    ...patch,
    paymentRequirement: parsed.paymentRequirement,
    paymentDescription: parsed.paymentDescription,
    amountRequestedPence: parsed.amountRequestedPence,
    validUntil: parsed.validUntil,
    terms: parsed.terms,
    updatedAt: new Date().toISOString(),
  };
  if (!issue) {
    await ref.set({ quoteDraft: draft, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await audit(bookingId, "quote_draft_saved", actor, { finalFarePence: parsed.totals.finalFarePence });
    return { ok: true, emailed: false, ...parsed.totals, formatted: {
      normal: formatPence(parsed.totals.normalFarePence),
      discount: formatPence(parsed.totals.discountPence),
      final: formatPence(parsed.totals.finalFarePence),
    } };
  }
  const gate = canIssueQuote(str(booking.status), data.reissue === true);
  if (!gate.ok) throw httpsError("failed-precondition", gate.reason || "Quote cannot be issued.");
  const version = Number(booking.quoteIssuedVersion || 0) + 1;
  const token = newQuoteToken();
  const issuedQuote = { ...draft, version, issuedAt: new Date().toISOString() };
  const quotes = Array.isArray(booking.quotes) ? booking.quotes.slice(-19) : [];
  quotes.push(issuedQuote);
  const buckets = paymentBuckets({
    finalFarePence: parsed.totals.finalFarePence,
    amountReceivedPence: Number(booking.amountReceivedPence) || 0,
    paymentRequirement: parsed.paymentRequirement,
    hasPaymentLink: Boolean(parsed.paymentLinkUrl || booking.paymentLinkUrl),
  });
  await ref.set(
    {
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
      paymentLinkUrl: parsed.paymentLinkUrl || str(booking.paymentLinkUrl) || admin.firestore.FieldValue.delete(),
      paymentStatus: buckets.stored === "paid" ? booking.paymentStatus || "paid" : buckets.stored,
      quoteEmailStatus: "queued",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const expiresAt = parsed.validUntil ? new Date(parsed.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db().collection("quoteTokens").doc(token.hash).set({
    bookingId,
    version,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const fresh = { ...booking, ...patch, issuedQuote, bookingNumber: booking.bookingNumber, paymentLinkUrl: parsed.paymentLinkUrl || booking.paymentLinkUrl, paymentStatus: buckets.stored };
  const model = quoteModel(fresh, token.token);
  const to = customerEmail(booking);
  let emailState: "queued" | "failed" | "skipped" = "skipped";
  if (!to) {
    emailState = "failed";
    await ref.set({ quoteEmailStatus: "failed", emailError: "No customer email on the booking." }, { merge: true });
  } else {
    try {
      const queued = await enqueueJob({
        bookingId,
        event: "quote",
        version: String(version),
        to,
        subject: `Your Spires Taxis quote ${model.bookingNumber}`,
        html: quoteEmailHtml(model),
        kind: "quote",
        copyTo: quoteCopyRecipients(actor, to),
      });
      emailState = queued.state === "skipped" ? "skipped" : "queued";
    } catch (err) {
      emailState = "failed";
      await ref.set(
        { quoteEmailStatus: "failed", emailError: err instanceof Error ? err.message : "Could not queue email" },
        { merge: true }
      );
    }
  }
  await audit(bookingId, "quote_issued", actor, { version, discountPence: parsed.totals.discountPence, emailState });
  return {
    ok: true,
    version,
    emailState,
    ...parsed.totals,
    formatted: {
      normal: formatPence(parsed.totals.normalFarePence),
      discount: formatPence(parsed.totals.discountPence),
      final: formatPence(parsed.totals.finalFarePence),
    },
  };
}

export const saveQuoteDraft = functions.https.onCall(async (data, context) => {
  return saveDraftOrIssue((data || {}) as Record<string, unknown>, context, false);
});

export const issueQuote = functions.https.onCall(async (data, context) => {
  return saveDraftOrIssue((data || {}) as Record<string, unknown>, context, true);
});

export const savePaymentLink = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const body = (data || {}) as Record<string, unknown>;
  const bookingId = str(body.bookingId);
  if (!bookingId) throw httpsError("invalid-argument", "bookingId is required.");
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const clear = body.clear === true || !str(body.paymentLinkUrl);
  let paymentLinkUrl = "";
  if (!clear) paymentLinkUrl = validatePaymentLinkUrl(str(body.paymentLinkUrl), allowlist());
  const amountRequestedPence = str(body.amountRequestedPounds) ? poundsToPence(String(body.amountRequestedPounds)) : finalFarePence(snap.data() || {});
  const paymentDescription = str(body.paymentDescription) === "deposit" ? "deposit" : "full";
  await ref.set(
    {
      paymentLinkUrl: clear ? admin.firestore.FieldValue.delete() : paymentLinkUrl,
      amountRequestedPence,
      paymentDescription,
      paymentLinkUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: paymentStatusAfterCustomerAction(snap.data()?.paymentStatus || "pending"),
    },
    { merge: true }
  );
  await audit(bookingId, clear ? "payment_link_removed" : "payment_link_saved", actor, {
    amountRequestedPence,
    paymentDescription,
  });
  return { ok: true, saved: !clear };
});

export const sendPaymentRequest = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const bookingId = str((data as { bookingId?: string })?.bookingId);
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  const url = validatePaymentLinkUrl(str(booking.paymentLinkUrl), allowlist());
  const to = customerEmail(booking);
  if (!to) throw httpsError("failed-precondition", "This booking has no customer email.");
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
    html: paymentRequestHtml({
      bookingNumber: str(booking.bookingNumber),
      customerName: customerName(booking),
      amount: formatPence(amount),
      description,
      paymentUrl: url,
      bookingUrl: QUOTE_PAGE_ORIGIN,
      confirmed,
    }),
    kind: "payment_request",
  });
  await audit(bookingId, "payment_request_queued", actor, { emailState: queued.state });
  return { ok: true, emailState: queued.state };
});

export const recordManualPayment = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const body = (data || {}) as Record<string, unknown>;
  const bookingId = str(body.bookingId);
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  const amountReceivedPence = poundsToPence(String(body.amountReceivedPounds ?? "0"));
  const method = str(body.method) || "bank transfer";
  const buckets = paymentBuckets({
    finalFarePence: finalFarePence(booking),
    amountReceivedPence,
    paymentRequirement: str(booking.paymentRequirement),
    substatus: str(booking.quoteAcceptanceSubstatus),
    hasPaymentLink: Boolean(booking.paymentLinkUrl),
  });
  const required = Number(booking.amountRequestedPence) || finalFarePence(booking);
  const paymentVerified = amountReceivedPence >= required && required > 0;
  const accepted = Number(booking.quoteAcceptedVersion) > 0 && Number(booking.quoteAcceptedVersion) === Number(booking.quoteIssuedVersion);
  const move = shouldMoveToConfirmedAfterPayment({
    acceptedVersion: Number(booking.quoteAcceptedVersion) || null,
    issuedVersion: Number(booking.quoteIssuedVersion) || null,
    paymentVerified,
    status: str(booking.status),
  });
  const patch: Record<string, unknown> = {
    amountReceivedPence,
    outstandingPence: buckets.outstandingPence,
    paymentMethod: method,
    paymentStatus: buckets.stored,
    paymentVerified,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentRecordedBy: actor,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (move && accepted) {
    patch.status = "confirmed";
    patch.customerStatus = "confirmed";
    patch.adminStatus = "confirmed";
    patch.quoteAcceptanceSubstatus = admin.firestore.FieldValue.delete();
  }
  await ref.set(patch, { merge: true });
  await audit(bookingId, "payment_recorded", actor, {
    amountReceivedPence,
    outstandingPence: buckets.outstandingPence,
    paymentStatus: buckets.stored,
    movedToConfirmed: Boolean(patch.status === "confirmed"),
  });
  return { ok: true, label: buckets.label, paymentStatus: buckets.stored, confirmed: patch.status === "confirmed" };
});

export const recordManualAcceptance = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const bookingId = str((data as { bookingId?: string })?.bookingId);
  const ref = db().collection("bookings").doc(bookingId);
  const result = await applyAcceptance(ref, {
    authorised: true,
    actor: actor,
    onBehalf: true,
  });
  return result;
});

type AcceptanceMail = {
  to: string;
  confirmed: boolean;
  bookingNumber: string;
  name: string;
  final: string;
  bookingId: string;
  version: number;
};

async function applyAcceptance(
  ref: FirebaseFirestore.DocumentReference,
  input: { authorised: boolean; actor: string; onBehalf?: boolean; version?: number }
) {
  const outcome = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpsError("not-found", "Booking not found.");
    const booking = snap.data() || {};
    const issued = Number(booking.quoteIssuedVersion) || 0;
    const requested = input.version || issued;
    const issuedQuote = (booking.issuedQuote || {}) as { validUntil?: string; paymentRequirement?: string };
    const validUntil = str(issuedQuote.validUntil);
    const decision = decideAcceptance({
      status: str(booking.status),
      customerStatus: str(booking.customerStatus),
      quoteIssuedVersion: issued,
      quoteAcceptedVersion: Number(booking.quoteAcceptedVersion) || null,
      validUntilMs: validUntil ? new Date(validUntil).getTime() : null,
      nowMs: Date.now(),
      requestedVersion: requested,
      paymentRequirement: str(issuedQuote.paymentRequirement || booking.paymentRequirement),
      authorised: input.authorised,
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
    let mail: AcceptanceMail | null = null;
    if (!decision.already) {
      const patch: Record<string, unknown> = {
        quoteAcceptedVersion: issued,
        quoteAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        quoteAcceptedBy: input.onBehalf ? `admin:${input.actor}` : input.actor || "customer",
        status: decision.nextStatus,
        customerStatus: decision.nextStatus,
        adminStatus: decision.nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (decision.substatus) patch.quoteAcceptanceSubstatus = decision.substatus;
      else patch.quoteAcceptanceSubstatus = admin.firestore.FieldValue.delete();
      tx.set(ref, patch, { merge: true });
      mail = {
        to: customerEmail(booking),
        confirmed: decision.nextStatus === "confirmed",
        bookingNumber: str(booking.bookingNumber),
        name: customerName(booking),
        final: formatPence(finalFarePence(booking)),
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
        html: acceptanceCustomerHtml({
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
      html: acceptanceAdminHtml({
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

export const acceptQuote = functions.https.onCall(async (data, context) => {
  const body = (data || {}) as { bookingId?: string; token?: string };
  if (body.token) {
    return acceptWithToken(body.token);
  }
  if (!context.auth) throw httpsError("unauthenticated", "Sign in required.");
  const bookingId = str(body.bookingId);
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const allowed = canCustomerAccept({
    authUid: context.auth.uid,
    bookingUid: str(snap.data()?.uid),
    tokenValid: false,
  });
  if (!allowed) throw httpsError("permission-denied", "You cannot accept this quote.");
  return applyAcceptance(ref, { authorised: true, actor: context.auth.uid });
});

async function acceptWithToken(token: string) {
  const hash = hashQuoteToken(token);
  const tokenSnap = await db().collection("quoteTokens").doc(hash).get();
  if (!tokenSnap.exists) throw httpsError("permission-denied", "This quote link is not valid.");
  const row = tokenSnap.data() || {};
  const expires = row.expiresAt?.toDate?.() as Date | undefined;
  if (expires && expires.getTime() < Date.now()) throw httpsError("failed-precondition", "This quote link has expired.");
  const ref = db().collection("bookings").doc(str(row.bookingId));
  return applyAcceptance(ref, { authorised: true, actor: "quote_link", version: Number(row.version) || undefined });
}

export const retryEmailJob = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const jobId = str((data as { jobId?: string })?.jobId);
  if (!jobId) throw httpsError("invalid-argument", "jobId is required.");
  const ref = db().collection("emailJobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Email job not found.");
  const decision = emailEnqueueDecision(snap.data() || {}, "retry");
  if (decision !== "requeue") return { ok: true, state: "skipped" };
  await ref.set({ status: "queued", queuedAt: admin.firestore.FieldValue.serverTimestamp(), error: admin.firestore.FieldValue.delete() }, { merge: true });
  await audit(str(snap.data()?.bookingId), "email_retried", actor, { jobId });
  return { ok: true, state: "requeued" };
});

export const resendQuoteEmail = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const body = (data || {}) as { bookingId?: string };
  const bookingId = str(body.bookingId);
  const snap = await db().collection("bookings").doc(bookingId).get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  const version = Number(booking.quoteIssuedVersion) || 0;
  if (!version) throw httpsError("failed-precondition", "Send the quote before resending it.");
  const to = customerEmail(booking);
  if (!to) throw httpsError("failed-precondition", "This booking has no customer email.");
  const token = newQuoteToken();
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
    html: quoteEmailHtml(model),
    kind: "quote",
    copyTo: quoteCopyRecipients(actor, to),
  });
  await snap.ref.set({ quoteResendCount: resend, quoteEmailStatus: "queued" }, { merge: true });
  await audit(bookingId, "quote_resent", actor, { version, resend });
  return { ok: true, emailState: queued.state, version };
});

function publicView(data: FirebaseFirestore.DocumentData, id: string) {
  const quote = (data.issuedQuote || {}) as Record<string, unknown>;
  let paymentUrl = "";
  if (str(data.paymentLinkUrl) && data.paymentStatus !== "paid") {
    try {
      paymentUrl = validatePaymentLinkUrl(str(data.paymentLinkUrl), allowlist());
    } catch {
      paymentUrl = "";
    }
  }
  const buckets = paymentBuckets({
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
    vehicle: vehicleLabel(str(quote.vehicleType) || str(data.vehicleType)),
    pickup: str(quote.pickup) || str(data.pickupLocation) || str(data.pickup),
    destination: str(quote.destination) || str(data.destination),
    dateTime: str(quote.dateTime) || str(data.dateTime),
    returnPickupLocation: str(quote.returnPickupLocation) || str(data.returnPickupLocation),
    returnDestination: str(quote.returnDestination) || str(data.returnDestination),
    returnPickupTime: str(quote.returnPickupTime) || str(data.returnPickupTime),
    bookingType: str(quote.bookingType) || str(data.bookingType),
    normalFare: formatPence(Number(quote.normalFarePence) || 0),
    discount: formatPence(Number(quote.discountPence) || 0),
    finalFare: formatPence(Number(quote.finalFarePence) || 0),
    validUntil: str(quote.validUntil),
    terms: str(quote.terms),
    paymentRequirement: str(quote.paymentRequirement) || "later",
    paymentDescription: str(quote.paymentDescription) === "deposit" ? "Deposit" : "Full payment",
    amountRequested: formatPence(Number(quote.amountRequestedPence) || Number(quote.finalFarePence) || 0),
    paymentLabel: buckets.label,
    paymentUrl,
    paymentLinkPending: !paymentUrl && str(quote.paymentRequirement) === "advance" && buckets.stored !== "paid",
    accepted: Number(data.quoteAcceptedVersion) > 0 && Number(data.quoteAcceptedVersion) === Number(data.quoteIssuedVersion),
  };
}

function setCors(res: functions.Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

export const quotePublic = functions.https.onRequest(async (req, res) => {
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
    const tokenSnap = await db().collection("quoteTokens").doc(hashQuoteToken(token)).get();
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update the quote.";
    res.status(400).json({ error: message });
  }
});

export const submitWebsiteQuote = functions.https.onRequest(async (req, res) => {
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
    const terms = onlineTermsAcceptance({
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
    const journey: JourneyShape = {
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
    const promotion = decideHalfTermPromotion(journey, now);
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
  } catch (err) {
    functions.logger.error("website quote failed", err);
    res.status(500).json({ error: "We could not save your quote request. Please call or WhatsApp us." });
  }
});

export async function stampPromotionOnCreate(
  snap: FirebaseFirestore.DocumentSnapshot
): Promise<void> {
  const data = snap.data() || {};
  const source = str(data.source) || (data.uid ? "customer_app" : "");
  const journey = journeyFrom({ ...data, source });
  const promotion = decideHalfTermPromotion(journey, snap.createTime?.toMillis?.() || Date.now());
  const patch: Record<string, unknown> = { promotion };
  if (!data.source && data.uid) patch.source = "customer_app";
  const customerClientWrite = (source === "customer_app" || source === "website") && data.createdByFunction !== true;
  if (customerClientWrite) {
    patch.quoteAcceptedAt = admin.firestore.FieldValue.delete();
    patch.quoteAcceptedVersion = admin.firestore.FieldValue.delete();
    patch.paymentLinkUrl = admin.firestore.FieldValue.delete();
    patch.amountReceivedPence = admin.firestore.FieldValue.delete();
    if (data.paymentStatus && data.paymentStatus !== "pending") patch.paymentStatus = "pending";
    const terms = onlineTermsAcceptance({
      termsAccepted: data.termsAccepted,
      termsVersion: data.termsVersion,
      channel: source === "website" ? "website" : "customer_portal",
    });
    if (!terms.ok || data.acceptanceMethod !== terms.method) {
      patch.termsAccepted = false;
      patch.termsVersion = admin.firestore.FieldValue.delete();
      patch.termsAcceptedAt = admin.firestore.FieldValue.delete();
      patch.acceptanceMethod = admin.firestore.FieldValue.delete();
    } else {
      patch.termsAccepted = true;
      patch.termsVersion = CURRENT_BOOKING_TERMS.version;
      patch.acceptanceMethod = terms.method;
      patch.termsAcceptedAt = admin.firestore.FieldValue.serverTimestamp();
    }
  }
  await snap.ref.set(patch, { merge: true });
}

export const EMAIL_SETUP_MESSAGE = EMAIL_CONFIG_HELP;
