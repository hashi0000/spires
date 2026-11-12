import { londonExportDate, londonExportTime, londonStamp } from "./bookingDates";

test("formats a winter timestamp in London and leaves a missing timestamp blank", () => {
  expect(londonExportDate("2026-11-09T12:13:00Z")).toBe("09/11/2026");
  expect(londonExportTime("2026-11-09T12:13:45Z")).toBe("12:13");
  expect(londonExportDate(undefined)).toBe("");
  expect(londonExportTime(new Date("invalid"))).toBe("");
});

test("applies British summer time without using the journey date", () => {
  expect(londonStamp("2026-07-01T23:30:00Z")).toBe("2026-07-02T00:30:00");
  expect(londonExportDate("2026-07-01T23:30:00Z")).toBe("02/07/2026");
  expect(londonExportTime("2026-07-01T23:30:00Z")).toBe("00:30");
});
