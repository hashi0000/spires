import React from "react";
import AdvertisingResults from "./AdvertisingResults";
import { advertisingPreviewBookings } from "../utils/advertisingResults";

/** Development only. Sample rows, not live bookings. */
export default function ReportingPreview() {
  return (
    <div style={{ padding: "1rem", background: "#f4f7fb", minHeight: "100vh" }}>
      <AdvertisingResults bookings={advertisingPreviewBookings} previewMode email="preview@spires-taxis.com" />
    </div>
  );
}
