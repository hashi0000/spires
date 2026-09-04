import {
  formatGbp,
  invoiceTotals,
  lineNet,
  lineTotal,
  lineVat,
  SchoolInvoiceKind,
  SchoolInvoiceLine,
  SchoolSupplierDetails,
} from "./schoolInvoiceTypes";
import { OCC_FINANCE_EMAIL, formatUkDate, labelForServiceMonth } from "./schoolInvoiceTimetable";

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl(value: string): string {
  return esc(value).replace(/\n/g, "<br>");
}

export type SchoolInvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  kind: SchoolInvoiceKind;
  serviceMonth: string;
  lines: SchoolInvoiceLine[];
  notes: string;
  draft: boolean;
  supplier: SchoolSupplierDetails;
};

export function buildSchoolInvoiceHtml(input: SchoolInvoicePdfInput): string {
  const totals = invoiceTotals(input.lines);
  const kindLabel =
    input.kind === "social_care_one_off"
      ? "Social care one-off journeys"
      : "School transport — monthly contract";
  const draftBanner = input.draft
    ? `<div class="draft-banner">DRAFT — do not submit to the Council yet. Invoices sent before the earliest submission date will be rejected.</div>`
    : "";

  const rows = input.lines
    .map((line) => {
      return `
        <tr>
          <td>${esc(line.routeNumber)}</td>
          <td>${esc(line.description || "Home to school transport")}</td>
          <td class="num">${formatGbp(line.dailyPrice)}</td>
          <td class="num">${line.schoolDays}</td>
          <td class="num">${line.deductions ? formatGbp(line.deductions) : "—"}</td>
          <td class="num">${formatGbp(lineNet(line))}</td>
          <td class="num">${line.vatRatePercent.toFixed(1)}%</td>
          <td class="num">${formatGbp(lineVat(line))}</td>
          <td class="num">${formatGbp(lineTotal(line))}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${esc(input.invoiceNumber)}</title>
</head>
<body style="margin:0;padding:0;">
<style>
  @page { size: A4 portrait; margin: 12mm; }
  .inv-root, .inv-root * { box-sizing: border-box; }
  .inv-root {
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    color: #0b1c3d;
    font-size: 11px;
    line-height: 1.45;
    background: #fff;
    width: 100%;
  }
  .inv-root .header {
    background: #002147;
    color: #fff;
    padding: 18px 20px 16px;
  }
  .inv-root .brand {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 22px;
    letter-spacing: 0.04em;
    color: #C5A572;
    margin: 0 0 4px;
  }
  .inv-root .header-meta { font-size: 10px; opacity: 0.92; }
  .inv-root .doc-title {
    background: #f7f4ec;
    border-bottom: 3px solid #002147;
    text-align: center;
    padding: 10px;
    font-weight: 800;
    letter-spacing: 1.4px;
    font-size: 13px;
  }
  .inv-root .pad { padding: 14px 18px; }
  .inv-root .grid-2 {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  .inv-root .grid-2 td {
    width: 50%;
    vertical-align: top;
    padding: 0 10px 0 0;
  }
  .inv-root .box {
    border: 1px solid #d6d3cd;
    border-radius: 6px;
    padding: 10px 12px;
    min-height: 92px;
  }
  .inv-root .box h2 {
    margin: 0 0 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #C5A572;
  }
  .inv-root table.lines {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px;
  }
  .inv-root table.lines th,
  .inv-root table.lines td {
    border: 1px solid #d6d3cd;
    padding: 6px 7px;
    text-align: left;
  }
  .inv-root table.lines th {
    background: #002147;
    color: #fff;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .inv-root .num { text-align: right; white-space: nowrap; }
  .inv-root .totals {
    width: 280px;
    margin-left: auto;
    border-collapse: collapse;
  }
  .inv-root .totals td {
    padding: 5px 0;
  }
  .inv-root .totals .grand {
    font-size: 13px;
    font-weight: 800;
    border-top: 2px solid #002147;
    padding-top: 8px;
  }
  .inv-root .notice {
    background: #fff8eb;
    border: 1px solid #C5A572;
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 12px;
    font-size: 9.5px;
  }
  .inv-root .footer {
    margin-top: 16px;
    font-size: 9px;
    color: #444;
  }
  .inv-root .draft-banner {
    background: #b45309;
    color: #fff;
    text-align: center;
    font-weight: 700;
    padding: 8px;
    letter-spacing: 0.04em;
  }
</style>
<div class="inv-root">
  <div class="header">
    <p class="brand">${esc(input.supplier.providerName || "Spires Taxis")}</p>
    <div class="header-meta">
      ${nl(input.supplier.address)}<br>
      ${esc(input.supplier.phone)} · ${esc(input.supplier.email)}
      ${input.supplier.companyNumber ? `<br>Company number: ${esc(input.supplier.companyNumber)}` : ""}
      ${input.supplier.vatNumber ? `<br>VAT number: ${esc(input.supplier.vatNumber)}` : ""}
    </div>
  </div>
  ${draftBanner}
  <div class="doc-title">TAX INVOICE · ${esc(kindLabel).toUpperCase()}</div>
  <div class="pad">
    <table class="grid-2">
      <tr>
        <td>
          <div class="box">
            <h2>Bill to</h2>
            Oxfordshire County Council<br>
            School Transport Finance<br>
            ${esc(OCC_FINANCE_EMAIL)}
          </div>
        </td>
        <td>
          <div class="box">
            <h2>Invoice</h2>
            Invoice number: <strong>${esc(input.invoiceNumber)}</strong><br>
            Invoice date: ${esc(formatUkDate(input.invoiceDate))}<br>
            Service period: ${esc(labelForServiceMonth(input.serviceMonth))}<br>
            Submitted monthly in arrears
          </div>
        </td>
      </tr>
    </table>

    <table class="lines">
      <thead>
        <tr>
          <th>Route no.</th>
          <th>Description</th>
          <th class="num">Daily price</th>
          <th class="num">School days</th>
          <th class="num">Deductions</th>
          <th class="num">Net</th>
          <th class="num">VAT rate</th>
          <th class="num">VAT</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td>Net total</td><td class="num">${formatGbp(totals.net)}</td></tr>
      <tr><td>VAT total</td><td class="num">${formatGbp(totals.vat)}</td></tr>
      <tr class="grand"><td>Total payable</td><td class="num">${formatGbp(totals.total)}</td></tr>
    </table>

    <div class="box" style="margin-top:14px;min-height:auto;">
      <h2>Payment details</h2>
      Account name: ${esc(input.supplier.accountName)}<br>
      Sort code: ${esc(input.supplier.sortCode)}<br>
      Account number: ${esc(input.supplier.accountNumber)}<br>
      Payment reference: ${esc(input.invoiceNumber)}
    </div>

    ${
      input.notes
        ? `<div class="box" style="margin-top:10px;min-height:auto;"><h2>Notes</h2>${nl(input.notes)}</div>`
        : ""
    }

    <div class="notice">
      This invoice does not include children’s names. School days claimed are the days operated in the service month, after contractual deductions or cancellations.
      Bank details on this invoice must match the supplier account held by the Council. Payment is due within 28 days of receipt and agreement of a valid invoice.
    </div>
    <div class="footer">
      Licensed private hire operator. All journeys are pre-booked. Academic year 2026/2027 DPS invoicing — PDF invoices to ${esc(
        OCC_FINANCE_EMAIL
      )} unless paid through the Digital Contract Management System.
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function downloadSchoolInvoicePdf(input: SchoolInvoicePdfInput): Promise<void> {
  const html = buildSchoolInvoiceHtml(input);
  const html2pdf = (await import("html2pdf.js")).default;
  const filename = `${input.supplier.providerName.replace(/\s+/g, "-")}-Invoice-${input.invoiceNumber}.pdf`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;min-height:1123px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create PDF frame");
  }
  doc.open();
  doc.write(html);
  doc.close();

  try {
    await new Promise<void>((r) => setTimeout(r, 400));
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 794,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(doc.body)
      .save();
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}
