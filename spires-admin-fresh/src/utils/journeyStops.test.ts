import { keepStoredItinerary } from "./journeyStops";

describe("keepStoredItinerary", () => {
  it("drops return addresses typed during a cancellation when the booking has no return route stored", () => {
    const stored = {
      pickupLocation: "2 Test Street, Oxford OX1 1AB",
      destination: "Heathrow Terminal 5",
      stops: [
        { id: "start", type: "pickup", address: "2 Test Street, Oxford OX1 1AB" },
        { id: "end", type: "dropoff", address: "Heathrow Terminal 5" },
      ],
    };
    const update: Record<string, unknown> = {
      status: "confirmed",
      returnStatus: "cancelled",
      pickupLocation: "2 Test Street, Oxford OX1 1AB",
      destination: "Heathrow Terminal 5",
      returnPickupLocation: "2 Test Street, Oxford OX1 1AB",
      returnDestination: "Heathrow Terminal 5",
      returnStops: [
        { address: "2 Test Street, Oxford OX1 1AB" },
        { address: "Heathrow Terminal 5" },
      ],
      stops: stored.stops,
    };
    keepStoredItinerary(update, stored);
    expect(update.pickupLocation).toBe("2 Test Street, Oxford OX1 1AB");
    expect(update.destination).toBe("Heathrow Terminal 5");
    expect(update.stops).toEqual(stored.stops);
    expect(update.returnPickupLocation).toBeUndefined();
    expect(update.returnDestination).toBeUndefined();
    expect(update.returnStops).toBeUndefined();
    expect(update.returnStatus).toBe("cancelled");
  });

  it("keeps a stored return route instead of the addresses in the cancellation form", () => {
    const stored = {
      pickupLocation: "2 Test Street, Oxford OX1 1AB",
      destination: "Heathrow Terminal 5",
      returnPickupLocation: "Heathrow Terminal 5",
      returnDestination: "2 Test Street, Oxford OX1 1AB",
    };
    const update: Record<string, unknown> = {
      returnStatus: "cancelled",
      returnPickupLocation: "Somewhere else",
      returnDestination: "Another place",
    };
    keepStoredItinerary(update, stored);
    expect(update.returnPickupLocation).toBe("Heathrow Terminal 5");
    expect(update.returnDestination).toBe("2 Test Street, Oxford OX1 1AB");
  });
});
