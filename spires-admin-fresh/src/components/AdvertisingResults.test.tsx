import React from "react";
import { render, screen } from "@testing-library/react";
import { AdvertisingResultsView } from "./AdvertisingResults";
import { advertisingPreviewBookings, buildAdvertisingReport, currentLondonMonth } from "../utils/advertisingResults";

jest.mock("firebase/functions", () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }));
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(() => () => undefined),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock("../utils/firebase", () => ({ db: {}, functions: {} }));

test("preview hides passenger details and labels missing costs as unknown", () => {
  const range = currentLondonMonth(new Date("2026-11-10T12:00:00Z"));
  const report = buildAdvertisingReport(advertisingPreviewBookings, {
    ...range,
    dateBasis: "journey",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
  });
  render(
    <AdvertisingResultsView
      report={report}
      preview
      connectionNote="Google Ads is not connected. No advertising credentials are available to the server."
      onDates={() => undefined}
      onManualComplete={() => undefined}
      onAddSpend={() => undefined}
      onSaveSource={() => undefined}
      onSaveCost={() => undefined}
    />
  );

  expect(screen.getByRole("heading", { name: "Advertising results" })).toBeTruthy();
  expect(screen.getByText("Contribution before overheads")).toBeTruthy();
  expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  expect(screen.getByText("Tracked Google Ads")).toBeTruthy();
  expect(screen.getByText("Sample preview. These are not live bookings.")).toBeTruthy();
  expect(screen.getByText(/£135/)).toBeTruthy();
  expect(screen.queryByText("07000000000")).toBeNull();
  expect(screen.queryByText("Do not show this note")).toBeNull();
  expect(screen.getByText("8 seater")).toBeTruthy();
});
