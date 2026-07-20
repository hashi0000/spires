/** Shared bank transfer details for invoices and customer UI */
export const SPIRES_BANK_DETAILS = {
  accountName: "Spires Taxis LTD",
  sortCode: "04-06-05",
  accountNumber: "27751218",
} as const;

export function isBankTransferMethod(method?: string | null): boolean {
  if (!method) return false;
  const n = method.toLowerCase().replace(/_/g, " ").trim();
  return n === "bank transfer" || n === "banktransfer" || n.includes("bank");
}

export function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return "To be confirmed";
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** HTML block for PDFs / emails when customer will pay by bank transfer */
export function bankTransferDetailsHtml(opts?: { unpaidOnly?: boolean; paymentStatus?: string }): string {
  if (opts?.unpaidOnly && opts.paymentStatus === "paid") return "";
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

export function bankTransferDetailsPlainText(): string {
  const { accountName, sortCode, accountNumber } = SPIRES_BANK_DETAILS;
  return [
    "Pay by bank transfer:",
    `Account name: ${accountName}`,
    `Sort code: ${sortCode}`,
    `Account number: ${accountNumber}`,
    "Please use your booking number as the payment reference.",
  ].join("\n");
}
