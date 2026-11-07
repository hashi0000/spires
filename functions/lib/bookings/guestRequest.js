"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUEST_RATE_MESSAGE = exports.GUEST_CLAIM_ORIGIN = exports.GUEST_CLAIM_TTL_MS = exports.GUEST_RATE_WINDOW_MS = exports.GUEST_RATE_LIMIT = exports.CONTACT_REQUIRED_MESSAGE = exports.CONTACT_HELPER = exports.OFFICE_PHONE = void 0;
exports.isGuestRateError = isGuestRateError;
exports.normaliseGuestEmail = normaliseGuestEmail;
exports.normaliseGuestPhone = normaliseGuestPhone;
exports.hashGuestKey = hashGuestKey;
exports.clientIpHash = clientIpHash;
exports.newGuestClaimToken = newGuestClaimToken;
exports.guestBookingNumber = guestBookingNumber;
exports.nextGuestRate = nextGuestRate;
exports.prepareGuestBooking = prepareGuestBooking;
exports.commitGuestBooking = commitGuestBooking;
exports.decideGuestClaim = decideGuestClaim;
exports.guestClaimPatch = guestClaimPatch;
const crypto_1 = require("crypto");
const bookingTerms_1 = require("../terms/bookingTerms");
const placeRecord_1 = require("../locations/placeRecord");
exports.OFFICE_PHONE = "07776 897772";
exports.CONTACT_HELPER = "Please provide a phone number or email address so we can respond to your request.";
exports.CONTACT_REQUIRED_MESSAGE = `${exports.CONTACT_HELPER} You can also call us on ${exports.OFFICE_PHONE}.`;
exports.GUEST_RATE_LIMIT = 8;
exports.GUEST_RATE_WINDOW_MS = 60 * 60 * 1000;
exports.GUEST_CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;
exports.GUEST_CLAIM_ORIGIN = "https://customer.spires-taxis.com/claim";
exports.GUEST_RATE_MESSAGE = `We already have several recent requests from these details. Please call ${exports.OFFICE_PHONE} if you still need help, and do not send the form again.`;
function isGuestRateError(err) {
    return Boolean(err && typeof err === "object" && err.code === "RATE");
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const SUBMISSION_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
function parsePlace(value) {
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function str(value) {
    return typeof value === "string" ? value.trim() : "";
}
function flag(value) {
    return value === true || value === "true" || value === "yes" || value === "on";
}
function normaliseGuestEmail(value) {
    const email = value.trim().toLowerCase();
    return EMAIL_PATTERN.test(email) ? email : "";
}
/** Accept mobiles, landlines and international numbers. Empty is allowed. */
function normaliseGuestPhone(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    const compact = trimmed.replace(/[\s().-]/g, "");
    if (!PHONE_PATTERN.test(compact))
        return null;
    return compact;
}
function hashGuestKey(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function clientIpHash(forwardedFor) {
    const first = str(forwardedFor).split(",")[0].trim() || "unknown";
    return hashGuestKey(first).slice(0, 40);
}
function newGuestClaimToken() {
    const token = (0, crypto_1.randomBytes)(32).toString("base64url");
    return { token, hash: hashGuestKey(token) };
}
function guestBookingNumber(now) {
    return `SP${now.toString(36).toUpperCase()}${(0, crypto_1.randomBytes)(4).toString("hex").toUpperCase()}`;
}
function isYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function isHm(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function splitDateTime(value) {
    if (!value.includes("T"))
        return { date: "", time: "" };
    const [date, rest] = value.split("T");
    return { date: date || "", time: (rest || "").slice(0, 5) };
}
function nextGuestRate(current, now, limit = exports.GUEST_RATE_LIMIT, windowMs = exports.GUEST_RATE_WINDOW_MS) {
    if (!current || now - current.windowStart >= windowMs) {
        return { allowed: true, next: { count: 1, windowStart: now } };
    }
    if (current.count >= limit)
        return { allowed: false, next: current };
    return { allowed: true, next: { count: current.count + 1, windowStart: current.windowStart } };
}
function prepareGuestBooking(body, options) {
    if (str(body._gotcha))
        return { ok: true, spam: true };
    const name = str(body.name).slice(0, 120);
    if (name.length < 2)
        return { ok: false, error: "Please enter your full name." };
    const email = normaliseGuestEmail(str(body.email));
    if (str(body.email) && !email) {
        return { ok: false, error: "Enter a valid email address, or leave it blank if you have given a phone number." };
    }
    const phone = normaliseGuestPhone(str(body.phone));
    if (phone === null) {
        return { ok: false, error: "Enter a phone number we can call, including the area code. Mobile numbers and landlines are both fine." };
    }
    if (!email && !phone)
        return { ok: false, error: exports.CONTACT_REQUIRED_MESSAGE };
    const pickup = str(body.pickup).slice(0, 240);
    const destination = str(body.destination).slice(0, 240);
    if (pickup.length < 3 || destination.length < 3) {
        return { ok: false, error: "Enter a pickup address and a destination." };
    }
    const direct = splitDateTime(str(body.dateTime));
    const date = str(body.date) || direct.date;
    const time = str(body.time) || direct.time;
    if (!isYmd(date) || !isHm(time))
        return { ok: false, error: "Enter the date and pickup time." };
    if (date < options.todayYmd)
        return { ok: false, error: "Choose a travel date that is today or later." };
    const dateTime = `${date}T${time}`;
    const vehicleType = str(body.vehicleType);
    if (vehicleType !== "standard" && vehicleType !== "8_seater") {
        return { ok: false, error: "Please choose a Standard Car or an 8 Seater." };
    }
    const maxPassengers = vehicleType === "8_seater" ? 8 : 4;
    const rawPassengers = str(body.passengers);
    const passengers = rawPassengers ? Number(rawPassengers) : 1;
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > maxPassengers) {
        return {
            ok: false,
            error: vehicleType === "8_seater"
                ? "An 8 Seater can take up to 8 passengers."
                : "A Standard Car can take up to 4 passengers. Please choose the 8 Seater for larger groups.",
        };
    }
    const rawLuggage = str(body.luggage);
    const luggage = rawLuggage ? Number(rawLuggage) : 0;
    if (!Number.isInteger(luggage) || luggage < 0 || luggage > 10) {
        return { ok: false, error: "Enter the number of luggage pieces, from 0 to 10." };
    }
    const bookingType = str(body.bookingType) === "return" ? "return" : "one_way";
    const returnDirect = splitDateTime(str(body.returnDateTime) || str(body.returnPickupTime));
    const returnDate = str(body.returnDate) || returnDirect.date;
    const returnTime = str(body.returnTime) || returnDirect.time;
    const returnWhen = returnDate && returnTime ? `${returnDate}T${returnTime}` : str(body.returnPickupTime);
    const returnPickupLocation = str(body.returnPickupLocation).slice(0, 240);
    const returnDestination = str(body.returnDestination).slice(0, 240);
    if (bookingType === "return") {
        const returnParts = splitDateTime(returnWhen);
        if (!isYmd(returnParts.date) || !isHm(returnParts.time) || !returnPickupLocation || !returnDestination) {
            return { ok: false, error: "Return bookings need a return date, pickup time, pickup address and destination." };
        }
        if (`${returnParts.date}T${returnParts.time}` < dateTime) {
            return { ok: false, error: "The return needs to be at the same time as the outward journey, or later." };
        }
    }
    const terms = (0, bookingTerms_1.onlineTermsAcceptance)({
        termsAccepted: body.termsAccepted === true || body.termsAccepted === "yes",
        termsVersion: str(body.termsVersion),
        channel: "website",
    });
    if (!terms.ok)
        return { ok: false, error: terms.error };
    const airportCollection = flag(body.airportCollection);
    const returnAirportCollection = bookingType === "return" && flag(body.returnAirportCollection);
    const paymentRaw = str(body.paymentMethod).toLowerCase();
    const paymentMethod = ["cash", "card", "bank transfer", "undecided"].includes(paymentRaw) ? paymentRaw : "undecided";
    const details = (str(body.specialRequirements) || str(body.notes) || str(body.message)).slice(0, 2000);
    const contactBy = email && phone ? "both" : email ? "email" : "phone";
    const submissionId = SUBMISSION_PATTERN.test(str(body.submissionId)) ? str(body.submissionId) : "";
    const claim = email
        ? {
            token: options.claimToken?.token || "",
            hash: options.claimToken?.hash || "",
            email,
        }
        : null;
    const pickupPlace = (0, placeRecord_1.placeRecord)(parsePlace(body.pickupPlace), pickup);
    const destinationPlace = (0, placeRecord_1.placeRecord)(parsePlace(body.destinationPlace), destination);
    const record = {
        source: "website",
        guestRequest: true,
        accountLinked: false,
        createdByFunction: true,
        bookingNumber: options.bookingNumber,
        bookingMethod: "internet",
        name,
        hirerName: name,
        email,
        hirerEmail: email,
        phone,
        hirerPhone: phone,
        contactBy,
        pickup,
        pickupLocation: pickup,
        destination,
        ...(pickupPlace ? { pickupPlace } : {}),
        ...(destinationPlace ? { destinationPlace } : {}),
        dateTime,
        pickupTime: dateTime,
        passengers,
        luggage,
        specialRequirements: details,
        notes: details,
        bookingType,
        returnTrip: bookingType === "return",
        returnDateTime: bookingType === "return" ? returnWhen : "",
        returnPickupTime: bookingType === "return" ? returnWhen : "",
        returnPickupLocation: bookingType === "return" ? returnPickupLocation : "",
        returnDestination: bookingType === "return" ? returnDestination : "",
        airportCollection,
        returnAirportCollection,
        flightNumber: airportCollection ? str(body.flightNumber).slice(0, 40) : "",
        terminal: airportCollection ? str(body.terminal).slice(0, 40) : "",
        returnFlightNumber: returnAirportCollection ? str(body.returnFlightNumber).slice(0, 40) : "",
        vehicleType,
        paymentMethod,
        paymentStatus: "pending",
        status: "pending",
        customerStatus: "pending",
        adminStatus: "pending",
        depositRequired: false,
        depositStatus: "not_required",
        termsAccepted: true,
        termsVersion: terms.version,
        acceptanceMethod: "website",
    };
    return {
        ok: true,
        submissionId,
        contactHash: hashGuestKey(`${email}|${phone}`),
        record,
        claim: claim && claim.hash ? claim : null,
    };
}
async function commitGuestBooking(db, prepared, meta) {
    const bookingNumber = String(prepared.record.bookingNumber || "");
    const email = String(prepared.record.email || "");
    const phone = String(prepared.record.phone || "");
    const name = String(prepared.record.name || "");
    if (prepared.submissionId) {
        const existing = await db.getSubmission(prepared.submissionId);
        if (existing) {
            return { ok: true, duplicate: true, ...existing, claimToken: "", email, phone, name };
        }
    }
    const ip = nextGuestRate(await db.getRate(`ip:${meta.ipHash}`), meta.now);
    const contact = nextGuestRate(await db.getRate(`contact:${prepared.contactHash}`), meta.now);
    if (!ip.allowed || !contact.allowed) {
        return {
            ok: false,
            status: 429,
            error: exports.GUEST_RATE_MESSAGE,
        };
    }
    const saved = await db.insert({
        submissionId: prepared.submissionId,
        bookingId: meta.bookingId,
        bookingNumber,
        record: prepared.record,
        ipHash: meta.ipHash,
        contactHash: prepared.contactHash,
        ipRate: ip.next,
        contactRate: contact.next,
        claim: prepared.claim
            ? {
                hash: prepared.claim.hash,
                email: prepared.claim.email,
                bookingId: meta.bookingId,
                expiresAt: meta.now + exports.GUEST_CLAIM_TTL_MS,
            }
            : null,
    });
    return {
        ok: true,
        duplicate: saved.duplicate,
        bookingId: saved.bookingId,
        bookingNumber: saved.bookingNumber,
        claimToken: saved.duplicate ? "" : prepared.claim?.token || "",
        email,
        phone,
        name,
    };
}
function decideGuestClaim(input) {
    if (!input.claim || !input.claim.bookingId)
        return { ok: false, error: "This link is not valid." };
    if (input.claim.used)
        return { ok: false, error: "This request is already linked to an account." };
    if (input.claim.expiresAt <= input.now) {
        return { ok: false, error: `This link has expired. Your request is still saved. Call us on ${exports.OFFICE_PHONE} if you need help.` };
    }
    const accountEmail = normaliseGuestEmail(input.accountEmail);
    if (!accountEmail)
        return { ok: false, error: "An email address is required before this request can be added to an account." };
    if (accountEmail !== normaliseGuestEmail(input.claim.email)) {
        return { ok: false, error: "Sign in with the email address on this request." };
    }
    return { ok: true, bookingId: input.claim.bookingId };
}
/** Fields written when a verified claim succeeds. One booking only. */
function guestClaimPatch(uid) {
    return { uid, accountLinked: true };
}
