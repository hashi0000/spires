import React from "react";
import { GrowthSide, PeriodPace, formatGbp, formatPace, formatRate, percentageChange } from "../utils/advertisingResults";

interface BarItem {
  label: string;
  earlier: number | null;
  later: number | null;
  earlierText: string;
  laterText: string;
  change?: string;
}

function width(value: number, other: number): string {
  const scale = Math.max(value, other, 0);
  if (scale === 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;
}

export function ComparisonBars({
  earlierName,
  laterName,
  items,
}: {
  earlierName: string;
  laterName: string;
  items: BarItem[];
}) {
  return (
    <div className="mt-2 space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Visual comparison</p>
        <p className="text-sm text-gray-600 mt-2">Each bar uses finished days only. The current day is left out. Unknown, not calculated, not measurable, no enquiry records, and not identifiable are not drawn as zero. Percentage change compares the later figure with the earlier figure. It is not calculated when the earlier figure is zero or a figure is unknown.</p>
      </div>
      {items.map((item) => {
        const drawn = item.earlier !== null && item.later !== null;
        return (
          <div key={item.label}>
            <p className="text-sm font-medium text-gray-900">{item.label}</p>
            <div className="flex items-center mt-2">
              <span className="text-sm text-gray-700 flex-shrink-0" style={{ width: "6.5rem" }}>{earlierName}</span>
              {drawn ? (
                <span className="flex-1 bg-gray-200 rounded-full overflow-hidden h-3" aria-hidden="true">
                  <span className="comparison-bars__fill bg-blue-600 h-3" style={{ width: width(item.earlier as number, item.later as number), display: "block" }} />
                </span>
              ) : null}
              <span className="text-sm font-medium text-gray-900 ml-4">{item.earlierText}</span>
            </div>
            <div className="flex items-center mt-2">
              <span className="text-sm text-gray-700 flex-shrink-0" style={{ width: "6.5rem" }}>{laterName}</span>
              {drawn ? (
                <span className="flex-1 bg-gray-200 rounded-full overflow-hidden h-3" aria-hidden="true">
                  <span className="comparison-bars__fill bg-blue-800 h-3" style={{ width: width(item.later as number, item.earlier as number), display: "block" }} />
                </span>
              ) : null}
              <span className="text-sm font-medium text-gray-900 ml-4">{item.laterText}</span>
            </div>
            {item.change ? <p className="text-sm text-gray-700 mt-2">{item.change}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function withChange(item: BarItem, emptyLabel: string): BarItem {
  return { ...item, change: percentageChange(item.earlier, item.later, emptyLabel) };
}

function countItem(label: string, earlier: number, later: number): BarItem {
  return { label, earlier, later, earlierText: String(earlier), laterText: String(later) };
}

function optionalItem(label: string, earlier: number | null, later: number | null, missing: string): BarItem {
  return {
    label,
    earlier,
    later,
    earlierText: earlier === null ? missing : String(earlier),
    laterText: later === null ? missing : String(later),
  };
}

function moneyItem(label: string, earlier: number | null, later: number | null): BarItem {
  return { label, earlier, later, earlierText: formatGbp(earlier), laterText: formatGbp(later) };
}

function rateItem(label: string, earlier: number | null, later: number | null): BarItem {
  return {
    label,
    earlier,
    later,
    earlierText: earlier === null ? "not calculated" : formatRate(earlier),
    laterText: later === null ? "not calculated" : formatRate(later),
  };
}

function paceItem(label: string, earlier: number | null, later: number | null): BarItem {
  return {
    label,
    earlier,
    later,
    earlierText: earlier === null ? "not calculated" : formatPace(earlier),
    laterText: later === null ? "not calculated" : formatPace(later),
  };
}

export function growthComparisonItems(before: GrowthSide, after: GrowthSide): BarItem[] {
  const beforeWeek = before.bookingsPerDay === null ? null : before.bookingsPerDay * 7;
  const afterWeek = after.bookingsPerDay === null ? null : after.bookingsPerDay * 7;
  return [
    withChange(countItem("Total bookings", before.total, after.total), "total bookings"),
    withChange(countItem("Confirmed bookings", before.confirmed, after.confirmed), "confirmed bookings"),
    withChange(countItem("Completed bookings", before.completed, after.completed), "completed bookings"),
    withChange(paceItem("Bookings per day", before.bookingsPerDay, after.bookingsPerDay), "confirmed bookings"),
    withChange(paceItem("Bookings per week", beforeWeek, afterWeek), "confirmed bookings"),
    withChange(paceItem("Booking frequency", before.days === 0 ? null : before.total / before.days, after.days === 0 ? null : after.total / after.days), "daily bookings"),
    withChange(moneyItem("Revenue per day", before.revenuePerDayPence, after.revenuePerDayPence), "recorded revenue"),
    withChange(moneyItem("Gross booking revenue", before.grossBookingRevenuePence, after.grossBookingRevenuePence), "gross booking revenue"),
    withChange(moneyItem("Average booking value", before.averageBookingPence, after.averageBookingPence), "average booking value"),
    withChange(rateItem("Confirmed booking rate", before.confirmedRate, after.confirmedRate), "confirmed booking rate"),
    withChange(optionalItem("Enquiry volume", before.enquiryVolume, after.enquiryVolume, "no enquiry records"), "enquiry records"),
    withChange({
      label: "Enquiry to booking conversion rate",
      earlier: before.enquiryConversionRate,
      later: after.enquiryConversionRate,
      earlierText: before.enquiryConversionRate === null ? "not measurable" : formatRate(before.enquiryConversionRate),
      laterText: after.enquiryConversionRate === null ? "not measurable" : formatRate(after.enquiryConversionRate),
    }, "enquiry to booking conversion"),
    withChange(optionalItem("Returning customers", before.returningCustomers, after.returningCustomers, "not identifiable"), "returning customers"),
    withChange(optionalItem("New customers", before.newCustomers, after.newCustomers, "not identifiable"), "new customers"),
  ];
}

export function paceComparisonItems(earlier: PeriodPace, selected: PeriodPace): BarItem[] {
  return [
    withChange(paceItem("Confirmed bookings a day", earlier.bookingsPerDay, selected.bookingsPerDay), "confirmed bookings"),
    withChange(moneyItem("Revenue per day", earlier.revenuePerDayPence, selected.revenuePerDayPence), "recorded revenue"),
    withChange(moneyItem("Average booking value", earlier.averageBookingPence, selected.averageBookingPence), "average booking value"),
    withChange(rateItem("Confirmed booking rate", earlier.confirmedRate, selected.confirmedRate), "confirmed booking rate"),
  ];
}
