import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let app = fs.readFileSync(path.join(root, "spires-admin-fresh/src/App.tsx"), "utf8");

if (!app.includes("useMemo")) {
  app = app.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect, useMemo } from 'react';"
  );
}

const insert = `  const bookingLocationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const b of bookingsHook.bookings) {
      const pickup = (b.pickupLocation || '').trim();
      const dest = (b.destination || '').trim();
      if (pickup.length > 0) seen.add(pickup);
      if (dest.length > 0) seen.add(dest);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [bookingsHook.bookings]);

`;

if (!app.includes("bookingLocationSuggestions")) {
  app = app.replace(
    "  const driverLimitCheck = useDriverLimitCheck(driversHook.drivers);\n  \n  const [showDriverModal]",
    `  const driverLimitCheck = useDriverLimitCheck(driversHook.drivers);\n\n${insert}  const [showDriverModal]`
  );
}

app = app.replace(
  "<BookingModal isOpen={showBookingModal} onClose={closeBookingModal} onSubmit={editingItem ? handleUpdateBooking : handleAddBooking} editingBooking={editingItem} activeDrivers={activeDrivers} availableVehicles={availableVehicles} />",
  "<BookingModal isOpen={showBookingModal} onClose={closeBookingModal} onSubmit={editingItem ? handleUpdateBooking : handleAddBooking} editingBooking={editingItem} activeDrivers={activeDrivers} availableVehicles={availableVehicles} locationSuggestions={bookingLocationSuggestions} />"
);

fs.writeFileSync(path.join(root, "spires-admin-fresh/src/App.tsx"), app);

let bm = fs.readFileSync(path.join(root, "spires-admin-fresh/src/components/BookingModal.tsx"), "utf8");

bm = bm.replace(
  `interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (booking: any) => void; // ✅ fixed optional prop syntax
  editingBooking?: any | null;
  activeDrivers: Driver[];
  availableVehicles: Vehicle[];
}`,
  `interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (booking: any) => void; // ✅ fixed optional prop syntax
  editingBooking?: any | null;
  activeDrivers: Driver[];
  availableVehicles: Vehicle[];
  /** Unique pickup/destination strings from existing bookings (datalist autocomplete) */
  locationSuggestions?: string[];
}`
);

bm = bm.replace(
  `  editingBooking,
  activeDrivers,
  availableVehicles
}) => {`,
  `  editingBooking,
  activeDrivers,
  availableVehicles,
  locationSuggestions = []
}) => {`
);

const addrBlock = `
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Address</label>
              <input
                type="text"
                value={formData.hirerAddress}
                onChange={(e) => setFormData({ ...formData, hirerAddress: e.target.value })}
                className="form-input"
              />
            </div>

`;

bm = bm.replace(addrBlock, "\n");

const oldPickDest = `            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
              <input
                type="text"
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                required
                className="form-input"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
                className="form-input"
              />
            </div>`;

const newPickDest = `            {locationSuggestions.length > 0 && (
              <datalist id="booking-past-locations">
                {locationSuggestions.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
              <input
                type="text"
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                required
                className="form-input"
                list={locationSuggestions.length > 0 ? "booking-past-locations" : undefined}
                placeholder="Type or pick a past location"
                autoComplete="off"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
                className="form-input"
                list={locationSuggestions.length > 0 ? "booking-past-locations" : undefined}
                placeholder="Type or pick a past location"
                autoComplete="off"
              />
            </div>`;

if (!bm.includes("Pickup Location *")) throw new Error("pickup missing");
bm = bm.replace(oldPickDest, newPickDest);

fs.writeFileSync(path.join(root, "spires-admin-fresh/src/components/BookingModal.tsx"), bm);
console.log("done");
