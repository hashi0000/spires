/** Display reference only; Firestore allocates the independent document identity. */
export function generateSpiresBookingNumber(): string {
  return `SP${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
