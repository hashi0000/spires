// utils/pdfGenerator.ts - Booking PDF Generator
import { Booking, Driver, Vehicle } from "../types/types";

export type AdminPDFType = "booking_confirmation" | "payment_request" | "payment_receipt";

const getDocumentTitle = (type: AdminPDFType = "booking_confirmation") => {
  switch (type) {
    case "payment_request":
      return "Payment Request";
    case "payment_receipt":
      return "Payment Receipt";
    default:
      return "Booking Confirmation";
  }
};

export function buildBookingConfirmationHtml(
  booking: Booking,
  driver?: Driver,
  vehicle?: Vehicle,
  type: AdminPDFType = "booking_confirmation"
): string {
  const formatPaymentMethod = (method?: string) => {
    if (!method) return "CASH";
    return method.replace(/_/g, " ").toUpperCase();
  };

  // ---------------------------
  // PAYMENT LOGIC
  // ---------------------------

  const hasFare =
    typeof booking.actualFare === "number" &&
    !Number.isNaN(booking.actualFare);

  const isCompleted = booking.status === "completed";
  const isPaid = booking.paymentStatus === "paid";
  const isPartial = booking.paymentStatus === "partial";
  const isPaymentReceipt = type === "payment_receipt";
  const isPaymentRequest = type === "payment_request";

  const paymentAmount = hasFare
    ? `£${booking.actualFare!.toFixed(2)}`
    : "TBC";

  let paymentText: string;

  // If this is a payment request, always show payment request message
  if (isPaymentRequest && hasFare) {
    paymentText = `Payment Required - ${formatPaymentMethod(booking.paymentMethod)}`;
  } else if ((isCompleted && isPaid && hasFare) || (isPaymentReceipt && hasFare)) {
    paymentText = `Paid by ${formatPaymentMethod(booking.paymentMethod)}`;
  } else if (hasFare && isPartial) {
    paymentText = `Partially paid by ${formatPaymentMethod(
      booking.paymentMethod
    )}`;
  } else {
    paymentText = `To be paid by ${formatPaymentMethod(booking.paymentMethod)}`;
  }

  // ---------------------------
  // CLEAN CUSTOMER WHATSAPP LINK (Option C)
  // ---------------------------

  const formattedWhatsAppLink = `https://wa.me/${booking.hirerPhone.replace(
    /[^0-9]/g,
    ""
  )}`;

  const documentTitle = getDocumentTitle(type);
  const documentTitleUpper = documentTitle.toUpperCase();

  // ---------------------------
  // HTML TEMPLATE
  // ---------------------------

  const pdfContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${documentTitle} - ${booking.bookingNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=block" rel="stylesheet">

        <style>
            /* Zero page margins: mobile “Save as PDF” often can’t remove margins; html2pdf + @page stay edge-to-edge A4 */
            @page { size: A4 portrait; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
                font-family: 'Inter', sans-serif;
                color: #333;
                font-size: 10px;
                line-height: 1.4;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .page-container { display: flex; flex-direction: column; min-height: 100vh; }

            .header {
                background: #002147;
                color: white;
                padding: 18px 20px 15px;
                position: relative;
                overflow: hidden;
            }

            .header-content { display: flex; justify-content: center; }
            .logo-section { text-align: center; }

            .logo-svg { width: 320px; height: 60px; margin-bottom: 8px; }
            .logo-text {
                font-family: 'Cinzel', serif;
                font-size: 35px;
                fill: #C5A572;
            }

            .tagline {
                font-family: 'Playfair Display', serif;
                font-size: 0.95rem;
                opacity: 0.9;
                font-style: italic;
            }

            .booking-ref {
                position: absolute;
                top: 18px;
                right: 20px;
            }

            .booking-ref h2 {
                font-family: 'Playfair Display', serif;
                font-size: 1.1rem;
                padding: 6px 14px;
                border: 2px solid #C5A572;
                border-radius: 5px;
                background: rgba(197, 165, 114, 0.2);
            }

            .main-content { padding: 0 20px 14px; flex: 1; }

            .document-banner {
                background: #f7f4ec;
                border-bottom: 3px solid #0f172a;
                padding: 14px 10px 12px;
                text-align: center;
                margin: 0 -20px 12px;
            }

            .document-banner span {
                font-family: 'Inter', sans-serif;
                font-weight: 800;
                font-size: 1rem;
                letter-spacing: 1.5px;
                color: #0f172a;
            }

            .content-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 10px;
            }

            .info-box {
                background: white;
                border: 1.5px solid #e5e7eb;
                border-radius: 6px;
                padding: 11px;
            }

            .section-header {
                font-family: 'Playfair Display', serif;
                font-size: 0.9rem;
                font-weight: 700;
                color: #002147;
                margin-bottom: 8px;
                padding-bottom: 4px;
                border-bottom: 1.5px solid #C5A572;
            }

            .detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .detail-label { font-size: 0.8rem; color: #666; }
            .detail-value { font-size: 0.9rem; color: #002147; text-align: right; }

            .full-width { grid-column: span 2; }

            .journey-section {
                background: #f7f4e9;
                border-radius: 6px;
                padding: 12px;
                border-left: 3px solid #C5A572;
            }

            .journey-flow {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 8px 0;
            }

            .journey-point { flex: 1; text-align: center; }
            .journey-arrow { font-size: 1.2rem; color: #C5A572; }

            .payment-summary {
                background: #002147;
                color: white;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
            }

            .payment-summary.payment-request {
                background: #92400e;
                border: 2px solid #C5A572;
            }

            .payment-amount { font-size: 1.6rem; font-weight: 700; color: #C5A572; }
            .payment-method { font-size: 0.9rem; opacity: 0.9; }

            .footer {
                background: #002147;
                color: white;
                padding: 10px 16px;
                text-align: center;
                border-radius: 6px;
                margin: 8px 20px 10px;
            }

            .footer-brand {
                font-family: 'Cinzel', serif;
                color: #C5A572;
                margin-bottom: 6px;
            }

            a { color: #C5A572; text-decoration: none; }
        </style>
    </head>

    <body>
        <div class="page-container">

            <div class="header">
                <div class="booking-ref">
                    <h2>${booking.bookingNumber}</h2>
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
                    <span>${documentTitleUpper}</span>
                </div>

                <div class="content-grid">

                    <div class="info-box">
                        <h2 class="section-header">Trip Information</h2>

                        <div class="detail-row">
                            <span class="detail-label">Trip Date</span>
                            <span class="detail-value">
                                ${new Date(booking.pickupTime).toLocaleDateString("en-GB")}
                            </span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Pickup Time</span>
                            <span class="detail-value">
                                ${new Date(booking.pickupTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Booking Method</span>
                            <span class="detail-value">${booking.bookingMethod.replace("_", " ").toUpperCase()}</span>
                        </div>
                    </div>

                    <div class="info-box">
                        <h2 class="section-header">Customer Details</h2>

                        <div class="detail-row">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${booking.hirerName}</span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">
                                <a href="${formattedWhatsAppLink}" target="_blank">
                                    ${booking.hirerPhone}
                                </a>
                            </span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Address</span>
                            <span class="detail-value">${booking.hirerAddress}</span>
                        </div>

                    </div>

                </div>

                <div class="info-box full-width">

                    <h2 class="section-header">Journey Details</h2>

                    <div class="journey-section">
                        <div class="journey-flow">

                            <div class="journey-point">
                                <div class="journey-time">
                                    ${new Date(booking.pickupTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                <div class="journey-location">${booking.pickupLocation}</div>
                            </div>

                            <div class="journey-arrow">→</div>

                            <div class="journey-point">
                                <div class="journey-location">${booking.destination}</div>
                            </div>

                        </div>
                    </div>

                </div>

                <div class="content-grid">

                    ${
                      driver || vehicle
                        ? `
                    <div class="info-box">
                        <h2 class="section-header">Your Driver</h2>

                        <div class="detail-row">
                            <span class="detail-label">Driver</span>
                            <span class="detail-value">${driver ? driver.name : "Not assigned"}</span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">${
                              vehicle ? `${vehicle.make} ${vehicle.model}` : "Not assigned"
                            }</span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Colour</span>
                            <span class="detail-value">${vehicle ? vehicle.color : "Not assigned"}</span>
                        </div>

                        <div class="detail-row">
                            <span class="detail-label">Registration</span>
                            <span class="detail-value">${vehicle ? vehicle.registration : "Not assigned"}</span>
                        </div>
                    </div>`
                        : ""
                    }

                    <div class="info-box">
                        <h2 class="section-header">${documentTitle}</h2>

                        <div class="payment-summary ${isPaymentRequest ? "payment-request" : ""}">
                            <div class="payment-amount">${paymentAmount}</div>
                            <div class="payment-method">${paymentText}</div>
                            ${type === "payment_request" && hasFare ? `
                            <div style="margin-top: 10px; font-size: 0.85rem; opacity: 0.95;">
                                Please arrange payment for this booking. Contact us to pay by cash, card, or other methods.
                            </div>
                            ` : ""}
                        </div>
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
                    <span>⭐ We'd love your feedback! </span>
                    <a href="https://g.page/r/CWu0N7lUD-YKEAI/review" target="_blank" style="color: #4285F4; text-decoration: underline; font-weight: 600;">📝 Leave a Review on Google</a>
                </div>

            </div>

        </div>
    </body>
    </html>
  `;

  return pdfContent;
}

export const generateBookingConfirmationPDF = (
  booking: Booking,
  driver?: Driver,
  vehicle?: Vehicle,
  type: AdminPDFType = "booking_confirmation"
) => {
  const pdfContent = buildBookingConfirmationHtml(booking, driver, vehicle, type);

  // ---------------------------
  // PRINT OR FALLBACK DOWNLOAD
  // ---------------------------

  const printWindow = window.open("", "_blank");

  if (printWindow) {
    printWindow.document.write(pdfContent);
    printWindow.document.close();

    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  } else {
    const blob = new Blob([pdfContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `booking-${booking.bookingNumber}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * html2canvas (used by html2pdf) renders CSS grid/flex poorly. These overrides flatten layout
 * only while we capture for email — print / on-screen preview stay unchanged (no class on body).
 */
const PDF_EMAIL_CAPTURE_CSS = `
  body.pdf-email-capture {
    font-size: 11px !important;
    line-height: 1.45 !important;
    -webkit-font-smoothing: antialiased;
  }
  body.pdf-email-capture .page-container { min-height: auto !important; }
  body.pdf-email-capture .content-grid {
    display: block !important;
    width: 100% !important;
    margin-bottom: 10px !important;
  }
  body.pdf-email-capture .content-grid > .info-box,
  body.pdf-email-capture .info-box.full-width {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 0 10px 0 !important;
    float: none !important;
    grid-column: auto !important;
  }
  body.pdf-email-capture .info-box {
    box-shadow: none !important;
    border: 1.5px solid #e5e7eb !important;
  }
  body.pdf-email-capture .detail-row {
    display: flex !important;
    justify-content: space-between !important;
    gap: 8px !important;
    align-items: baseline !important;
  }
  body.pdf-email-capture .journey-flow {
    display: table !important;
    width: 100% !important;
    table-layout: fixed !important;
    border-collapse: separate !important;
    border-spacing: 6px 0 !important;
  }
  body.pdf-email-capture .journey-point {
    display: table-cell !important;
    width: 42% !important;
    vertical-align: middle !important;
    text-align: center !important;
  }
  body.pdf-email-capture .journey-arrow {
    display: table-cell !important;
    width: 16% !important;
    vertical-align: middle !important;
    text-align: center !important;
    font-size: 1.25rem !important;
  }
  body.pdf-email-capture .header { padding: 16px 14px !important; }
  body.pdf-email-capture .logo-svg { width: 280px !important; height: 52px !important; }
  body.pdf-email-capture .logo-text { font-size: 30px !important; }
  body.pdf-email-capture .payment-summary,
  body.pdf-email-capture .header,
  body.pdf-email-capture .footer {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

function buildHtml2PdfOptions(): Record<string, unknown> {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = Math.min(4, Math.max(2.75, dpr * 2.2));
  return {
    margin: [0, 0, 0, 0],
    filename: "booking.pdf",
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
      windowWidth: 794,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };
}

/**
 * Renders the same HTML as print/download, converts to a real PDF in-browser (html2pdf.js),
 * for emailing via Cloud Functions + Storage without duplicating the template server-side.
 */
export async function generateBookingConfirmationPdfBlob(
  booking: Booking,
  driver?: Driver,
  vehicle?: Vehicle,
  type: AdminPDFType = "booking_confirmation"
): Promise<Blob> {
  const html = buildBookingConfirmationHtml(booking, driver, vehicle, type);
  const html2pdf = (await import("html2pdf.js")).default;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:794px;min-height:1123px;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      reject(new Error("Could not create print frame"));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    const run = async () => {
      try {
        doc.body.classList.add("pdf-email-capture");
        const fix = doc.createElement("style");
        fix.setAttribute("data-pdf-email-capture", "true");
        fix.textContent = PDF_EMAIL_CAPTURE_CSS;
        doc.head.appendChild(fix);

        await new Promise<void>((r) => setTimeout(() => r(), 900));
        if (doc.fonts?.ready) {
          await doc.fonts.ready.catch(() => undefined);
        }
        await new Promise<void>((r) => setTimeout(() => r(), 500));
        await new Promise<void>((r) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => r());
          });
        });

        const blob = (await html2pdf().set(buildHtml2PdfOptions()).from(doc.body).outputPdf("blob")) as Blob;
        resolve(blob);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        cleanup();
      }
    };

    void run();
  });
}
