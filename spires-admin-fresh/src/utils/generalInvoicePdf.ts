import {
  formatGbpHtml,
  formatUkDate,
  invoiceTotals,
  invoicePaymentTermsLabel,
  lineNet,
  lineTotal,
  lineVat,
  paymentDueNotice,
  GeneratedGeneralInvoice,
  InvoiceSupplierDetails,
} from "./generalInvoiceTypes";

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

export type GeneralInvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: GeneratedGeneralInvoice["paymentTerms"];
  customer: GeneratedGeneralInvoice["customer"];
  bookingNumber: string;
  travelDate: string;
  pickup: string;
  destination: string;
  lines: GeneratedGeneralInvoice["lines"];
  notes: string;
  supplier: InvoiceSupplierDetails;
};

/** A4 at 96dpi — same iframe width as booking confirmation PDFs. */
const A4_PX = { width: 794, height: 1122 };

function html2pdfOptions(filename: string): Record<string, unknown> {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = Math.min(4, Math.max(2.75, dpr * 2.2));
  return {
    margin: [0, 0, 0, 0],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: "#ffffff",
      imageTimeout: 20000,
      windowWidth: A4_PX.width,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };
}

const CAPTURE_CSS = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${A4_PX.width}px !important;
  }
  .booking-pdf-root.pdf-email-capture {
    font-size: 11px !important;
    line-height: 1.45 !important;
    -webkit-font-smoothing: antialiased;
    width: ${A4_PX.width}px !important;
    max-width: ${A4_PX.width}px !important;
  }
  .booking-pdf-root.pdf-email-capture .page-container {
    display: flex !important;
    flex-direction: column !important;
    width: ${A4_PX.width}px !important;
    min-height: ${A4_PX.height}px !important;
  }
  .booking-pdf-root.pdf-email-capture .main-content {
    flex: 1 1 auto !important;
  }
  .booking-pdf-root.pdf-email-capture .footer {
    margin-top: auto !important;
    flex: 0 0 auto !important;
  }
  .booking-pdf-root.pdf-email-capture .content-grid {
    display: table !important;
    width: 100% !important;
    table-layout: fixed !important;
    border-collapse: separate !important;
    border-spacing: 10px 0 !important;
    margin-bottom: 10px !important;
  }
  .booking-pdf-root.pdf-email-capture .content-grid > .info-box {
    display: table-cell !important;
    width: 50% !important;
    vertical-align: top !important;
    margin: 0 !important;
    float: none !important;
    grid-column: auto !important;
  }
  .booking-pdf-root.pdf-email-capture .info-box.full-width {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 0 10px 0 !important;
    float: none !important;
    grid-column: auto !important;
  }
  .booking-pdf-root.pdf-email-capture .info-box {
    box-shadow: none !important;
    border: 1.5px solid #e5e7eb !important;
  }
  .booking-pdf-root.pdf-email-capture .detail-row {
    display: flex !important;
    justify-content: space-between !important;
    gap: 8px !important;
    align-items: baseline !important;
  }
  .booking-pdf-root.pdf-email-capture .invoice-table {
    display: table !important;
    width: 100% !important;
    table-layout: fixed !important;
  }
  .booking-pdf-root.pdf-email-capture .header { padding: 16px 14px !important; }
  .booking-pdf-root.pdf-email-capture .logo-svg { width: 280px !important; height: 52px !important; }
  .booking-pdf-root.pdf-email-capture .logo-text { font-size: 30px !important; }
  .booking-pdf-root.pdf-email-capture .payment-summary,
  .booking-pdf-root.pdf-email-capture .header,
  .booking-pdf-root.pdf-email-capture .footer {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

export function buildGeneralInvoiceHtml(input: GeneralInvoicePdfInput): string {
  const totals = invoiceTotals(input.lines);
  const rows = input.lines
    .map((line) => {
      const vatLabel =
        line.vatRatePercent > 0
          ? `${formatGbpHtml(lineVat(line))} (${line.vatRatePercent.toFixed(0)}%)`
          : formatGbpHtml(0);
      return `
        <tr>
          <td>${esc(line.description || "Private hire journey")}</td>
          <td class="num">${line.quantity}</td>
          <td class="num">${formatGbpHtml(line.unitPrice)}</td>
          <td class="num">${formatGbpHtml(lineNet(line))}</td>
          <td class="num">${vatLabel}</td>
          <td class="num">${formatGbpHtml(lineTotal(line))}</td>
        </tr>`;
    })
    .join("");

  const fromLines = [
    esc(input.supplier.providerName || "Spires Taxis"),
    nl(input.supplier.address),
    esc(input.supplier.phone),
    esc(input.supplier.email),
    input.supplier.companyNumber ? `Company no. ${esc(input.supplier.companyNumber)}` : "",
    input.supplier.vatNumber ? `VAT ${esc(input.supplier.vatNumber)}` : "",
  ]
    .filter(Boolean)
    .join("<br>");

  const billToLines = [
    esc(input.customer.name),
    nl(input.customer.address),
    esc(input.customer.email),
    esc(input.customer.phone),
  ]
    .filter(Boolean)
    .join("<br>");

  const journeyRows = [
    input.bookingNumber
      ? `<div class="detail-row"><span class="detail-label">Booking</span><span class="detail-value">${esc(input.bookingNumber)}</span></div>`
      : "",
    input.travelDate
      ? `<div class="detail-row"><span class="detail-label">Travel date</span><span class="detail-value">${esc(formatUkDate(input.travelDate))}</span></div>`
      : "",
    input.pickup
      ? `<div class="detail-row"><span class="detail-label">Pickup</span><span class="detail-value">${esc(input.pickup)}</span></div>`
      : "",
    input.destination
      ? `<div class="detail-row"><span class="detail-label">Destination</span><span class="detail-value">${esc(input.destination)}</span></div>`
      : "",
  ].filter(Boolean);

  const journeyBox = journeyRows.length
    ? `<div class="info-box full-width">
         <h2 class="section-header">Journey</h2>
         ${journeyRows.join("")}
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${esc(input.invoiceNumber)}</title>
</head>
<body style="margin:0;padding:0;">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=block" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    .booking-pdf-root,
    .booking-pdf-root * { margin: 0; padding: 0; box-sizing: border-box; }
    .booking-pdf-root {
      font-family: 'Inter', sans-serif;
      color: #333;
      font-size: 10px;
      line-height: 1.4;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      min-height: 100vh;
      width: 100%;
    }
    .booking-pdf-root .page-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }
    @media print {
      .booking-pdf-root .page-container {
        display: flex !important;
        flex-direction: column !important;
        min-height: 297mm !important;
        height: auto !important;
      }
      .booking-pdf-root .main-content { flex: 1 1 auto !important; }
      .booking-pdf-root .footer { break-inside: avoid; page-break-inside: avoid; }
    }
    .booking-pdf-root .header {
      background: #002147;
      color: white;
      padding: 18px 20px 15px;
      position: relative;
      overflow: hidden;
      width: 100%;
      margin: 0;
      border-radius: 0;
    }
    .booking-pdf-root .header-content { display: flex; justify-content: center; }
    .booking-pdf-root .logo-section { text-align: center; }
    .booking-pdf-root .logo-svg { width: 320px; height: 60px; margin-bottom: 8px; }
    .booking-pdf-root .logo-text {
      font-family: 'Cinzel', serif;
      font-size: 35px;
      fill: #C5A572;
    }
    .booking-pdf-root .tagline {
      font-family: 'Playfair Display', serif;
      font-size: 0.95rem;
      opacity: 0.9;
      font-style: italic;
    }
    .booking-pdf-root .booking-ref {
      position: absolute;
      top: 18px;
      right: 20px;
    }
    .booking-pdf-root .booking-ref h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.1rem;
      padding: 6px 14px;
      border: 2px solid #C5A572;
      border-radius: 5px;
      background: rgba(197, 165, 114, 0.2);
    }
    .booking-pdf-root .main-content { padding: 0 20px 14px; flex: 1 1 auto; }
    .booking-pdf-root .document-banner {
      background: #f7f4ec;
      border-bottom: 3px solid #0f172a;
      padding: 14px 10px 12px;
      text-align: center;
      margin: 0 -20px 12px;
    }
    .booking-pdf-root .document-banner span {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      font-size: 1rem;
      letter-spacing: 1.5px;
      color: #0f172a;
    }
    .booking-pdf-root .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .booking-pdf-root .info-box {
      background: white;
      border: 1.5px solid #e5e7eb;
      border-radius: 6px;
      padding: 11px;
    }
    .booking-pdf-root .section-header {
      font-family: 'Playfair Display', serif;
      font-size: 0.9rem;
      font-weight: 700;
      color: #002147;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #C5A572;
    }
    .booking-pdf-root .detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .booking-pdf-root .detail-label { font-size: 0.8rem; color: #666; }
    .booking-pdf-root .detail-value { font-size: 0.9rem; color: #002147; text-align: right; }
    .booking-pdf-root .full-width { grid-column: span 2; }
    .booking-pdf-root .payment-summary {
      background: #002147;
      color: white;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .booking-pdf-root .payment-amount { font-size: 1.6rem; font-weight: 700; color: #C5A572; }
    .booking-pdf-root .payment-method { font-size: 0.9rem; opacity: 0.9; }
    .booking-pdf-root .invoice-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 4px 0 6px;
      font-size: 8px;
    }
    .booking-pdf-root .invoice-table th,
    .booking-pdf-root .invoice-table td {
      border: 1px solid #e5e7eb;
      padding: 4px 3px;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .booking-pdf-root .invoice-table th {
      background: #002147;
      color: #fff;
      font-weight: 600;
      text-align: left;
      font-size: 7px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .booking-pdf-root .invoice-table .num { text-align: right; white-space: nowrap; }
    .booking-pdf-root .invoice-table col.desc { width: 40%; }
    .booking-pdf-root .invoice-table col.qty { width: 10%; }
    .booking-pdf-root .invoice-table col.amt { width: 12.5%; }
    .booking-pdf-root .footer {
      background: #002147;
      color: white;
      padding: 12px 20px;
      text-align: center;
      border-radius: 0;
      margin: 0;
      margin-top: auto;
      width: 100%;
    }
    .booking-pdf-root .footer-brand {
      font-family: 'Cinzel', serif;
      color: #C5A572;
      margin-bottom: 6px;
    }
    .booking-pdf-root a { color: #C5A572; text-decoration: none; }
    .booking-pdf-root .notice {
      margin-top: 8px;
      padding: 8px 10px;
      border: 1px solid #C5A572;
      border-radius: 6px;
      background: #faf8f4;
      font-size: 0.75rem;
      line-height: 1.45;
      color: #002147;
      text-align: left;
    }
  </style>
  <div class="booking-pdf-root">
    <div class="page-container">
      <div class="header">
        <div class="booking-ref">
          <h2>${esc(input.invoiceNumber)}</h2>
        </div>
        <div class="header-content">
          <div class="logo-section">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 60" class="logo-svg">
              <text x="140" y="30" class="logo-text" text-anchor="middle">SPIRES TAXIS</text>
            </svg>
            <div class="tagline">Your Oxford Journey Starts Here</div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="document-banner">
          <span>INVOICE</span>
        </div>

        <div class="content-grid">
          <div class="info-box">
            <h2 class="section-header">From</h2>
            <div class="detail-value" style="text-align:left;line-height:1.5;">${fromLines}</div>
          </div>
          <div class="info-box">
            <h2 class="section-header">Bill to</h2>
            <div class="detail-value" style="text-align:left;line-height:1.5;">${billToLines}</div>
            <div class="detail-row" style="margin-top:8px;"><span class="detail-label">Invoice date</span><span class="detail-value">${esc(formatUkDate(input.invoiceDate))}</span></div>
            <div class="detail-row"><span class="detail-label">Payment terms</span><span class="detail-value">${esc(invoicePaymentTermsLabel(input.invoiceDate, input.dueDate))}</span></div>
            <div class="detail-row"><span class="detail-label">Due date</span><span class="detail-value">${esc(formatUkDate(input.dueDate))}</span></div>
          </div>
        </div>

        ${journeyBox}

        <div class="info-box full-width">
          <h2 class="section-header">Charges</h2>
          <table class="invoice-table">
            <colgroup>
              <col class="desc"><col class="qty"><col class="amt"><col class="amt"><col class="amt"><col class="amt">
            </colgroup>
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Qty</th>
                <th class="num">Unit price</th>
                <th class="num">Net</th>
                <th class="num">VAT</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="content-grid">
          <div class="info-box">
            <h2 class="section-header">Payment details</h2>
            <div class="detail-row"><span class="detail-label">Account name</span><span class="detail-value">${esc(input.supplier.accountName)}</span></div>
            <div class="detail-row"><span class="detail-label">Sort code</span><span class="detail-value">${esc(input.supplier.sortCode)}</span></div>
            <div class="detail-row"><span class="detail-label">Account number</span><span class="detail-value">${esc(input.supplier.accountNumber)}</span></div>
            <div class="detail-row"><span class="detail-label">Payment reference</span><span class="detail-value">${esc(input.invoiceNumber)}</span></div>
            <div class="notice">
              Please pay by bank transfer using the invoice number as the payment reference. ${esc(paymentDueNotice(input.invoiceDate, input.dueDate))}
            </div>
          </div>
          <div class="info-box">
            <h2 class="section-header">Amount due</h2>
            <div class="payment-summary">
              <div class="payment-amount">${formatGbpHtml(totals.total)}</div>
              <div class="payment-method">Total payable</div>
              <div style="margin-top:8px;font-size:0.8rem;opacity:0.95;">
                Net ${formatGbpHtml(totals.net)} · VAT ${formatGbpHtml(totals.vat)}
              </div>
            </div>
            ${
              input.notes
                ? `<div class="notice">${nl(input.notes)}</div>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-brand">SPIRES TAXIS</div>
        <div style="font-size: 0.75rem; margin-bottom: 4px;">
          <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a> •
          <a href="https://wa.me/447776897772" target="_blank">07776 897772</a> •
          <a href="https://www.spires-taxis.com" target="_blank">www.spires-taxis.com</a>
        </div>
        <div style="font-size: 0.65rem; opacity: 0.9; text-align: center; line-height: 1.3;">
          Licensed private hire operator · Oxford
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function withInvoicePdfDocument<T>(
  html: string,
  run: (doc: Document) => Promise<T>
): Promise<T> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    `position:fixed;left:-9999px;top:0;width:${A4_PX.width}px;height:${A4_PX.height}px;border:0;opacity:0;pointer-events:none;`;
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
    doc.querySelector(".booking-pdf-root")?.classList.add("pdf-email-capture");
    const fix = doc.createElement("style");
    fix.setAttribute("data-pdf-email-capture", "true");
    fix.textContent = CAPTURE_CSS;
    doc.body.appendChild(fix);

    await new Promise<void>((r) => setTimeout(r, 900));
    if (doc.fonts?.ready) {
      await doc.fonts.ready.catch(() => undefined);
    }
    await new Promise<void>((r) => setTimeout(r, 500));
    await new Promise<void>((r) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => r());
      });
    });

    return await run(doc);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}

export async function downloadGeneralInvoicePdf(input: GeneralInvoicePdfInput): Promise<void> {
  const html = buildGeneralInvoiceHtml(input);
  const html2pdf = (await import("html2pdf.js")).default;
  const filename = `Spires-Taxis-Invoice-${input.invoiceNumber}.pdf`;
  await withInvoicePdfDocument(html, async (doc) => {
    await html2pdf().set(html2pdfOptions(filename)).from(doc.body).save();
  });
}

export async function generateGeneralInvoicePdfBlob(input: GeneralInvoicePdfInput): Promise<Blob> {
  const html = buildGeneralInvoiceHtml(input);
  const html2pdf = (await import("html2pdf.js")).default;
  const filename = `Spires-Taxis-Invoice-${input.invoiceNumber}.pdf`;
  return withInvoicePdfDocument(html, async (doc) => {
    const blob = (await html2pdf().set(html2pdfOptions(filename)).from(doc.body).outputPdf("blob")) as Blob;
    return blob;
  });
}
