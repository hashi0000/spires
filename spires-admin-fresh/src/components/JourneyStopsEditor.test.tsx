import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import JourneyStopsEditor from "./JourneyStopsEditor";
import { JourneyStop, normaliseStops } from "../utils/journeyStops";

function Editor() {
  const [stops, setStops] = useState<JourneyStop[]>(normaliseStops(undefined, "1 High Street, Oxford", "Heathrow Terminal 5"));
  const shown = normaliseStops(stops, "1 High Street, Oxford", "Heathrow Terminal 5");
  return <JourneyStopsEditor stops={shown} onChange={setStops} />;
}

beforeEach(() => {
  jest.spyOn(global, "fetch").mockResolvedValue({ json: async () => ({ suggestions: [] }) } as Response);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("an unfinished stop stays on the form", () => {
  const withBlank = normaliseStops([
    { id: "a", type: "pickup", address: "Oxford", notes: "" },
    { id: "b", type: "dropoff", address: "", notes: "" },
    { id: "c", type: "dropoff", address: "Heathrow", notes: "" },
  ], "Oxford", "Heathrow");
  expect(withBlank.map((stop) => stop.address)).toEqual(["Oxford", "", "Heathrow"]);
});

test("add a stop stays visible and clearing an address keeps the field", () => {
  render(<Editor />);
  expect(screen.getAllByLabelText("Address")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Add a stop" }));
  expect(screen.getAllByLabelText("Address")).toHaveLength(3);
  const addresses = screen.getAllByLabelText("Address");
  fireEvent.change(addresses[0], { target: { value: "" } });
  expect(screen.getAllByLabelText("Address")).toHaveLength(3);
  expect(screen.getAllByLabelText("Address")[0]).toHaveValue("");
});
