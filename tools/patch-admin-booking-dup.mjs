import fs from "fs";

const bookingNumberTs = `/** Same pattern as useBookings.generateBookingNumber — SP + last 6 digits of timestamp */
export function generateSpiresBookingNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  return \`SP\${timestamp}\`;
}
`;
fs.writeFileSync("spires-admin-fresh/src/utils/bookingNumber.ts", bookingNumberTs);

let u = fs.readFileSync("spires-admin-fresh/src/hooks/useFirebase.ts", "utf8");
if (!u.includes("bookingNumber")) {
  u = u.replace(
    "import { useState, useEffect } from 'react';",
    "import { useState, useEffect } from 'react';\nimport { generateSpiresBookingNumber } from '../utils/bookingNumber';"
  );
}
u = u.replace(
  /  const generateBookingNumber = \(\): string => {\s*const timestamp = Date\.now\(\)\.toString\(\)\.slice\(-6\);\s*return `SP\$\{timestamp\}`;\s*};/,
  "  const generateBookingNumber = (): string => generateSpiresBookingNumber();"
);
fs.writeFileSync("spires-admin-fresh/src/hooks/useFirebase.ts", u);
console.log("useFirebase patched");

let bm = fs.readFileSync("spires-admin-fresh/src/components/BookingModal.tsx", "utf8");
bm = bm.replace(
  "import { expenseTypes, paymentMethods } from '../utils/constants';",
  "import { expenseTypes, paymentMethods } from '../utils/constants';\nimport { generateSpiresBookingNumber } from '../utils/bookingNumber';"
);
const oldBlock = `    const bookingId =
      editingBooking?.id || formData.bookingNumber || \`BK\${Date.now()}\`;

    // Prepare booking data - clean up undefined values
    const bookingData: any = {
      ...formData,
      actualFare:
        typeof formData.actualFare === 'string'
          ? (formData.actualFare.trim() ? parseFloat(formData.actualFare) : undefined)
          : formData.actualFare,
      dateTime: formData.dateTime
        ? new Date(formData.dateTime).toISOString()
        : new Date().toISOString(),
      allocatedTime: editingBooking && formData.allocatedTime
        ? formData.allocatedTime
        : new Date().toISOString(),
      bookingNumber: editingBooking && formData.bookingNumber
        ? formData.bookingNumber
        : \`BK\${Date.now()}\`,
    };`;
const newBlock = `    const newBookingNumber =
      editingBooking && formData.bookingNumber
        ? formData.bookingNumber
        : generateSpiresBookingNumber();
    const bookingId = editingBooking?.id || newBookingNumber;

    // Prepare booking data - clean up undefined values
    const bookingData: any = {
      ...formData,
      actualFare:
        typeof formData.actualFare === 'string'
          ? (formData.actualFare.trim() ? parseFloat(formData.actualFare) : undefined)
          : formData.actualFare,
      dateTime: formData.dateTime
        ? new Date(formData.dateTime).toISOString()
        : new Date().toISOString(),
      allocatedTime: editingBooking && formData.allocatedTime
        ? formData.allocatedTime
        : new Date().toISOString(),
      bookingNumber: newBookingNumber,
      id: bookingId,
    };`;
if (!bm.includes(oldBlock.slice(0, 40))) throw new Error("BookingModal block not found");
bm = bm.replace(oldBlock, newBlock);
fs.writeFileSync("spires-admin-fresh/src/components/BookingModal.tsx", bm);
console.log("BookingModal patched");

let app = fs.readFileSync("spires-admin-fresh/src/App.tsx", "utf8");
const oldAdd = `  const handleAddBooking = async (booking: any) => {
    try {
      await bookingsHook.addBooking(booking);
      setShowBookingModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to add booking');
    }
  };`;
const newAdd = `  const handleAddBooking = async (booking: any) => {
    try {
      // BookingModal already persisted new bookings via setDoc(bookings/{id})
      if (booking?.id) {
        setShowBookingModal(false);
        setEditingItem(null);
        return;
      }
      await bookingsHook.addBooking(booking);
      setShowBookingModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to add booking');
    }
  };`;
if (!app.includes("await bookingsHook.addBooking(booking)")) throw new Error("App handleAddBooking pattern");
app = app.replace(oldAdd, newAdd);
fs.writeFileSync("spires-admin-fresh/src/App.tsx", app);
console.log("App.tsx patched");
