export const BUSINESS_ENQUIRY_SUBJECT = "New Business Account Enquiry";

const ORGANISATION_TYPES = new Set(["", "business", "hotel", "school", "agency", "other"]);

const ORGANISATION_LABELS: Record<string, string> = {
  business: "Business",
  hotel: "Hotel or serviced apartment",
  school: "School, college or student organisation",
  agency: "Travel agency or event organiser",
  other: "Other",
};

export type BusinessEnquiry = {
  organisation: string;
  name: string;
  email: string;
  phone: string;
  organisationType: string;
  travelNeeds: string;
  message: string;
};

export type BusinessEnquiryResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: BusinessEnquiry }
  | { ok: false; error: string };

function text(value: unknown, max: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.slice(0, max);
}

export function organisationTypeLabel(value: string): string {
  return ORGANISATION_LABELS[value] || "Not given";
}

export function validateBusinessEnquiry(body: Record<string, unknown>): BusinessEnquiryResult {
  if (text(body._gotcha, 200)) return { ok: true, spam: true };

  const organisation = text(body.organisation, 120);
  const name = text(body.name, 80);
  const email = text(body.email, 120);
  const phone = text(body.phone, 30);
  const organisationType = text(body.organisationType, 40);
  const travelNeeds = text(body.travelNeeds, 1500);
  const message = text(body.message, 2000);
  const digits = phone.replace(/\D/g, "");

  if (organisation.length < 2) return { ok: false, error: "Enter the company or organisation name." };
  if (name.length < 2) return { ok: false, error: "Enter the contact name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (digits.length < 8 || digits.length > 15) return { ok: false, error: "Enter a phone number we can call or message." };
  if (!ORGANISATION_TYPES.has(organisationType)) return { ok: false, error: "Choose an organisation type from the list." };
  if (travelNeeds.length < 10) return { ok: false, error: "Tell us a little about the journeys you expect." };

  return {
    ok: true,
    spam: false,
    value: { organisation, name, email, phone, organisationType, travelNeeds, message },
  };
}

export function businessEnquiryHtml(value: BusinessEnquiry): string {
  const row = (label: string, content: string) =>
    `<p style="margin:0 0 10px;"><strong>${label}</strong><br>${content}</p>`;
  return `<div style="font-family:Georgia,serif;color:#1a2332;background:#f4f7fa;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e9ef;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;color:#b8956a;font-size:13px;letter-spacing:0.04em;">SPIRES TAXIS</p>
      <h1 style="color:#002147;font-size:22px;margin:0 0 12px;">New business account enquiry</h1>
      <p>This is an enquiry. It does not open an account or confirm a booking.</p>
      ${row("Organisation", escape(value.organisation))}
      ${row("Contact", escape(value.name))}
      ${row("Email", escape(value.email))}
      ${row("Phone", escape(value.phone))}
      ${row("Organisation type", escape(organisationTypeLabel(value.organisationType)))}
      ${row("Travel needs", escape(value.travelNeeds).replace(/\n/g, "<br>"))}
      ${value.message ? row("Additional information", escape(value.message).replace(/\n/g, "<br>")) : ""}
    </div>
  </div>`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
