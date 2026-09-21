import PDFDocument from "pdfkit";
import { format } from "date-fns";
import {
  SPIRES_BANK_DETAILS,
  isBankTransferMethod,
} from "./bankDetails";
import {
  AIRPORT_WAITING_POLICY,
  airportWaitingDisclaimerBody,
  airportWaitingDisclaimerTitle,
  bookingHasAirportCollection,
  isReturnBooking,
} from "./airportWaitingPolicy";

type PDFDocumentType =
  | "confirmation"
  | "booking_confirmation"
  | "payment"
  | "payment_receipt"
  | "payment_request";

const documentTitleMap: Record<PDFDocumentType, string> = {
  confirmation: "Booking Confirmation",
  booking_confirmation: "Booking Confirmation",
  payment: "Payment Receipt",
  payment_receipt: "Payment Receipt",
  payment_request: "Payment Request",
};

export async function generateBookingPDF(
  booking: any,
  type: PDFDocumentType = "booking_confirmation"
) {
  const doc = new PDFDocument({ margin: 40 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk as Buffer));

  // Header
  doc
    .fontSize(20)
    .text("Spires Taxis", { align: "center" })
    .moveDown(0.3)
    .fontSize(10)
    .text("07776 897772 | bookings@spires-taxis.com", { align: "center" })
    .text("www.spires-taxis.com", { align: "center" })
    .moveDown();

  const docTitle = documentTitleMap[type] || "Booking Confirmation";

  doc
    .fontSize(16)
    .fillColor("#0f172a")
    .text(docTitle.toUpperCase(), { align: "center", underline: true })
    .fillColor("black");

  doc.moveDown();

  let dateLabel = "N/A";
  try {
    const raw = booking.dateTime || booking.pickupTime || Date.now();
    const d =
      raw && typeof raw === "object" && typeof raw.toDate === "function"
        ? raw.toDate()
        : new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = format(d, "PPPp");
    }
  } catch {
    /* keep N/A */
  }

  const paymentMethodLabel = (booking.paymentMethod || "To be confirmed")
    .toString()
    .replace(/_/g, " ");

  const writeWrapped = (label: string, value: string) => {
    doc.fontSize(11).text(`${label}: ${value || ""}`, { width: 500 });
  };

  writeWrapped("Booking Number", booking.bookingNumber || "N/A");
  writeWrapped("Customer", booking.hirerName || booking.name || "Customer");
  writeWrapped("Phone", booking.hirerPhone || booking.phone || "");
  writeWrapped("Email", booking.hirerEmail || booking.email || "");

  if (isReturnBooking(booking)) {
    doc.moveDown(0.4).fontSize(12).text("OUTBOUND JOURNEY", { underline: true }).fontSize(11);
    writeWrapped("Date / pickup time", String(booking.pickupTime || dateLabel));
    writeWrapped("Pickup", booking.pickupLocation || booking.pickup || "");
    writeWrapped("Destination", booking.destination || "");
    writeWrapped("Airport collection", booking.airportCollection ? "Yes" : "No");
    if (booking.airportCollection && booking.flightNumber) {
      writeWrapped("Flight", booking.flightNumber);
    }
    doc.moveDown(0.4).fontSize(12).text("RETURN JOURNEY", { underline: true }).fontSize(11);
    writeWrapped("Date / pickup time", String(booking.returnPickupTime || booking.returnDateTime || ""));
    writeWrapped("Pickup", booking.returnPickupLocation || "");
    writeWrapped("Destination", booking.returnDestination || "");
    writeWrapped("Airport collection", booking.returnAirportCollection ? "Yes" : "No");
    if (booking.returnAirportCollection && booking.returnFlightNumber) {
      writeWrapped("Flight", booking.returnFlightNumber);
    }
  } else {
    writeWrapped("Pickup", booking.pickupLocation || booking.pickup || "");
    writeWrapped("Destination", booking.destination || "");
    writeWrapped("Pickup Time", String(booking.pickupTime || dateLabel));
    if (booking.airportCollection) {
      writeWrapped("Airport collection", "Yes");
    }
    if (booking.flightNumber) {
      writeWrapped("Flight", booking.flightNumber);
    }
    if (booking.returnTrip && booking.returnDateTime) {
      writeWrapped("Return", String(booking.returnDateTime));
    }
  }

  writeWrapped("Status", booking.status || "pending");
  if (booking.terminal) {
    writeWrapped("Terminal", booking.terminal);
  }
  if (booking.vehicleType) {
    const vt =
      booking.vehicleType === "8_seater" || booking.vehicleType === "8-seater"
        ? "8-seater"
        : booking.vehicleType === "standard"
          ? "Standard car"
          : String(booking.vehicleType);
    writeWrapped("Vehicle requested", vt);
  }
  if (booking.passengers) {
    writeWrapped("Passengers", String(booking.passengers));
  }

  doc.moveDown();

  const fare =
    typeof booking.actualFare === "number"
      ? booking.actualFare
      : Number(booking.actualFare);
  const hasFare = Number.isFinite(fare);
  const isPaid = booking.paymentStatus === "paid";

  doc
    .text(`Payment Method: ${paymentMethodLabel}`)
    .text(`Payment Status: ${booking.paymentStatus || "pending"}`);
  const hasSchedule =
    (booking.dueOnOutbound != null && String(booking.dueOnOutbound) !== "") ||
    (booking.dueOnReturn != null && String(booking.dueOnReturn) !== "");

  if (hasFare) {
    doc.text(`Fare: £${fare.toFixed(2)}`);
  } else {
    doc.text("Fare: To be confirmed");
  }

  if (hasSchedule) {
    const deposit = Number(booking.depositAmount);
    const outbound = Number(booking.dueOnOutbound);
    const ret = Number(booking.dueOnReturn);
    doc.moveDown(0.4).fontSize(12).text("Payment Schedule", { underline: true }).fontSize(11);
    if (Number.isFinite(deposit)) doc.text(`Deposit paid: £${deposit.toFixed(2)}`);
    if (Number.isFinite(outbound)) doc.text(`Due on outbound journey: £${outbound.toFixed(2)}`);
    if (Number.isFinite(ret)) doc.text(`Due on return journey: £${ret.toFixed(2)}`);
  } else if (booking.depositRequired) {
    const depAmt = Number(booking.depositAmount);
    const depLabel =
      booking.depositStatus === "paid"
        ? `Deposit: Paid${Number.isFinite(depAmt) ? ` (£${depAmt.toFixed(2)})` : ""}`
        : `Deposit required${Number.isFinite(depAmt) ? `: £${depAmt.toFixed(2)}` : ""}`;
    doc.text(depLabel);
  }

  if (type === "payment_request" && hasFare) {
    doc
      .moveDown(0.5)
      .fontSize(12)
      .fillColor("red")
      .text("Payment Required", { align: "center", underline: true })
      .fillColor("black")
      .fontSize(10)
      .text("Please arrange payment for the above fare amount.", {
        align: "center",
      })
      .moveDown();
  }

  if (isBankTransferMethod(booking.paymentMethod) && !isPaid) {
    const { accountName, sortCode, accountNumber } = SPIRES_BANK_DETAILS;
    doc
      .moveDown(0.5)
      .fontSize(11)
      .fillColor("#002147")
      .text("Pay by bank transfer", { underline: true })
      .fillColor("black")
      .fontSize(10)
      .text(`Account name: ${accountName}`)
      .text(`Sort code: ${sortCode}`)
      .text(`Account number: ${accountNumber}`)
      .text(
        `Please use booking number ${booking.bookingNumber || "as shown above"} as the payment reference.`
      )
      .moveDown();
  }

  if (booking.notes) {
    doc.moveDown(0.3).text(`Notes: ${booking.notes}`, { width: 500 });
  }

  if (bookingHasAirportCollection(booking)) {
    doc
      .moveDown(0.6)
      .fontSize(10)
      .fillColor("#334155")
      .text(airportWaitingDisclaimerTitle(), { underline: true })
      .fontSize(9)
      .fillColor("#4b5563")
      .text(airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY), { width: 500, lineGap: 2 })
      .fillColor("black");
  }

  doc
    .moveDown()
    .fontSize(10)
    .text("Thank you for choosing Spires Taxis.", { align: "center" })
    .moveDown(0.5)
    .text("We'd love your feedback!", { align: "center" })
    .moveDown(0.3)
    .fillColor("#4285F4")
    .text("Leave us a review on Google:", { align: "center" })
    .text("https://g.page/r/CWu0N7lUD-YKEAI/review", {
      align: "center",
      link: "https://g.page/r/CWu0N7lUD-YKEAI/review",
    })
    .fillColor("black")
    .moveDown(0.5)
    .fillColor("blue")
    .text("Or leave a review on Trustpilot:", { align: "center" })
    .text("https://uk.trustpilot.com/evaluate/spires-taxis.com", {
      align: "center",
      link: "https://uk.trustpilot.com/evaluate/spires-taxis.com",
    })
    .fillColor("black");

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  return Buffer.concat(buffers);
}
