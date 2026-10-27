import * as functions from "firebase-functions/v1";
import { ADMIN_EMAIL, getTransporter, mailFrom, reminderConfigOk } from "../driverReminderEmail";
import { BUSINESS_ENQUIRY_SUBJECT, businessEnquiryHtml, validateBusinessEnquiry } from "./enquiry";

function setCors(res: functions.Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

export const submitBusinessAccountEnquiry = functions.https.onRequest(async (req, res) => {
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
    const result = validateBusinessEnquiry((req.body || {}) as Record<string, unknown>);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    if (result.spam) {
      res.json({ ok: true });
      return;
    }
    if (!reminderConfigOk()) {
      functions.logger.error("business enquiry email is not configured");
      res.status(500).json({ error: "We could not send your enquiry. Please call or WhatsApp us." });
      return;
    }
    const info = await getTransporter().sendMail({
      from: mailFrom(),
      to: ADMIN_EMAIL,
      replyTo: result.value.email,
      subject: BUSINESS_ENQUIRY_SUBJECT,
      html: businessEnquiryHtml(result.value),
    });
    functions.logger.info("business enquiry sent", { messageId: String(info.messageId || "") });
    res.json({ ok: true });
  } catch (err) {
    functions.logger.error("business enquiry failed", err);
    res.status(500).json({ error: "We could not send your enquiry. Please call or WhatsApp us." });
  }
});
