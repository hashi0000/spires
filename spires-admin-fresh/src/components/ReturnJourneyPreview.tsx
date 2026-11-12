import React from "react";
import Dashboard from "./Dashboard";
import Bookings from "./Bookings";
import { Booking } from "../types/types";

const sample: Booking = {
  id: "preview-sp355017",
  bookingNumber: "SP355017",
  dateTime: "2026-10-30T17:25:00.000Z",
  hirerName: "Customer",
  hirerAddress: "",
  hirerPhone: "",
  bookingMethod: "telephone",
  pickupTime: "2026-10-30T17:25:00.000Z",
  pickupLocation: "10 Beech Crescent OX5 1DN",
  destination: "London Heathrow Terminal 2",
  status: "confirmed",
  bookingType: "return",
  returnPickupTime: "2026-11-15T19:05:00.000Z",
  returnDateTime: "2026-11-15T19:05:00.000Z",
  returnPickupLocation: "London Heathrow Terminal 2",
  returnDestination: "10 Beech Crescent OX5 1DN",
  actualFare: 180,
  paymentStatus: "paid",
};

/** Local sample only. It does not read or write a live booking. */
const ReturnJourneyPreview: React.FC = () => (
  <div className="space-y-6 p-4">
    <p className="text-sm text-gray-700">
      Preview sample for SP355017. The stored status is Confirmed and the return is 15 November at 19:05. This sample is not saved. The live booking record was not changed.
    </p>
    <Dashboard
      activeDriversCount={0}
      availableVehiclesCount={0}
      totalBookings={1}
      todaysBookingsCount={0}
      pendingCustomerBookingsCount={0}
      bookings={[sample]}
      desktopRemindersEnabled={false}
      onDesktopRemindersChange={() => undefined}
    />
    <Bookings
      bookings={[sample]}
      drivers={[]}
      vehicles={[]}
      onAddBooking={() => undefined}
      onEditBooking={() => undefined}
      onSaveBookingDirect={async () => undefined}
      onDeleteBooking={() => undefined}
      onGeneratePDF={() => undefined}
      onDuplicateBooking={() => undefined}
      onCreateReturnBooking={() => undefined}
    />
  </div>
);

export default ReturnJourneyPreview;
