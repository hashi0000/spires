import React, { useState } from "react";
import { FrequencyPoint, formatGbp } from "../utils/advertisingResults";

export function BookingFrequencyChart({ points, dateLabel, startDate = null, frequencyChange = "", revenuePerDayChange = "", averageBookingValueChange = "", confirmedBookingRateChange = "" }: { points: FrequencyPoint[]; dateLabel: string; startDate?: string | null; frequencyChange?: string; revenuePerDayChange?: string; averageBookingValueChange?: string; confirmedBookingRateChange?: string }) {
  const [showSpend, setShowSpend] = useState(false);
  const [mode, setMode] = useState<"count" | "revenue">("count");
  if (points.length === 0) return null;
  const width = 640;
  const height = 240;
  const left = 36;
  const spendKnown = points.some((point) => point.spendPence !== null);
  const showSpendLine = showSpend && spendKnown;
  const right = showSpendLine ? 72 : 16;
  const top = 28;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const peak = Math.max(1, ...points.flatMap((point) => [point.bookings, point.confirmed, point.rollingAverage || 0]));
  const spendPeak = Math.max(1, ...points.map((point) => point.spendPence ?? 0));
  const xAt = (index: number) => (points.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (points.length - 1));
  const yAt = (value: number) => top + plotHeight - (value / peak) * plotHeight;
  const ySpend = (pence: number) => top + plotHeight - (pence / spendPeak) * plotHeight;
  const revenueValues = points.flatMap((point) => [point.grossBookingRevenuePence, point.grossRollingAveragePence].filter((value): value is number => value !== null));
  const revenuePeak = Math.max(1, ...(revenueValues.length ? revenueValues : [0]));
  const yRevenue = (pence: number) => top + plotHeight - (pence / revenuePeak) * plotHeight;
  const revenueLines: string[] = [];
  const revenueAverageLines: string[] = [];
  if (mode === "revenue") {
    let grossCurrent: string[] = [];
    let averageCurrent: string[] = [];
    points.forEach((point, index) => {
      if (point.grossBookingRevenuePence === null) {
        if (grossCurrent.length) revenueLines.push(grossCurrent.join(" "));
        grossCurrent = [];
      } else grossCurrent.push(`${xAt(index)},${yRevenue(point.grossBookingRevenuePence)}`);
      if (point.grossRollingAveragePence === null) {
        if (averageCurrent.length) revenueAverageLines.push(averageCurrent.join(" "));
        averageCurrent = [];
      } else averageCurrent.push(`${xAt(index)},${yRevenue(point.grossRollingAveragePence)}`);
    });
    if (grossCurrent.length) revenueLines.push(grossCurrent.join(" "));
    if (averageCurrent.length) revenueAverageLines.push(averageCurrent.join(" "));
  }
  const dailyLine = points.map((point, index) => `${xAt(index)},${yAt(point.bookings)}`).join(" ");
  const confirmedLine = points.map((point, index) => `${xAt(index)},${yAt(point.confirmed)}`).join(" ");
  const averageLine = points.flatMap((point, index) => (point.rollingAverage === null ? [] : [`${xAt(index)},${yAt(point.rollingAverage)}`])).join(" ");
  const spendLines: string[] = [];
  if (showSpendLine) {
    let current: string[] = [];
    points.forEach((point, index) => {
      if (point.spendPence === null) {
        if (current.length) spendLines.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${xAt(index)},${ySpend(point.spendPence)}`);
    });
    if (current.length) spendLines.push(current.join(" "));
  }
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const middleIndex = Math.floor((points.length - 1) / 2);
  const dot = points.length > 45 ? 0 : 3;
  const confirmedStart = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
  const markerIndex = confirmedStart ? points.findIndex((point) => point.date === confirmedStart) : -1;
  const markerNote = !confirmedStart
    ? "No confirmed Google Ads start date is recorded, so no start date marker is drawn. A stored Google click is not used as that marker, the dates on this page are not used as that marker, and a campaign creation date is not used as that marker."
    : markerIndex >= 0
      ? `The marker shows the confirmed Google Ads start date, ${confirmedStart}.`
      : `The confirmed Google Ads start date is ${confirmedStart}. That date is not a finished day on this chart, so the marker is not drawn.`;
  const spendNote = !showSpend
    ? "Google Ads spend is optional and is not shown."
    : showSpendLine
      ? "The overlay shows dated Google Ads spend on finished days. A day with no spend figure is left out of the line and is not treated as zero. Manual spend is not used. No campaign or budget was changed."
      : "Google Ads spend by day was not returned, so the overlay is not drawn. A missing day is not treated as zero. Manual spend is not used as Google Ads spend. No campaign or budget was changed.";
  const measureNote = mode === "count"
    ? `Daily bookings counts every stored booking on that finished day, by ${dateLabel}, including an enquiry or a cancellation. Confirmed bookings are confirmed, allocated and completed. The seven day rolling average is daily bookings on that finished day and the six finished days before it, divided by 7. Days before the selected period are included in that average. A finished day with no booking is 0.`
    : `Gross booking revenue is the quoted fare of confirmed, allocated and completed bookings on each finished day, by ${dateLabel}. A cancellation or an enquiry is not included. A missing fare stays unknown and is not treated as zero. This is not money received. The seven day rolling average is that daily figure for the finished day and the six finished days before it, divided by 7. Days before the selected period are included. Where a fare in those seven days is missing, the average is not calculated. A finished day with no confirmed booking is 0.`;
  return (
    <figure className="mt-2">
      <figcaption>
        <p className="text-sm font-medium text-gray-900">Booking frequency</p>
        <p className="text-sm text-gray-600 mt-2">{measureNote} The current day is left out. {markerNote} {spendNote}</p>
        {frequencyChange ? <p className="text-sm text-gray-700 mt-2">{frequencyChange}. This compares daily bookings on finished days, including an enquiry or a cancellation. The earlier period is the same number of days immediately before.</p> : null}
        {revenuePerDayChange ? <p className="text-sm text-gray-700 mt-2">{revenuePerDayChange}. This compares recorded payments on finished days, less refunds. A missing payment stays unknown and is not treated as zero. Quoted fares are not used. The earlier period is the same number of days immediately before.</p> : null}
        {averageBookingValueChange ? <p className="text-sm text-gray-700 mt-2">{averageBookingValueChange}. This compares the average quoted fare of confirmed, allocated and completed bookings on finished days. A cancellation or enquiry is left out. A missing fare stays unknown and is not treated as zero. This is not money received. The earlier period is the same number of days immediately before.</p> : null}
        {confirmedBookingRateChange ? <p className="text-sm text-gray-700 mt-2">{confirmedBookingRateChange}. This compares the confirmed booking rate on finished days. The rate is confirmed, allocated and completed bookings divided by bookings that were not cancelled. A cancellation is left out. An enquiry stays in the comparison. Where every stored booking is cancelled, or there is no booking, the rate is not calculated. The earlier period is the same number of days immediately before.</p> : null}
      </figcaption>
      <div className="flex items-center space-x-2 mt-2" role="group" aria-label="Chart measure">
        <button type="button" className={mode === "count" ? "bg-blue-600" : "bg-gray-200 text-gray-700"} aria-pressed={mode === "count"} onClick={() => setMode("count")}>Booking count</button>
        <button type="button" className={mode === "revenue" ? "bg-blue-600" : "bg-gray-200 text-gray-700"} aria-pressed={mode === "revenue"} onClick={() => setMode("revenue")}>Gross booking revenue</button>
      </div>
      <button type="button" className={showSpend ? "bg-blue-600 mt-2" : "bg-gray-200 text-gray-700 mt-2"} aria-pressed={showSpend} onClick={() => setShowSpend((value) => !value)}>Show Google Ads spend</button>
      <ul className="flex items-center gap-4 mt-2" style={{ listStyle: "none", padding: 0, flexWrap: "wrap" }}>
        {mode === "count" ? (
          <>
            <li className="flex items-center text-sm text-gray-700"><span className="bg-blue-600 rounded-full mr-2 h-3 w-4" />Daily bookings</li>
            <li className="flex items-center text-sm text-gray-700"><span className="bg-blue-800 rounded-full mr-2 h-3 w-4" />Confirmed bookings</li>
            <li className="flex items-center text-sm text-gray-700"><span className="bg-yellow-800 rounded-full mr-2 h-3 w-4" />Seven day rolling average</li>
          </>
        ) : (
          <>
            <li className="flex items-center text-sm text-gray-700"><span className="bg-blue-600 rounded-full mr-2 h-3 w-4" />Gross booking revenue</li>
            <li className="flex items-center text-sm text-gray-700"><span className="bg-yellow-800 rounded-full mr-2 h-3 w-4" />Seven day rolling average</li>
          </>
        )}
        {markerIndex >= 0 ? <li className="flex items-center text-sm text-gray-700"><span className="bg-gray-200 rounded-full mr-2 h-3 w-3" style={{ background: "#111827" }} />Google Ads start date</li> : null}
        {showSpendLine ? <li className="flex items-center text-sm text-gray-700"><span className="bg-green-600 rounded-full mr-2 h-3 w-4" />Google Ads spend</li> : null}
      </ul>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", marginTop: "0.5rem" }} role="img" aria-label={`Booking frequency from ${first} to ${last}. ${mode === "count" ? "Daily bookings, confirmed bookings, and the seven day rolling average" : "Gross booking revenue and the seven day rolling average"} on each finished day.${markerIndex >= 0 ? ` Google Ads start date marker on ${confirmedStart}.` : ""}${showSpendLine ? " Google Ads spend overlay uses the right hand scale." : ""}`}>
        <text x={left} y="16" fontSize="12" fill="#374151">{mode === "revenue" ? "Gross booking revenue" : "Bookings"}</text>
        {showSpendLine ? <text x={width - 8} y="16" textAnchor="end" fontSize="12" fill="#16a34a">Google Ads spend</text> : null}
        <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#e5e7eb" />
        <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="#e5e7eb" />
        <text x={left - 8} y={top + 4} textAnchor="end" fontSize="11" fill="#6b7280">{mode === "revenue" ? formatGbp(revenuePeak) : peak}</text>
        <text x={left - 8} y={top + plotHeight + 4} textAnchor="end" fontSize="11" fill="#6b7280">{mode === "revenue" ? formatGbp(0) : 0}</text>
        {showSpendLine ? <text x={left + plotWidth + 8} y={top + 4} fontSize="11" fill="#16a34a">{formatGbp(spendPeak)}</text> : null}
        {showSpendLine ? <text x={left + plotWidth + 8} y={top + plotHeight + 4} fontSize="11" fill="#16a34a">{formatGbp(0)}</text> : null}
        {markerIndex >= 0 ? (
          <line className="frequency-chart__marker" x1={xAt(markerIndex)} y1={top} x2={xAt(markerIndex)} y2={top + plotHeight} stroke="#111827" strokeWidth="2">
            <title>{`Google Ads start date ${confirmedStart}`}</title>
          </line>
        ) : null}
        {mode === "count" ? <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={dailyLine} /> : revenueLines.map((line) => <polyline key={line} className="frequency-chart__gross" fill="none" stroke="#2563eb" strokeWidth="2" points={line} />)}
        {mode === "count" ? <polyline fill="none" stroke="#1e40af" strokeWidth="2" points={confirmedLine} /> : null}
        {mode === "count" && averageLine ? <polyline fill="none" stroke="#ca8a04" strokeWidth="2" strokeDasharray="5 4" points={averageLine} /> : null}
        {mode === "revenue" ? revenueAverageLines.map((line) => <polyline key={line} className="frequency-chart__gross-average" fill="none" stroke="#ca8a04" strokeWidth="2" strokeDasharray="5 4" points={line} />) : null}
        {spendLines.map((line) => <polyline key={line} className="frequency-chart__spend" fill="none" stroke="#16a34a" strokeWidth="2" points={line} />)}
        {points.map((point, index) => (
          <g key={point.date}>
            {mode === "count" ? (
              <circle cx={xAt(index)} cy={yAt(point.bookings)} r={dot} fill="#2563eb">
                <title>{`${point.date}: ${point.bookings} daily bookings`}</title>
              </circle>
            ) : point.grossBookingRevenuePence === null ? null : (
              <circle cx={xAt(index)} cy={yRevenue(point.grossBookingRevenuePence)} r={dot} fill="#2563eb">
                <title>{`${point.date}: ${formatGbp(point.grossBookingRevenuePence)} gross booking revenue`}</title>
              </circle>
            )}
            {mode === "count" ? (
              <circle cx={xAt(index)} cy={yAt(point.confirmed)} r={dot} fill="#1e40af">
                <title>{`${point.date}: ${point.confirmed} confirmed bookings`}</title>
              </circle>
            ) : null}
            {mode === "count" && point.rollingAverage !== null ? (
              <circle cx={xAt(index)} cy={yAt(point.rollingAverage)} r={dot} fill="#ca8a04">
                <title>{`${point.date}: ${point.rollingAverage} seven day rolling average`}</title>
              </circle>
            ) : null}
            {mode === "revenue" && point.grossRollingAveragePence !== null ? (
              <circle cx={xAt(index)} cy={yRevenue(point.grossRollingAveragePence)} r={dot} fill="#ca8a04">
                <title>{`${point.date}: ${formatGbp(point.grossRollingAveragePence)} seven day rolling average`}</title>
              </circle>
            ) : null}
            {showSpendLine && point.spendPence !== null ? (
              <circle cx={xAt(index)} cy={ySpend(point.spendPence)} r={dot} fill="#16a34a">
                <title>{`${point.date}: ${formatGbp(point.spendPence)} Google Ads spend`}</title>
              </circle>
            ) : null}
          </g>
        ))}
        <text x={xAt(0)} y={height - 22} textAnchor={points.length === 1 ? "middle" : "start"} fontSize="11" fill="#6b7280">{first}</text>
        {points.length > 2 ? <text x={xAt(middleIndex)} y={height - 22} textAnchor="middle" fontSize="11" fill="#6b7280">{points[middleIndex].date}</text> : null}
        {points.length > 1 ? <text x={xAt(points.length - 1)} y={height - 22} textAnchor="end" fontSize="11" fill="#6b7280">{last}</text> : null}
        <text x={left + plotWidth / 2} y={height - 4} textAnchor="middle" fontSize="12" fill="#6b7280">Date</text>
      </svg>
      <table className="frequency-chart__table">
        <caption>Bookings on each finished day</caption>
        <thead>
          <tr><th>Date</th><th>Daily bookings</th><th>Confirmed bookings</th><th>Seven day rolling average</th><th>Gross booking revenue</th><th>Seven day gross average</th><th>Google Ads spend</th></tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.bookings}</td>
              <td>{point.confirmed}</td>
              <td>{point.rollingAverage === null ? "not calculated" : point.rollingAverage}</td>
              <td>{point.grossBookingRevenuePence === null ? "Unknown" : formatGbp(point.grossBookingRevenuePence)}</td>
              <td>{point.grossRollingAveragePence === null ? "not calculated" : formatGbp(point.grossRollingAveragePence)}</td>
              <td>{formatGbp(point.spendPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
