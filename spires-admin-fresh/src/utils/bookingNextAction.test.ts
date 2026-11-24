import { bookingNextAction } from "./bookingNextAction";
import { Booking } from "../types/types";

function booking(partial: Partial<Booking>): Booking {
  return {
    bookingNumber: "SP1",
    dateTime: "",
    hirerName: "Test",
    hirerAddress: "",
    hirerPhone: "",
    bookingMethod: "telephone",
    pickupTime: "",
    pickupLocation: "Oxford",
    destination: "Heathrow",
    status: "pending",
    ...partial,
  };
}

describe("bookingNextAction", () => {
  it("asks for a quote on a pending enquiry without a fare", () => {
    expect(bookingNextAction(booking({ status: "pending" })).label).toBe("Send quote");
  });

  it("asks to assign a driver on a confirmed job", () => {
    expect(bookingNextAction(booking({ status: "confirmed", actualFare: 120 })).label).toBe("Assign driver");
  });

  it("asks to mark account jobs invoiced after completion without marking paid", () => {
    const action = bookingNextAction(
      booking({
        status: "completed",
        paymentMethod: "account",
        billingAccountName: "Eduguard",
        invoiceStatus: "unbilled",
        paymentStatus: "pending",
      })
    );
    expect(action.code).toBe("invoice");
    expect(action.label).toBe("Mark invoiced");
  });
});
