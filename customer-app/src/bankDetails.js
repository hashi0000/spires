/** Shared bank transfer details for customer portal + PDFs */
export const SPIRES_BANK_DETAILS = {
  accountName: "Spires Taxis LTD",
  sortCode: "04-06-05",
  accountNumber: "27751218",
};

export function isBankTransferMethod(method) {
  if (!method) return false;
  const n = String(method).toLowerCase().replace(/_/g, " ").trim();
  return n === "bank transfer" || n.includes("bank");
}

export function formatPaymentMethodLabel(method) {
  const raw = String(method || "").trim();
  const n = raw.toLowerCase().replace(/_/g, " ");
  if (!raw) return "To be confirmed";
  if (n === "tbc") return "TBC";
  if (n === "undecided") return "Not decided yet";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function confirmationPaymentLabel(method) {
  const raw = String(method || "").trim();
  const n = raw.toLowerCase().replace(/_/g, " ");
  if (!raw) return "TO BE CONFIRMED";
  if (n === "tbc") return "TBC";
  if (n === "undecided") return "NOT DECIDED YET";
  return raw.replace(/_/g, " ").toUpperCase();
}

export function bankTransferDetailsHtml(paymentStatus) {
  if (paymentStatus === "paid") return "";
  const { accountName, sortCode, accountNumber } = SPIRES_BANK_DETAILS;
  return `
    <div style="margin-top:12px;padding:12px;border:1px solid #C5A572;border-radius:8px;background:#faf8f4;font-size:0.9rem;line-height:1.5;">
      <div style="font-weight:600;color:#002147;margin-bottom:6px;">Pay by bank transfer</div>
      <div><strong>Account name:</strong> ${accountName}</div>
      <div><strong>Sort code:</strong> ${sortCode}</div>
      <div><strong>Account number:</strong> ${accountNumber}</div>
      <div style="margin-top:6px;font-size:0.85rem;color:#555;">Please use your booking number as the payment reference.</div>
    </div>
  `;
}
