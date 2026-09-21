// Customer PDF Generator - Professional HTML-based PDF with clickable links
// Matches admin app style with WhatsApp integration

import { bankTransferDetailsHtml, isBankTransferMethod } from "./bankDetails";
import { formatVehicleTypeLabel } from "./vehicleTypes";
import {
  AIRPORT_WAITING_POLICY,
  airportWaitingDisclaimerBody,
  airportWaitingDisclaimerTitle,
  bookingHasAirportCollection,
} from "./airportWaitingPolicy";

const getDocumentTitle = (type = "booking_confirmation") => {
  switch (type) {
    case "payment_request":
      return "Payment Request";
    case "payment_receipt":
      return "Payment Receipt";
    case "booking_confirmation":
    case "confirmation":
    default:
      return "Booking Confirmation";
  }
};

export const generateBookingPDF = (
  booking,
  fileName = null,
  driver = null,
  vehicle = null,
  type = "booking_confirmation"
) => {
  // Helper functions
  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    let date;
    if (dateValue.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue);
    } else {
      date = dateValue;
    }
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return "N/A";
    let date;
    if (dateValue.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue);
    } else {
      date = dateValue;
    }
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return "N/A";
    let date;
    if (dateValue.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue);
    } else {
      date = dateValue;
    }
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format phone for WhatsApp
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return "";
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");
    // If starts with 0, replace with 44
    if (digits.startsWith("0")) {
      return "44" + digits.substring(1);
    }
    // If already has country code, return as is
    if (digits.startsWith("44")) {
      return digits;
    }
    // Otherwise assume UK and add 44
    return "44" + digits;
  };

  const bookingRef = booking.id ? `CUST${booking.id.slice(0, 6).toUpperCase()}` : "N/A";
  const customerPhone = booking.phone || "";
  const whatsappLink = customerPhone 
    ? `https://wa.me/${formatPhoneForWhatsApp(customerPhone)}`
    : "#";
  const callLink = customerPhone ? `tel:${customerPhone}` : "#";

  const documentTitle = getDocumentTitle(type);
  const documentTitleUpper = documentTitle.toUpperCase();

  const pdfContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${documentTitle} - ${bookingRef}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
            @page {
                size: A4 portrait;
                margin: 10mm;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            html, body {
                height: 100%;
                margin: 0;
                padding: 0;
            }
            
            body {
                font-family: 'Inter', sans-serif;
                color: #333;
                font-size: 10px;
                line-height: 1.4;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                display: flex;
                flex-direction: column;
            }
            
            .page-container {
                display: flex;
                flex-direction: column;
                min-height: 100vh;
            }
            
            .header {
                background: linear-gradient(135deg, #002147 0%, #003366 100%);
                color: white;
                padding: 18px 20px 15px;
                position: relative;
                overflow: hidden;
                flex-shrink: 0;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -40px;
                right: -40px;
                width: 150px;
                height: 150px;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M50 150 L70 50 L90 150 M110 150 L130 30 L150 150" stroke="%23C5A572" stroke-width="3" fill="none" opacity="0.3"/></svg>');
                background-size: contain;
                background-repeat: no-repeat;
            }
            
            .header-content {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .logo-section {
                text-align: center;
            }
            
            .logo-svg {
                width: 320px;
                height: 60px;
                margin-bottom: 8px;
            }
            
            .logo-svg .logo-text {
                font-family: 'Cinzel', serif;
                font-size: 35px;
                font-weight: 400;
                fill: #C5A572;
                letter-spacing: 1px;
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
                font-weight: 700;
                font-size: 1.1rem;
                letter-spacing: 0.5px;
                color: white;
                background: rgba(197, 165, 114, 0.2);
                padding: 6px 14px;
                border-radius: 5px;
                border: 2px solid #C5A572;
            }
            
            .main-content {
                padding: 0 20px 14px;
                flex: 1;
            }

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
                box-shadow: 0 1px 4px rgba(0, 33, 71, 0.08);
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
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                padding: 1px 0;
            }
            
            .detail-row:last-child {
                margin-bottom: 0;
            }
            
            .detail-label {
                font-size: 0.8rem;
                font-weight: 500;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            .detail-value {
                font-size: 0.9rem;
                font-weight: 500;
                color: #002147;
                text-align: right;
                max-width: 58%;
            }
            
            .contact-links {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }
            
            .contact-link {
                display: inline-block;
                padding: 4px 10px;
                background: #25D366;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                transition: background 0.2s;
            }
            
            .contact-link:hover {
                background: #20BA5A;
            }
            
            .contact-link.call {
                background: #1d3c74;
            }
            
            .contact-link.call:hover {
                background: #152a5a;
            }
            
            .journey-section {
                background: #f7f4e9;
                border-radius: 6px;
                padding: 12px;
                border-left: 3px solid #C5A572;
                margin-top: 6px;
            }
            
            .journey-flow {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 8px 0;
                text-align: center;
            }
            
            .journey-point {
                flex: 1;
            }
            
            .journey-time {
                font-weight: 600;
                color: #002147;
                font-size: 0.95rem;
                margin-bottom: 5px;
            }
            
            .journey-location {
                font-size: 0.85rem;
                color: #555;
                font-weight: 500;
            }
            
            .journey-arrow {
                color: #C5A572;
                font-size: 1.2rem;
                flex-shrink: 0;
            }
            
            .full-width {
                grid-column: 1 / -1;
            }
            
            .payment-summary {
                background: #002147;
                color: white;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
            }
            
            .payment-amount {
                font-size: 1.6rem;
                font-weight: 700;
                color: #C5A572;
                margin-bottom: 6px;
            }
            
            .payment-method {
                font-size: 0.9rem;
                opacity: 0.9;
            }
            
            .footer {
                background: #002147;
                color: white;
                padding: 10px 16px;
                text-align: center;
                border-radius: 6px;
                margin: 8px 20px 10px;
                flex-shrink: 0;
            }
            
            .footer-brand {
                font-family: 'Cinzel', serif;
                font-size: 1rem;
                color: #C5A572;
                margin-bottom: 6px;
            }
            
            .footer-tagline {
                font-style: italic;
                margin-bottom: 8px;
                opacity: 0.9;
                font-size: 0.75rem;
            }
            
            .contact-info {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 6px;
                margin-bottom: 8px;
                font-size: 0.75rem;
            }
            
            .contact-item {
                opacity: 0.9;
            }
            
            .contact-item a {
                color: #C5A572;
                text-decoration: none;
            }
            
            .contact-item a:hover {
                text-decoration: underline;
            }
            
            .query-info {
                font-size: 0.7rem;
                opacity: 0.8;
                margin-top: 4px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                padding-top: 4px;
            }
            
            @media print {
                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                }
                
                body { 
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                @page { 
                    size: A4 portrait;
                    margin: 10mm; 
                }
                
                .header, .footer, .payment-summary {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                .page-container {
                    height: 100%;
                }
                
                .contact-link {
                    color: white !important;
                    text-decoration: none !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                <div class="booking-ref">
                    <h2>${bookingRef}</h2>
                </div>
                <div class="header-content">
                    <div class="logo-section">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 60" class="logo-svg">
                            <defs>
                                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style="stop-color:#C5A572;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#C5A572;stop-opacity:0" />
                                </linearGradient>
                            </defs>
                            <text x="140" y="30" class="logo-text" text-anchor="middle" dominant-baseline="middle">
                                SPIRES TAXIS
                            </text>
                            <rect x="20" y="44" width="160" height="2" fill="url(#goldGradient)"/>
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
                            <span class="detail-value">${formatDate(booking.dateTime || booking.pickupTime)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Pickup Time</span>
                            <span class="detail-value">${formatTime(booking.dateTime || booking.pickupTime)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${(booking.status || "pending").toUpperCase()}</span>
                        </div>
                        ${booking.returnTrip ? `
                        <div class="detail-row">
                            <span class="detail-label">Return Trip</span>
                            <span class="detail-value">Yes</span>
                        </div>
                        ${booking.returnDateTime ? `
                        <div class="detail-row">
                            <span class="detail-label">Return Time</span>
                            <span class="detail-value">${formatDateTime(booking.returnDateTime)}</span>
                        </div>
                        ` : ''}
                        ` : ''}
                    </div>

                    <div class="info-box">
                        <h2 class="section-header">Customer Details</h2>
                        <div class="detail-row">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${booking.name || "N/A"}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${customerPhone || "N/A"}</span>
                        </div>
                        ${customerPhone ? `
                        <div class="contact-links">
                            <a href="${whatsappLink}" class="contact-link" target="_blank">📱 WhatsApp</a>
                            <a href="${callLink}" class="contact-link call" target="_blank">📞 Call</a>
                        </div>
                        ` : ''}
                        <div class="detail-row" style="margin-top: 8px;">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${booking.email || "N/A"}</span>
                        </div>
                    </div>
                </div>

                <div class="info-box full-width">
                    <h2 class="section-header">Journey Details</h2>
                    ${booking.bookingType === "return" || (booking.returnPickupLocation && booking.returnDestination) ? `
                    <div style="margin-bottom:10px;">
                        <div style="font-weight:700;color:#002147;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Outbound Journey</div>
                        <div class="journey-section">
                            <div class="journey-flow">
                                <div class="journey-point">
                                    <div class="journey-time">Pick up: ${formatTime(booking.dateTime || booking.pickupTime)}</div>
                                    <div class="journey-location">${booking.pickup || booking.pickupLocation || "N/A"}</div>
                                </div>
                                <div class="journey-arrow">→</div>
                                <div class="journey-point">
                                    <div class="journey-location">${booking.destination || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        ${booking.airportCollection ? `<div class="detail-row"><span class="detail-label">Airport collection</span><span class="detail-value">Yes${booking.flightNumber ? ` · ${booking.flightNumber}` : ""}</span></div>` : ""}
                    </div>
                    <div>
                        <div style="font-weight:700;color:#002147;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Return Journey</div>
                        <div class="journey-section">
                            <div class="journey-flow">
                                <div class="journey-point">
                                    <div class="journey-time">Pick up: ${formatTime(booking.returnPickupTime || booking.returnDateTime)}</div>
                                    <div class="journey-location">${booking.returnPickupLocation || "N/A"}</div>
                                </div>
                                <div class="journey-arrow">→</div>
                                <div class="journey-point">
                                    <div class="journey-location">${booking.returnDestination || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        ${booking.returnAirportCollection ? `<div class="detail-row"><span class="detail-label">Airport collection</span><span class="detail-value">Yes${booking.returnFlightNumber ? ` · ${booking.returnFlightNumber}` : ""}</span></div>` : ""}
                    </div>
                    ` : `
                    <div class="journey-section">
                        <div class="journey-flow">
                            <div class="journey-point">
                                <div class="journey-time">Pick up: ${formatTime(booking.dateTime || booking.pickupTime)}</div>
                                <div class="journey-location">${booking.pickup || booking.pickupLocation || "N/A"}</div>
                            </div>
                            <div class="journey-arrow">→</div>
                            <div class="journey-point">
                                <div class="journey-location">${booking.destination || "N/A"}</div>
                            </div>
                        </div>
                    </div>
                    ${booking.airportCollection ? `<div class="detail-row"><span class="detail-label">Airport collection</span><span class="detail-value">Yes${booking.flightNumber ? ` · ${booking.flightNumber}` : ""}</span></div>` : ""}
                    `}
                </div>

                <div class="content-grid">
                    <div class="info-box">
                        <h2 class="section-header">Trip Details</h2>
                        <div class="detail-row">
                            <span class="detail-label">Passengers</span>
                            <span class="detail-value">${booking.passengers || 1}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">${formatVehicleTypeLabel(booking.vehicleType)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Luggage</span>
                            <span class="detail-value">${booking.luggage || 0} pieces</span>
                        </div>
                        ${booking.depositRequired ? `
                        <div class="detail-row">
                            <span class="detail-label">Deposit</span>
                            <span class="detail-value">${
                              booking.depositStatus === "paid"
                                ? `Paid${booking.depositAmount ? ` (£${Number(booking.depositAmount).toFixed(2)})` : ""}`
                                : `Required${booking.depositAmount ? ` — £${Number(booking.depositAmount).toFixed(2)}` : ""}`
                            }</span>
                        </div>
                        ` : ''}
                        ${booking.specialRequirements ? `
                        <div class="detail-row" style="margin-top: 8px; flex-direction: column; align-items: flex-start;">
                            <span class="detail-label" style="margin-bottom: 4px;">Special Requirements</span>
                            <span class="detail-value" style="text-align: left; max-width: 100%; font-size: 0.85rem;">${booking.specialRequirements}</span>
                        </div>
                        ` : ''}
                    </div>

                    ${driver || vehicle ? `
                    <div class="info-box">
                        <h2 class="section-header">Your Driver</h2>
                        <div class="detail-row">
                            <span class="detail-label">Driver</span>
                            <span class="detail-value">${driver ? driver.name : 'Not assigned'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">${vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.registration : 'Not assigned'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Colour</span>
                            <span class="detail-value">${vehicle ? vehicle.color : 'Not assigned'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Registration</span>
                            <span class="detail-value">${vehicle ? vehicle.registration : 'Not assigned'}</span>
                        </div>
                    </div>
                    ` : ''}

                    ${(() => {
                        const isCompleted = booking.status === 'completed';
                        const isPaid = booking.paymentStatus === 'paid';
                        const hasFare = booking.actualFare;
                        const paymentMethod = (booking.paymentMethod || "TO BE CONFIRMED").replace(/_/g, " ").toUpperCase();
                        const isPaymentRequest = type === 'payment_request';
                        const isPaymentReceipt = type === 'payment_receipt';
                        const bankBlock = isBankTransferMethod(booking.paymentMethod) && !isPaid
                          ? bankTransferDetailsHtml(booking.paymentStatus)
                          : '';
                        const depositAmt = Number(booking.depositAmount);
                        const depositBlock = booking.depositRequired && booking.depositStatus !== 'paid'
                          ? `
                            <div style="margin-top:12px;padding:12px;border:1px solid #C5A572;border-radius:8px;background:#fff8eb;font-size:0.9rem;line-height:1.5;color:#fff;">
                              <div style="font-weight:600;margin-bottom:6px;">Deposit required</div>
                              <div>${Number.isFinite(depositAmt)
                                ? `Please pay a deposit of £${depositAmt.toFixed(2)} to confirm this booking.`
                                : "A deposit is required to confirm this booking."}</div>
                              <div style="margin-top:4px;font-size:0.85rem;opacity:0.9;">Use your booking number as the payment reference.</div>
                            </div>
                          `
                          : (booking.depositRequired && booking.depositStatus === 'paid'
                            ? `<div style="margin-top:10px;font-size:0.9rem;">Deposit: Paid${Number.isFinite(depositAmt) ? ` (£${depositAmt.toFixed(2)})` : ""}</div>`
                            : '');
                        
                        // Payment Request - always show prominently
                        if (isPaymentRequest && hasFare) {
                            return `
                            <div class="info-box">
                                <h2 class="section-header">Payment Request</h2>
                                <div class="payment-summary" style="background: #92400e; border: 2px solid #C5A572;">
                                    <div class="payment-amount">£${booking.actualFare.toFixed(2)}</div>
                                    <div class="payment-method">Payment Required - ${paymentMethod}</div>
                                    <div style="margin-top: 10px; font-size: 0.85rem; opacity: 0.95;">
                                        Please arrange payment for this booking using the method above.
                                    </div>
                                    ${bankBlock}
                                    ${depositBlock}
                                </div>
                            </div>
                            `;
                        }
                        
                        // If trip is paid, show "Paid by" regardless of completion status
                        if ((isPaid && hasFare) || (isPaymentReceipt && hasFare)) {
                            return `
                            <div class="info-box">
                                <h2 class="section-header">Payment</h2>
                                <div class="payment-summary">
                                    <div class="payment-amount">£${booking.actualFare.toFixed(2)}</div>
                                    <div class="payment-method">Paid by ${paymentMethod}</div>
                                </div>
                            </div>
                            `;
                        }
                        
                        // If trip is completed but not paid
                        if (isCompleted && hasFare) {
                            return `
                            <div class="info-box">
                                <h2 class="section-header">Payment</h2>
                                <div class="payment-summary" style="background: #92400e;">
                                    <div class="payment-amount">£${booking.actualFare.toFixed(2)}</div>
                                    <div class="payment-method">Payment Pending - ${paymentMethod}</div>
                                    ${bankBlock}
                                    ${depositBlock}
                                </div>
                            </div>
                            `;
                        }
                        
                        // If trip is NOT completed (pending, confirmed, allocated, etc.) and has fare but not paid
                        if (!isCompleted && hasFare) {
                            return `
                            <div class="info-box">
                                <h2 class="section-header">Payment</h2>
                                <div class="payment-summary" style="background: #1d3c74;">
                                    <div class="payment-amount">£${booking.actualFare.toFixed(2)}</div>
                                    <div class="payment-method">To be paid by ${paymentMethod}</div>
                                    ${bankBlock}
                                    ${depositBlock}
                                </div>
                            </div>
                            `;
                        }
                        
                        // No fare set yet
                        return `
                        <div class="info-box">
                            <h2 class="section-header">Payment</h2>
                            <div class="detail-row">
                                <span class="detail-label">Fare</span>
                                <span class="detail-value">To be confirmed</span>
                            </div>
                            ${booking.paymentMethod ? `
                            <div class="detail-row">
                                <span class="detail-label">Payment Method</span>
                                <span class="detail-value">To be paid by ${paymentMethod}</span>
                            </div>
                            ` : ''}
                            <div class="detail-row">
                                <span class="detail-label">Status</span>
                                <span class="detail-value">${(booking.paymentStatus || 'pending').toUpperCase()}</span>
                            </div>
                            ${bankBlock}
                            ${depositBlock}
                        </div>
                        `;
                    })()}
                </div>

                ${booking.notes ? `
                <div class="info-box full-width" style="margin-top: 10px;">
                    <h2 class="section-header">Additional Notes</h2>
                    <div style="font-size: 0.85rem; color: #555; padding: 4px 0;">
                        ${booking.notes}
                    </div>
                </div>
                ` : ''}
                ${booking.dueOnOutbound != null || booking.dueOnReturn != null ? `
                <div class="info-box full-width" style="margin-top: 10px;">
                    <h2 class="section-header">Payment Schedule</h2>
                    <div class="detail-row"><span class="detail-label">Total fare</span><span class="detail-value">${booking.actualFare ? `£${Number(booking.actualFare).toFixed(2)}` : "TBC"}</span></div>
                    <div class="detail-row"><span class="detail-label">Deposit paid</span><span class="detail-value">£${Number(booking.depositAmount || 0).toFixed(2)}</span></div>
                    <div class="detail-row"><span class="detail-label">Due on outbound journey</span><span class="detail-value">£${Number(booking.dueOnOutbound || 0).toFixed(2)}</span></div>
                    <div class="detail-row"><span class="detail-label">Due on return journey</span><span class="detail-value">£${Number(booking.dueOnReturn || 0).toFixed(2)}</span></div>
                </div>
                ` : ''}
                ${bookingHasAirportCollection(booking) ? `
                <div style="margin-top:12px;padding:10px 12px;border:1px solid #e8e4da;border-radius:6px;background:#fbfaf7;color:#4b5563;font-size:0.72rem;line-height:1.45;">
                    <div style="font-weight:700;color:#334155;margin-bottom:6px;">${airportWaitingDisclaimerTitle()}</div>
                    ${airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY).split("\n\n").map((p) => `<p style="margin:0 0 6px;">${p}</p>`).join("")}
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <div class="footer-brand">SPIRES TAXIS</div>
                <div class="footer-tagline">Serving the City of Dreaming Spires</div>
                
                <div class="contact-info">
                    <div class="contact-item">
                        <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a>
                    </div>
                    <div class="contact-item">
                        <a href="tel:07776897772">07776 897772</a>
                    </div>
                    <div class="contact-item">
                        <a href="https://www.spires-taxis.com" target="_blank">www.spires-taxis.com</a>
                    </div>
                    <div class="contact-item">
                        <a href="https://wa.me/447776897772" target="_blank">WhatsApp Available</a>
                    </div>
                </div>
                
                <div class="query-info" style="margin-bottom: 4px;">
                    For queries, reference booking: <strong>${bookingRef}</strong>
                </div>
                
                <div style="font-size: 0.65rem; opacity: 0.9; text-align: center; margin-top: 4px; line-height: 1.3;">
                    <span>⭐ We'd love your feedback! </span>
                    <a href="https://g.page/r/CWu0N7lUD-YKEAI/review" target="_blank" style="color: #4285F4; text-decoration: underline; font-weight: 600;">📝 Leave a Review on Google</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  // Generate filename: "Name - BookingReference"
  const customerName = (booking.name || "Customer").replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const finalFileName = fileName || `${customerName} - ${bookingRef}`;

  // Create a new window and print/download
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    
    // Set the title for the print dialog
    printWindow.document.title = finalFileName;
    
    printWindow.addEventListener('load', () => {
      // Add a script to suggest filename when printing
      const script = printWindow.document.createElement('script');
      script.textContent = `
        window.addEventListener('beforeprint', function() {
          // Try to set filename suggestion (browser-dependent)
          document.title = '${finalFileName}';
        });
      `;
      printWindow.document.head.appendChild(script);
      
      // Trigger print dialog
      printWindow.print();
    });
  } else {
    // Fallback: download as HTML file with proper filename
    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${finalFileName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // Also provide a direct download option with proper filename
  // This creates a hidden link that can be used for direct download
  setTimeout(() => {
    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${finalFileName}.html`;
    link.style.display = 'none';
    document.body.appendChild(link);
    // Store link for potential direct download
    window._pdfDownloadLink = link;
    // Clean up after a delay
    setTimeout(() => {
      if (window._pdfDownloadLink) {
        document.body.removeChild(window._pdfDownloadLink);
        URL.revokeObjectURL(url);
        delete window._pdfDownloadLink;
      }
    }, 5000);
  }, 500);
};
