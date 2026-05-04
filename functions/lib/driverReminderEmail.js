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
exports.ADMIN_EMAIL = void 0;
exports.getTransporter = getTransporter;
exports.mailFrom = mailFrom;
exports.formatPhoneUK = formatPhoneUK;
exports.buildWhatsAppLink = buildWhatsAppLink;
exports.escapeHtml = escapeHtml;
exports.getPickupMs = getPickupMs;
exports.formatPickupTimeLabel = formatPickupTimeLabel;
exports.extractTripDetailsFromBooking = extractTripDetailsFromBooking;
exports.resolveDriver = resolveDriver;
exports.wrapSpiresEmailHtml = wrapSpiresEmailHtml;
exports.buildTripDetailsHtml = buildTripDetailsHtml;
exports.buildAdminDriverReminderHtml = buildAdminDriverReminderHtml;
exports.sendAdminDriverReminderEmail = sendAdminDriverReminderEmail;
exports.buildNoDriverAssignedHtml = buildNoDriverAssignedHtml;
exports.sendNoDriverAssignedWarning = sendNoDriverAssignedWarning;
exports.buildDriverManualReminderHtml = buildDriverManualReminderHtml;
exports.sendDriverManualReminderEmail = sendDriverManualReminderEmail;
exports.reminderConfigOk = reminderConfigOk;
const functions = __importStar(require("firebase-functions/v1"));
const nodemailer = __importStar(require("nodemailer"));
exports.ADMIN_EMAIL = "bookings@spires-taxis.com";
let transporter = null;
function getTransporter() {
    if (!transporter) {
        const config = functions.config();
        transporter = nodemailer.createTransport({
            host: config.smtp?.host || "smtp.ionos.co.uk",
            port: Number(config.smtp?.port || 587),
            secure: false,
            auth: {
                user: config.email?.user || "bookings@spires-taxis.com",
                pass: config.email?.pass,
            },
            tls: { rejectUnauthorized: false },
        });
    }
    return transporter;
}
function mailFrom() {
    const config = functions.config();
    const fromUser = config.email?.user || "bookings@spires-taxis.com";
    return `"Spires Taxis" <${fromUser}>`;
}
function formatPhoneUK(phone) {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) {
        clean = "44" + clean.slice(1);
    }
    return clean;
}
function buildWhatsAppLink(phone, message) {
    const cleanPhone = formatPhoneUK(phone);
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function getPickupMs(data) {
    const raw = data.pickupTime ?? data.dateTime;
    if (raw == null)
        return null;
    if (typeof raw === "object" &&
        raw !== null &&
        "toDate" in raw &&
        typeof raw.toDate === "function") {
        const d = raw.toDate();
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
}
function formatPickupTimeLabel(ms) {
    return new Date(ms).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
    });
}
function extractTripDetailsFromBooking(data, pickupMsKnown) {
    const pickupMs = pickupMsKnown !== undefined ? pickupMsKnown : getPickupMs(data);
    if (pickupMs == null)
        return null;
    return {
        pickupTime: formatPickupTimeLabel(pickupMs),
        pickup: (data.pickupLocation || data.pickup || "").toString().trim() || "—",
        dropoff: (data.destination || "").toString().trim() || "—",
        passengerName: (data.hirerName || data.name || "—").toString().trim() || "—",
    };
}
async function resolveDriver(db, cache, driverId) {
    if (cache.has(driverId))
        return cache.get(driverId);
    const snap = await db.collection("drivers").doc(driverId).get();
    if (!snap.exists) {
        const r = { status: "not_found" };
        cache.set(driverId, r);
        return r;
    }
    const d = snap.data() || {};
    const name = (d.name || "Driver").toString().trim() || "Driver";
    const phone = (d.phoneNumber || d.phone || "").toString().trim();
    if (!phone) {
        const r = { status: "no_phone", name };
        cache.set(driverId, r);
        return r;
    }
    const r = { status: "ok", driver: { name, phone } };
    cache.set(driverId, r);
    return r;
}
/** Colours aligned with admin PDF generator (pdfGenerator.ts). */
const BRAND = {
    navy: "#002147",
    gold: "#C5A572",
    slate: "#0f172a",
    cream: "#f7f4ec",
    creamPanel: "#f7f4e9",
    muted: "#666666",
    border: "#e5e7eb",
};
/** System stacks only — Gmail often strips webfont link tags; bgcolor helps Outlook. */
const FONT_SERIF = "Georgia,'Times New Roman',Times,serif";
const FONT_SANS = "'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
/**
 * Full HTML: table layout, bgcolor + inline styles (works in Gmail / Outlook / Apple Mail).
 */
function wrapSpiresEmailHtml(bannerTitle, mainInnerHtml, preheader) {
    const titleEsc = escapeHtml(bannerTitle);
    const pre = escapeHtml(preheader || `${bannerTitle} · Spires Taxis`);
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleEsc} · Spires Taxis</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#dce3ed;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader (hidden in inbox preview area) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#dce3ed;opacity:0;">
    ${pre}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#dce3ed" style="background-color:#dce3ed;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border-collapse:separate;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,33,71,0.12);border:1px solid ${BRAND.border};">
          <!-- Top bar -->
          <tr>
            <td bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};background-image:linear-gradient(165deg,#001a38 0%,#002147 45%,#0a3568 100%);padding:26px 24px 20px;text-align:center;">
              <div style="font-family:${FONT_SERIF};font-size:30px;font-weight:700;color:${BRAND.gold};letter-spacing:0.14em;line-height:1.15;text-shadow:0 1px 2px rgba(0,0,0,0.25);">SPIRES TAXIS</div>
              <div style="font-family:${FONT_SERIF};font-size:16px;font-style:italic;color:#e8eef5;margin-top:8px;line-height:1.3;">Your Oxford Journey Starts Here</div>
            </td>
          </tr>
          <!-- Gold rule -->
          <tr>
            <td bgcolor="${BRAND.gold}" height="5" style="height:5px;line-height:5px;font-size:0;background-color:${BRAND.gold};">&nbsp;</td>
          </tr>
          <!-- Banner -->
          <tr>
            <td bgcolor="${BRAND.cream}" style="background-color:${BRAND.cream};border-bottom:3px solid ${BRAND.slate};padding:16px 18px;text-align:center;">
              <span style="font-family:${FONT_SANS};font-weight:800;font-size:12px;letter-spacing:3px;color:${BRAND.slate};text-transform:uppercase;">${titleEsc}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td bgcolor="#ffffff" style="padding:26px 24px 20px;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:#1f2937;">
              ${mainInnerHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};background-image:linear-gradient(165deg,#001a38 0%,#002147 100%);padding:20px 24px;text-align:center;">
              <div style="font-family:${FONT_SERIF};font-size:15px;font-weight:600;color:${BRAND.gold};margin-bottom:10px;letter-spacing:0.06em;">Spires Taxis</div>
              <div style="font-family:${FONT_SANS};font-size:12px;color:#cbd5e1;line-height:1.75;">
                Oxford licensed private hire<br />
                <a href="tel:+447776897772" style="color:${BRAND.gold};text-decoration:none;font-weight:600;">07776 897772</a>
                <span style="color:#64748b;">&nbsp;·&nbsp;</span>
                <a href="mailto:bookings@spires-taxis.com" style="color:${BRAND.gold};text-decoration:none;">bookings@spires-taxis.com</a><br />
                <a href="https://www.spires-taxis.com" style="color:${BRAND.gold};text-decoration:none;">www.spires-taxis.com</a>
              </div>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function tripFieldRow(icon, label, value, isLast) {
    const border = isLast ? "" : `border-bottom:1px solid #e8e4dc;`;
    return `
    <tr>
      <td style="padding:14px 12px 14px 16px;vertical-align:top;width:52px;${border}">
        <span style="font-size:20px;line-height:1;">${icon}</span>
      </td>
      <td style="padding:14px 8px 14px 0;vertical-align:top;${border}">
        <div style="font-family:${FONT_SANS};font-size:11px;font-weight:700;letter-spacing:0.12em;color:${BRAND.muted};text-transform:uppercase;margin:0 0 4px;">${escapeHtml(label)}</div>
        <div style="font-family:${FONT_SANS};font-size:15px;font-weight:600;color:${BRAND.navy};line-height:1.45;">${escapeHtml(value)}</div>
      </td>
    </tr>`;
}
/** Trip block: card with shadow + icon rows (reads clearly in Gmail). */
function buildTripDetailsHtml(trip) {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${BRAND.creamPanel}" style="background-color:${BRAND.creamPanel};border-radius:10px;border:1px solid ${BRAND.border};border-left:4px solid ${BRAND.gold};margin:0 0 20px;box-shadow:0 4px 16px rgba(0,33,71,0.07);">
      <tr>
        <td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:16px 18px 12px;border-bottom:2px solid ${BRAND.gold};">
                <span style="font-family:${FONT_SERIF};font-size:17px;font-weight:700;color:${BRAND.navy};">Trip details</span>
              </td>
            </tr>
            ${tripFieldRow("🕐", "Time", trip.pickupTime, false)}
            ${tripFieldRow("📍", "Pickup", trip.pickup, false)}
            ${tripFieldRow("🏁", "Drop-off", trip.dropoff, false)}
            ${tripFieldRow("👤", "Passenger", trip.passengerName, true)}
          </table>
        </td>
      </tr>
    </table>`;
}
/** Admin email: trip + WhatsApp + Call — full branded document (matches PDF look). */
function buildAdminDriverReminderHtml(driver, trip) {
    const message = `Spires Taxis Job Reminder

Time: ${trip.pickupTime}
Pickup: ${trip.pickup}
Dropoff: ${trip.dropoff}
Passenger: ${trip.passengerName}`;
    const whatsappLink = buildWhatsAppLink(driver.phone, message);
    const telHref = `tel:${driver.phone}`;
    const inner = `
    <p style="margin:0 0 18px;font-family:${FONT_SANS};font-size:14px;color:#4b5563;line-height:1.55;">Use the buttons below to contact the assigned driver.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:18px;border:1px solid ${BRAND.border};border-radius:10px;box-shadow:0 2px 10px rgba(0,33,71,0.06);">
      <tr>
        <td style="padding:16px 18px;background-color:#faf8f5;border-radius:10px 10px 0 0;border-bottom:2px solid ${BRAND.gold};">
          <span style="font-family:${FONT_SERIF};font-size:15px;font-weight:700;color:${BRAND.navy};">Assigned driver</span>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px 18px;background-color:#ffffff;border-radius:0 0 10px 10px;">
          <p style="margin:0;font-family:${FONT_SANS};font-size:17px;color:${BRAND.navy};font-weight:700;">${escapeHtml(driver.name)}</p>
        </td>
      </tr>
    </table>
    ${buildTripDetailsHtml(trip)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:middle;">
          <a href="${whatsappLink.replace(/&/g, "&amp;")}" style="display:inline-block;background-color:#25D366;color:#ffffff;padding:14px 22px;text-decoration:none;border-radius:8px;font-family:${FONT_SANS};font-size:14px;font-weight:700;box-shadow:0 2px 6px rgba(37,211,102,0.35);">Message on WhatsApp</a>
        </td>
        <td style="padding:8px 0 8px 12px;vertical-align:middle;">
          <a href="${escapeHtml(telHref)}" style="display:inline-block;background-color:${BRAND.slate};color:#ffffff;padding:14px 22px;text-decoration:none;border-radius:8px;font-family:${FONT_SANS};font-size:14px;font-weight:700;">Call driver</a>
        </td>
      </tr>
    </table>
  `;
    return wrapSpiresEmailHtml("TRIP REMINDER", inner, `Trip reminder · ${trip.pickupTime}`);
}
async function sendAdminDriverReminderEmail(driver, trip) {
    await getTransporter().sendMail({
        from: mailFrom(),
        to: exports.ADMIN_EMAIL,
        subject: `🚖 Trip Reminder – ${trip.pickupTime}`,
        html: buildAdminDriverReminderHtml(driver, trip),
    });
}
function buildNoDriverAssignedHtml(params) {
    const { pickupTime, pickup, dropoff, passengerName, headline } = params;
    const trip = { pickupTime, pickup, dropoff, passengerName };
    const alertText = headline.replace(/\s*:\s*$/, "").trim();
    const inner = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fffbeb" style="background-color:#fffbeb;border-left:5px solid #d97706;border-radius:0 10px 10px 0;margin:0 0 22px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0;font-family:${FONT_SANS};font-size:14px;color:#92400e;line-height:1.55;font-weight:700;">${escapeHtml(alertText)}</p>
        </td>
      </tr>
    </table>
    ${buildTripDetailsHtml(trip)}
  `;
    return wrapSpiresEmailHtml("NO DRIVER ASSIGNED", inner, `Action needed: ${alertText}`);
}
async function sendNoDriverAssignedWarning(params) {
    const { pickupTime, pickup, dropoff, passengerName, headline } = params;
    await getTransporter().sendMail({
        from: mailFrom(),
        to: exports.ADMIN_EMAIL,
        subject: "⚠️ No Driver Assigned",
        html: buildNoDriverAssignedHtml({ pickupTime, pickup, dropoff, passengerName, headline }),
    });
}
/** Manual: email to driver — full branded layout (aligned with PDF / admin reminders). */
function buildDriverManualReminderHtml(driverName, trip) {
    const inner = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:22px;border-collapse:separate;">
      <tr>
        <td style="background-color:#f8fafc;border-left:4px solid ${BRAND.navy};border-radius:8px;padding:18px 20px;">
          <p style="margin:0;font-family:${FONT_SERIF};font-size:19px;font-weight:700;color:${BRAND.navy};line-height:1.3;">Dear ${escapeHtml(driverName)},</p>
          <p style="margin:10px 0 0;font-family:${FONT_SANS};font-size:15px;color:#374151;line-height:1.55;">Here is a reminder for your upcoming job.</p>
        </td>
      </tr>
    </table>
    ${buildTripDetailsHtml(trip)}
    <p style="margin:20px 0 0;font-family:${FONT_SANS};font-size:13px;color:${BRAND.muted};line-height:1.6;">Need help? Reply to this email or call the office on <a href="tel:+447776897772" style="color:${BRAND.navy};font-weight:700;text-decoration:none;">07776 897772</a>.</p>
  `;
    const pre = `Job reminder: ${trip.pickupTime} — ${trip.pickup.length > 60 ? `${trip.pickup.slice(0, 60)}…` : trip.pickup}`;
    return wrapSpiresEmailHtml("JOB REMINDER", inner, pre);
}
async function sendDriverManualReminderEmail(params) {
    const { to, driverName, bookingNumber, trip } = params;
    await getTransporter().sendMail({
        from: mailFrom(),
        to,
        subject: `🚖 Job reminder – ${trip.pickupTime} (${bookingNumber})`,
        html: buildDriverManualReminderHtml(driverName, trip),
    });
}
function reminderConfigOk() {
    return !!functions.config().email?.pass;
}
