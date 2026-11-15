import React, { useState } from "react";
import type { Booking, Driver, Vehicle } from "../types/types";
import { db, functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import { commitQuickAllocation, commitQuickPayment } from "../utils/quickBookingWrite";

type LegName = "outbound" | "return" | "booking";

export function QuickBookingActions({
  booking,
  leg,
  drivers,
  vehicles,
  bookings = [],
}: {
  booking: Booking;
  leg: LegName;
  drivers: Driver[];
  vehicles: Vehicle[];
  bookings?: Booking[];
}) {
  const currentDriver = leg === "return" ? booking.returnDriverId || "" : booking.driverId || "";
  const currentVehicle = leg === "return" ? booking.returnVehicleId || "" : booking.vehicleId || "";
  const [driverId, setDriverId] = useState(currentDriver);
  const [vehicleId, setVehicleId] = useState(currentVehicle);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"allocate" | "pay" | "">("");

  const saveAllocation = async () => {
    setBusy("allocate");
    setMessage("");
    try {
      await commitQuickAllocation(db, booking, leg, driverId, vehicleId, bookings);
      setMessage(leg === "return" ? "Return driver and vehicle saved." : "Allocation saved.");
    } catch (err) {
      setMessage(getCallableErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const savePayment = async () => {
    setBusy("pay");
    setMessage("");
    try {
      await commitQuickPayment(functions, booking, amount, method);
      setAmount("");
      setMessage("Payment recorded.");
    } catch (err) {
      setMessage(getCallableErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="booking-quick-actions">
      <label>
        {leg === "return" ? "Return driver" : "Driver"}
        <select aria-label={leg === "return" ? `Return driver for ${booking.bookingNumber}` : `Driver for ${booking.bookingNumber}`} value={driverId} onChange={(event) => setDriverId(event.target.value)}>
          <option value="">Unassigned</option>
          {drivers.filter((driver) => driver.active && driver.id).map((driver) => (
            <option key={driver.id} value={driver.id}>{driver.name}</option>
          ))}
        </select>
      </label>
      <label>
        {leg === "return" ? "Return vehicle" : "Outbound vehicle"}
        <select aria-label={leg === "return" ? `Return vehicle for ${booking.bookingNumber}` : `Outbound vehicle for ${booking.bookingNumber}`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
          <option value="">No vehicle</option>
          {vehicles.filter((vehicle) => vehicle.id).map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void saveAllocation()} disabled={busy === "allocate"}>
        {busy === "allocate" ? "Saving…" : leg === "return" ? "Save return driver" : "Save allocation"}
      </button>
      <label>
        Amount received
        <input aria-label={`Amount received for ${booking.bookingNumber}`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Method
        <select aria-label={`Payment method for ${booking.bookingNumber}`} value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank transfer">Bank transfer</option>
        </select>
      </label>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void savePayment()} disabled={busy === "pay" || !amount.trim()}>
        {busy === "pay" ? "Saving…" : "Record this payment"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
