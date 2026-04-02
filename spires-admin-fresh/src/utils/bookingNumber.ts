/** Same pattern as useBookings.generateBookingNumber — SP + last 6 digits of timestamp */
export function generateSpiresBookingNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  return `SP${timestamp}`;
}
